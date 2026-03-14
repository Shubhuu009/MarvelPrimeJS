const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'glist',
    aliases: ['giveaway-list', 'giveaways'],
    description: 'Lists all ongoing giveaways in the server.',
    category: 'utility',

    data: new SlashCommandBuilder()
        .setName('glist')
        .setDescription('List all active giveaways')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        const { guild } = context;
        const author = context.user || context.author;

        // Fetch all giveaways for this guild that haven't ended yet
        const activeGiveaways = await Giveaway.find({ guildId: guild.id, ended: false });

        if (!activeGiveaways.length) {
            return context.reply(result(author, 'Giveaway Result', 'List Giveaways', 'There are no active giveaways running in this server.', false, 'No active giveaways.'));
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Active Giveaways | ${guild.name}`)
            .setColor(0x00f53d)
            .setFooter({ text: `Total Active: ${activeGiveaways.length}` })
            .setTimestamp();

        // Map through the results to create a clean list
        const list = activeGiveaways.map((g, index) => {
            const isPaused = g.endsAt.getFullYear() === 2099; // Check for pause flag
            const timeDisplay = isPaused ? "⏸️ **Paused**" : `<t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`;
            
            return `**${index + 1}. [${g.prize}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})**\n` +
                   `┕ 👤 **Host:** <@${g.hostId}>\n` +
                   `┕ 👥 **Entries:** \`${g.participants.length}\`\n` +
                   `┕ ⏳ **Ends:** ${timeDisplay}`;
        }).join('\n\n');

        embed.setDescription(list);

        return context.reply({ embeds: [embed] });
    }
};
