const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../models/Vcrole');
const { deleteCache } = require('../../services/runtime');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcrole',
    description: 'Configure roles given to members in voice channels.',
    category: 'utility',
    argsCount: null, // Dynamic subcommands

    data: new SlashCommandBuilder()
        .setName('vcrole')
        .setDescription('VC Role setup commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('add')
                .setDescription('Adds a role to the VC role list')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('remove')
                .setDescription('Removes the VC role configuration'))
        .addSubcommand(sub => 
            sub.setName('config')
                .setDescription('Shows the current VC role configuration')),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const sub = isSlash ? context.options.getSubcommand() : args[0]?.toLowerCase();
        const { guild } = context;

        if (sub === 'add') {
            const role = isSlash ? context.options.getRole('role') : context.mentions.roles.first();
            if (!role) return context.reply(result(context.user || context.author, 'VC Role Result', 'Add VC Role', 'Please mention a valid role.', false, 'Invalid role.'));

            await db.findOneAndUpdate({ guildId: guild.id }, { roleId: role.id }, { upsert: true });
            deleteCache(`vcrole:${guild.id}`);
            
            return context.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("<:Marvel_Successfully:1417856966352568472> | Success")
                    .setDescription(`VC role ${role} has been set for this guild.`)
                    .setColor(0x00f53d)]
            });
        }

        if (sub === 'remove') {
            await db.findOneAndDelete({ guildId: guild.id });
            deleteCache(`vcrole:${guild.id}`);
            return context.reply(result(context.user || context.author, 'VC Role Result', 'Remove VC Role', 'VC role configuration removed.'));
        }

        if (sub === 'config') {
            const data = await db.findOne({ guildId: guild.id });
            if (!data) return context.reply(result(context.user || context.author, 'VC Role Result', 'View VC Role', 'No VC role is configured for this guild.', false, 'VC role not set.'));
            
            return context.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("VC Role Configuration")
                    .setDescription(`Current VC role: <@&${data.roleId}>`)
                    .setFooter({ text: "Ensure the bot's role is above the VC role." })
                    .setColor(0x00f53d)]
            });
        }
    }
};
