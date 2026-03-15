const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'membercount',
    aliases: ['mc', 'members', 'memberscount'],
    category: 'info',
    description: 'Shows the total number of members and bots in the server.',
    argsCount: 0, // GLOBAL STRICT MODE: Ignores command if extra text is added

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Shows the total number of members and bots in the server.'),

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        const { guild } = context;
        const user = isSlash ? context.user : context.author;

        try {
            // Optimization: Only fetch if needed, though usually required for accurate bot/human counts
            const allMembers = await guild.members.fetch();
            
            const totalMembers = guild.memberCount;
            const bots = allMembers.filter(member => member.user.bot).size;
            const humans = totalMembers - bots;

            const embed = new EmbedBuilder()
                .setTitle(`**Member Statistics - ${guild.name}**`)
                .setURL("https://discord.gg/9aQBxwVyh7")
                .setColor(0x00f53d)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setDescription(
                    `**__Member Distribution__**\n` +
                    `<:Marvel_Reason:1417815247905095761> **Total Count :** \`${totalMembers}\`\n` +
                    `<:marvel_people:1367483410364371014> **Humans :** \`${humans}\`\n` +
                    `<:marvel_bot:1417931186260414484> **Bots :** \`${bots}\``
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Marvel Development ⚡ | Requested by ${user.username}`, 
                    iconURL: "https://cdn.discordapp.com/attachments/1417463432910995620/1417804459077144659/db7091072edc5ac1ee9ac90a53a1744.gif" 
                });

            return context.reply({ embeds: [embed] });

        } catch (err) {
            logger.error(`MemberCount Error: ${err.message}`);
            return context.reply({ ...result(user, 'Member Count Result', 'Member Count', 'Failed to fetch the member list.', false, 'Internal error.'), flags: 64 });
        }
    }
};
