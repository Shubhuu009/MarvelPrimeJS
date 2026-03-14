const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'greroll',
    description: 'Rerolls a winner for an ended giveaway.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('greroll')
        .setDescription('Reroll a winner')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('message_id').setDescription('ID of ended giveaway').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        const messageId = isSlash ? context.options.getString('message_id') : args[0];
        const author = context.user || context.author;

        if (!messageId) {
            const help = new EmbedBuilder()
                .setTitle("🔄 Giveaway Reroll | Help")
                .setColor(0x95a5a6)
                .setDescription(`**Usage:** \`${prefix}greroll <message_id>\``);
            return context.reply({ embeds: [help] });
        }

        const data = await Giveaway.findOne({ messageId, guildId: context.guild.id });
        if (!data || !data.ended) return context.reply(result(author, 'Giveaway Result', 'Reroll Giveaway', 'This giveaway has not ended or does not exist.', false, 'Invalid giveaway state.'));
        if (data.participants.length === 0) return context.reply(result(author, 'Giveaway Result', 'Reroll Giveaway', 'No participants found to reroll.', false, 'No participants.'));

        const winner = data.participants[Math.floor(Math.random() * data.participants.length)];
        
        return context.reply({ embeds: [
            new EmbedBuilder()
                .setTitle('**Giveaway Result**')
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Reroll Giveaway__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful**\n` +
                    `<:Marvel_arrow:1417857492238729289> The new winner for **${data.prize}** is <@${winner}>!\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: 'Marvel Development ⚡', iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp()
        ]});
    }
};
