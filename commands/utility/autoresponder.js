const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AutoResponse = require('../../models/AutoResponse');
const { deleteCache } = require('../../services/runtime');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'autoresponder',
    aliases: ['ar'],
    description: 'Manage server auto-responses.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage server auto-responses')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('create').setDescription('Create a response').addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Trigger word')).addStringOption(o => o.setName('reply').setRequired(true).setDescription('The bot response')))
        .addSubcommand(sub => sub.setName('delete').setDescription('Remove a response').addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Trigger to remove')))
        .addSubcommand(sub => sub.setName('list').setDescription('List all responses')),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        const sub = isSlash ? context.options.getSubcommand() : args[0]?.toLowerCase();

        // --- HELP MENU ---
        if (!sub || !['create', 'delete', 'list'].includes(sub)) {
            const help = new EmbedBuilder()
                .setTitle("**Marvel | AutoResponder Help**")
                .setColor(0x95a5a6)
                .setDescription("Automatically reply to specific messages.")
                .addFields(
                    { name: "📝 Usage", value: `\`${prefix}ar create <trigger> <reply>\`\n\`${prefix}ar delete <trigger>\`\n\`${prefix}ar list\`` }
                )
                .setFooter({ text: "Marvel Development ⚡" });
            return context.reply({ embeds: [help] });
        }

        const guildId = context.guild.id;

        if (sub === 'create') {
            const trigger = (isSlash ? context.options.getString('trigger') : args[1])?.toLowerCase();
            const response = isSlash ? context.options.getString('reply') : args.slice(2).join(' ');

            if (!trigger || !response) return context.reply(result(context.user || context.author, 'AutoResponder Result', 'Create Response', 'Provide both trigger and reply.', false, 'Missing trigger or reply.'));

            const count = await AutoResponse.countDocuments({ guildId });
            if (count >= 20) return context.reply(result(context.user || context.author, 'AutoResponder Result', 'Create Response', 'Server auto-response limit reached.', false, 'Maximum is 20 auto-responses.'));

            try {
                await AutoResponse.create({ guildId, trigger, response });
                deleteCache(`autoresponse:${guildId}:${trigger}`);
                return context.reply(result(context.user || context.author, 'AutoResponder Result', 'Create Response', `Created auto-response for \`${trigger}\`.`));
            } catch (e) {
                return context.reply(result(context.user || context.author, 'AutoResponder Result', 'Create Response', `Trigger \`${trigger}\` already exists.`, false, 'Duplicate trigger.'));
            }
        }

        if (sub === 'delete') {
            const trigger = (isSlash ? context.options.getString('trigger') : args[1])?.toLowerCase();
            const deleted = await AutoResponse.findOneAndDelete({ guildId, trigger });
            if (deleted) deleteCache(`autoresponse:${guildId}:${trigger}`);
            return context.reply(
                deleted
                    ? result(context.user || context.author, 'AutoResponder Result', 'Delete Response', `Deleted \`${trigger}\`.`)
                    : result(context.user || context.author, 'AutoResponder Result', 'Delete Response', `Trigger \`${trigger}\` was not found.`, false, 'Trigger not found.')
            );
        }

        if (sub === 'list') {
            const data = await AutoResponse.find({ guildId });
            if (!data.length) return context.reply(result(context.user || context.author, 'AutoResponder Result', 'List Responses', 'No auto-responses are configured.', false, 'No auto-responses set.'));

            const list = data.map((d, i) => `**${i + 1}.** ${d.trigger}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(`Auto-Responses | ${context.guild.name}`)
                .setDescription(list)
                .setColor(0x95a5a6);
            return context.reply({ embeds: [embed] });
        }
    }
};
