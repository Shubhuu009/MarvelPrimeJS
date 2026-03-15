const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AutoReact = require('../../models/AutoReact');
const { deleteCache } = require('../../services/runtime');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'autoreact',
    aliases: ['autoreact'],
    description: 'Manage auto-reaction triggers.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('Manage auto-reaction triggers')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('add').setDescription('Add a trigger').addStringOption(o => o.setName('trigger').setRequired(true).setDescription('One word trigger')).addStringOption(o => o.setName('emojis').setRequired(true).setDescription('Emojis to react with')))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove a trigger').addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Trigger to remove')))
        .addSubcommand(sub => sub.setName('list').setDescription('List all triggers'))
        .addSubcommand(sub => sub.setName('reset').setDescription('Clear all triggers')),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        const sub = isSlash ? context.options.getSubcommand() : args[0]?.toLowerCase();

        if (!sub || !['add', 'remove', 'list', 'reset'].includes(sub)) {
            const help = new EmbedBuilder()
                .setTitle("**Marvel | AutoReact Help**")
                .setColor(0x95a5a6)
                .setDescription(`\`${prefix}react add <trigger> <emojis>\`\n\`${prefix}react remove <trigger>\`\n\`${prefix}react list\``);
            return context.reply({ embeds: [help] });
        }

        const guildId = context.guild.id;

        if (sub === 'add') {
            const trigger = (isSlash ? context.options.getString('trigger') : args[1])?.toLowerCase();
            const emojiRaw = isSlash ? context.options.getString('emojis') : args.slice(2).join(' ');

            if (!trigger || trigger.split(/\s+/).length > 1) return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', 'Single-word trigger required.', false, 'Triggers must be a single word.'));
            
            // Emoji Regex to catch Custom and Unicode emojis
            const emojiList = emojiRaw.match(/<a?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u263a-\u{1F645}]|[\u2700-\u27bf]|[\u2b1b-\u2b1c]|[\u203c-\u2049]/gu);
            
            if (!emojiList || emojiList.length === 0) return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', 'No valid emojis detected.', false, 'No valid emojis provided.'));
            if (emojiList.length > 10) return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', 'Use 10 emojis or fewer.', false, 'Max 10 emojis per trigger.'));

            const count = await AutoReact.countDocuments({ guildId });
            if (count >= 10) return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', 'Server trigger limit reached.', false, 'Maximum is 10 triggers.'));

            try {
                await AutoReact.create({ guildId, trigger, emojis: emojiList });
                deleteCache(`autoreact:${guildId}`);
                return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', `Added trigger \`${trigger}\` with ${emojiList.length} emojis.`));
            } catch (e) {
                return context.reply(result(context.user || context.author, 'AutoReact Result', 'Add Trigger', `Trigger \`${trigger}\` already exists.`, false, 'Duplicate trigger.'));
            }
        }

        if (sub === 'remove') {
            const trigger = (isSlash ? context.options.getString('trigger') : args[1])?.toLowerCase();
            const deleted = await AutoReact.findOneAndDelete({ guildId, trigger });
            if (deleted) deleteCache(`autoreact:${guildId}`);
            return context.reply(
                deleted
                    ? result(context.user || context.author, 'AutoReact Result', 'Remove Trigger', `Removed trigger \`${trigger}\`.`)
                    : result(context.user || context.author, 'AutoReact Result', 'Remove Trigger', `Trigger \`${trigger}\` was not found.`, false, 'Trigger not found.')
            );
        }

        if (sub === 'list') {
            const data = await AutoReact.find({ guildId });
            if (!data.length) return context.reply(result(context.user || context.author, 'AutoReact Result', 'List Triggers', 'No triggers are configured.', false, 'No triggers set.'));
            const embed = new EmbedBuilder()
                .setTitle("Auto-Reaction Triggers")
                .setColor(0x95a5a6)
                .setDescription(data.map(d => `**${d.trigger}**: ${d.emojis.join(' ')}`).join('\n'));
            return context.reply({ embeds: [embed] });
        }

        if (sub === 'reset') {
            await AutoReact.deleteMany({ guildId });
            deleteCache(`autoreact:${guildId}`);
            return context.reply(result(context.user || context.author, 'AutoReact Result', 'Reset Triggers', 'All auto-reaction triggers were reset.'));
        }
    }
};
