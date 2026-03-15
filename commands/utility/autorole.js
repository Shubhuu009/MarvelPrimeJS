const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../models/Autorole');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'autorole',
    description: 'Configure roles given automatically to new members.',
    category: 'utility',

    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Autorole configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('help').setDescription('Show usage instructions'))
        .addSubcommandGroup(group => 
            group.setName('humans')
                .setDescription('Manage human autoroles')
                .addSubcommand(s => s.setName('add').setDescription('Add a role').addRoleOption(o => o.setName('role').setRequired(true).setDescription('Role to add')))
                .addSubcommand(s => s.setName('remove').setDescription('Remove a role').addRoleOption(o => o.setName('role').setRequired(true).setDescription('Role to remove')))
                .addSubcommand(s => s.setName('list').setDescription('List human autoroles'))
        )
        .addSubcommandGroup(group => 
            group.setName('bots')
                .setDescription('Manage bot autoroles')
                .addSubcommand(s => s.setName('add').setDescription('Add a role').addRoleOption(o => o.setName('role').setRequired(true).setDescription('Role to add')))
                .addSubcommand(s => s.setName('remove').setDescription('Remove a role').addRoleOption(o => o.setName('role').setRequired(true).setDescription('Role to remove')))
                .addSubcommand(s => s.setName('list').setDescription('List bot autoroles'))
        ),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild } = context;
        const subGroup = isSlash ? context.options.getSubcommandGroup() : args[0]?.toLowerCase();
        const sub = isSlash ? context.options.getSubcommand() : args[1]?.toLowerCase();
        const prefix = context.client.prefix;

        const data = await db.findOneAndUpdate(
            { guildId: guild.id },
            { $setOnInsert: { guildId: guild.id } },
            { returnDocument: 'after', upsert: true }
        );

        if (!subGroup && !sub || sub === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle(`🛠️ Autorole System | Help Menu`)
                .setColor(0x95a5a6)
                .setDescription(`Manage roles that are automatically assigned to new members.`)
                .addFields(
                    { name: '📝 Usage Commands', value: 
                        `**Humans:**\n` +
                        `\`${prefix}autorole humans add <@role/ID>\`\n` +
                        `\`${prefix}autorole humans remove <@role/ID>\`\n` +
                        `\`${prefix}autorole humans list\`\n\n` +
                        `**Bots:**\n` +
                        `\`${prefix}autorole bots add <@role/ID>\`\n` +
                        `\`${prefix}autorole bots remove <@role/ID>\`\n` +
                        `\`${prefix}autorole bots list\``, 
                    inline: false }
                );
            return context.reply({ embeds: [helpEmbed] });
        }

        if (sub === 'list') {
            const type = subGroup === 'humans' ? 'humans' : 'bots';
            const roles = data[type].map((id, index) => `**${index + 1}.** <@&${id}> (ID: \`${id}\`)`).join('\n') || 'No roles configured.';

            const listEmbed = new EmbedBuilder()
                .setTitle(`Autorole List: ${type.toUpperCase()}`)
                .setColor(type === 'humans' ? 0x00f53d : 0x5865F2)
                .setDescription(roles)
                .setFooter({ text: `Guild: ${guild.name}` });

            return context.reply({ embeds: [listEmbed] });
        }

        // --- ADD/REMOVE LOGIC ---
        const type = subGroup === 'humans' ? 'humans' : 'bots';
        // FIXED: Role detection now explicitly supports ID-only input for prefix commands
        const role = isSlash ? context.options.getRole('role') : context.mentions.roles.first() || guild.roles.cache.get(args[2]);

        if (!role) return context.reply(result(context.user || context.author, 'Autorole Result', `${type} Role`, `Usage: \`${prefix}autorole ${type} add <@role/ID>\``, false, 'Invalid role.'));

        if (sub === 'add') {
            if (data[type].includes(role.id)) return context.reply(result(context.user || context.author, 'Autorole Result', 'Add Role', `${role} is already in the list.`, false, 'Duplicate role.'));

            // 🛡️ SECURITY CHECK: Dangerous Permissions
            const dangerousPermissions = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ModerateMembers
            ];

            const hasDangerous = dangerousPermissions.some(perm => role.permissions.has(perm));
            if (hasDangerous) {
                return context.reply(result(context.user || context.author, 'Autorole Result', 'Add Role', `${role} has dangerous permissions.`, false, 'Security block.'));
            }

            data[type].push(role.id);
            await data.save();
            return context.reply(result(context.user || context.author, 'Autorole Result', 'Add Role', `Added ${role} to ${type} autoroles.`));
        }

        if (sub === 'remove') {
            if (!data[type].includes(role.id)) return context.reply(result(context.user || context.author, 'Autorole Result', 'Remove Role', `${role} is not in the list.`, false, 'Role not found.'));
            data[type] = data[type].filter(id => id !== role.id);
            await data.save();
            return context.reply(result(context.user || context.author, 'Autorole Result', 'Remove Role', `Removed ${role} from ${type} autoroles.`));
        }
    }
};
