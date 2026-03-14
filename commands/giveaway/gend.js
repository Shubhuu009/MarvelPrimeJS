const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'gend',
    description: 'Ends a giveaway early.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('gend')
        .setDescription('End a giveaway early')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('message_id').setDescription('ID of the giveaway').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        const messageId = isSlash ? context.options.getString('message_id') : args[0];
        const author = context.user || context.author;

        if (!messageId) {
            const help = new EmbedBuilder()
                .setTitle("🛑 Giveaway End | Help")
                .setColor(0x95a5a6)
                .setDescription(`**Usage:** \`${prefix}gend <message_id>\``);
            return context.reply({ embeds: [help] });
        }

        const data = await Giveaway.findOne({ messageId, guildId: context.guild.id });
        if (!data || data.ended) return context.reply(result(author, 'Giveaway Result', 'End Giveaway', 'Active giveaway not found with that ID.', false, 'Giveaway not found.'));

        data.endsAt = new Date(Date.now() - 1000); // Forces the engine to end it
        await data.save();

        return context.reply(result(author, 'Giveaway Result', 'End Giveaway', 'Successfully triggered giveaway end.'));
    }
};
