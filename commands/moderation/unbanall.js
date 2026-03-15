const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'unbanall',
    description: "Immediately unbans all users from the server.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.BanMembers],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unbanall')
        .setDescription("Immediately unbans all users from the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial "Working..." Embed
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Unbanning all users. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // --- Main Unbanning Logic ---
        let unbannedCount = 0;
        const failedUnbans = [];
        const reason = `Mass unban executed by ${author.username}.`;

        try {
            // Fetch the current ban list
            const banList = await guild.bans.fetch();

            if (banList.size === 0) {
                const noBansEmbed = new EmbedBuilder()
                    .setTitle("**Unban All Result**")
                    .setColor(0xff0000)
                    .setDescription(`**__Action : Unban All__**\n<:marvel_Cross:1417857962688512203> There are no banned users in this server!`)
                    .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) });
                return isSlash ? context.editReply({ embeds: [noBansEmbed] }) : statusMsg.edit({ embeds: [noBansEmbed] });
            }

            for (const [id, banEntry] of banList) {
                try {
                    await guild.bans.remove(banEntry.user.id, reason);
                    unbannedCount++;

                    // 500ms delay to prevent hitting global rate limits (Audit Log limit)
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    failedUnbans.push(`\`${banEntry.user.tag}\``);
                    logger.error(`Failed to unban ${banEntry.user.id}: ${err.message}`);
                }
            }

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 23, limit: 1 }).catch(() => null);

            // --- Final "Marvel" Result Embed ---
            const resultEmbed = new EmbedBuilder()
                .setTitle("**Unban All Result**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Unban All__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Mass Unban Complete**\n` +
                    `<:Marvel_arrow:1417857492238729289> Unbanned **${unbannedCount}** users.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

            if (failedUnbans.length > 0) {
                resultEmbed.addFields({
                    name: "⚠️ Failures",
                    value: `Could not unban:\n${failedUnbans.slice(0, 10).join(', ')}${failedUnbans.length > 10 ? '...' : ''}`,
                    inline: false
                });
            }

            return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });

        } catch (err) {
            logger.error(`UnbanAll Command Error: ${err.message}`);
            const errorMsg = result(author, 'Unban All Result', 'Unban All', 'An error occurred while fetching the ban list.', false, 'Internal error.');
            return isSlash ? context.editReply(errorMsg) : statusMsg.edit(errorMsg);
        }
    }
};
