const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'gpause',
    description: 'Pauses or unpauses a giveaway.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('gpause')
        .setDescription('Pause/Unpause a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('message_id').setDescription('Giveaway ID').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        const messageId = isSlash ? context.options.getString('message_id') : args[0];
        const author = context.user || context.author;

        if (!messageId) {
            const help = new EmbedBuilder()
                .setTitle("⏸️ Giveaway Pause | Help")
                .setColor(0x95a5a6)
                .setDescription(`**Usage:** \`${prefix}gpause <message_id>\``);
            return context.reply({ embeds: [help] });
        }

        const data = await Giveaway.findOne({ messageId });
        if (!data || data.ended) return context.reply(result(author, 'Giveaway Result', 'Pause Giveaway', 'Active giveaway not found.', false, 'Giveaway not found.'));

        const isPaused = data.endsAt.getFullYear() === 2099; // 2099 is used as our "paused" flag

        if (!isPaused) {
            data.pausedTimeLeft = data.endsAt.getTime() - Date.now();
            data.endsAt = new Date("2099-01-01");
            await data.save();
            return context.reply(result(author, 'Giveaway Result', 'Pause Giveaway', 'Giveaway has been paused.'));
        } else {
            data.endsAt = new Date(Date.now() + data.pausedTimeLeft);
            await data.save();
            return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', 'Giveaway has been resumed.'));
        }
    }
};
