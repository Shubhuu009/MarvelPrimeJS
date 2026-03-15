const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'unmuteall',
    aliases: ['untimeoutall'],
    description: "Immediately removes the timeout from all muted members in the server.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unmuteall')
        .setDescription("Immediately removes the timeout from all muted members in the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial "Working..." Embed
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Unmuting all members. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // --- Main Unmuting Logic ---
        let unmutedCount = 0;
        const failedUnmutes = [];
        const reason = `Mass unmute executed by ${author.username}.`;

        try {
            // Fetch all members to ensure we have the full list
            const allMembers = await guild.members.fetch();

            // Filter only members who are currently timed out
            const mutedMembers = allMembers.filter(m => m.communicationDisabledUntilTimestamp > Date.now());

            if (mutedMembers.size === 0) {
                const noMutesEmbed = new EmbedBuilder()
                    .setTitle("**Unmute All Result**")
                    .setColor(0xff0000)
                    .setDescription("**__Action : Unmute All__**\n<:marvel_Cross:1417857962688512203> No members are currently muted in this server.")
                    .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) });
                return isSlash ? context.editReply({ embeds: [noMutesEmbed] }) : statusMsg.edit({ embeds: [noMutesEmbed] });
            }

            for (const [id, member] of mutedMembers) {
                try {
                    // Setting timeout to null removes the native Discord timeout
                    await member.timeout(null, reason);
                    unmutedCount++;

                    // 500ms delay to prevent global rate limits (Audit Log limit)
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    failedUnmutes.push(member.toString());
                    logger.error(`Failed to unmute ${member.user.tag}: ${err.message}`);
                }
            }

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            // --- Final "Marvel" Result Embed ---
            const resultEmbed = new EmbedBuilder()
                .setTitle("**Unmute All Result**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Unmute All__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Mass Unmute Complete**\n` +
                    `<:Marvel_arrow:1417857492238729289> Unmuted **${unmutedCount}** members.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

            if (failedUnmutes.length > 0) {
                resultEmbed.addFields({
                    name: "⚠️ Failures",
                    value: `Could not unmute:\n${failedUnmutes.slice(0, 10).join(', ')}${failedUnmutes.length > 10 ? '...' : ''}`,
                    inline: false
                });
            }

            return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });

        } catch (err) {
            logger.error(`UnmuteAll Error: ${err.message}`);
            const errorMsg = result(author, 'Unmute All Result', 'Unmute All', 'An unexpected error occurred while fetching members.', false, 'Internal error.');
            return isSlash ? context.editReply(errorMsg) : statusMsg.edit(errorMsg);
        }
    }
};
