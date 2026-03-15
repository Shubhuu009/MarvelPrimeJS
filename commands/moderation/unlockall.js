const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unlockall',
    description: "Immediately unlocks all locked text and voice channels in the server.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unlockall')
        .setDescription("Immediately unlocks all locked text and voice channels in the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial "Working..." Embed
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Unlocking all locked text and voice channels. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // --- Main Unlocking Logic ---
        let unlockedCount = 0;
        const failedUnlocks = [];
        const reason = `Mass unlock (Text + VC) executed by ${author.username}.`;
        const everyoneRole = guild.roles.everyone;

        // Filter for Text, Announcement, Voice, and Stage channels currently locked
        const channelsToUnlock = guild.channels.cache.filter(ch => {
            const isTargetType = [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice
            ].includes(ch.type);

            const perms = ch.permissionsFor(everyoneRole);

            // Check if they are restricted from either sending messages or connecting
            const isLocked = !perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.Connect);

            return isTargetType && isLocked;
        });

        for (const [id, channel] of channelsToUnlock) {
            try {
                // Restore permissions based on channel functionality
                const overrides = {};
                if (channel.isTextBased()) overrides.SendMessages = true;
                if (channel.isVoiceBased()) overrides.Connect = true;

                // Update permission overwrites for @everyone
                await channel.permissionOverwrites.edit(everyoneRole, overrides, { reason });

                unlockedCount++;

                // 500ms delay to respect Discord's Audit Log rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failedUnlocks.push(channel.toString());
                logger.error(`Failed to unlock ${channel.name}: ${err.message}`);
            }
        }

        // Log to Audit Log
        const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

        // --- Final "Marvel" Result Embed ---
        const resultEmbed = new EmbedBuilder()
            .setTitle("**Unlock All Result**")
            .setColor(0x00f53d)
            .setDescription(
                `**__Action : Unlock All__**\n` +
                `<:Marvel_Successfully:1417856966352568472> **Mass Unlock Complete**\n` +
                `<:Marvel_arrow:1417857492238729289> Unlocked **${unlockedCount}** total channels.\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

        if (failedUnlocks.length > 0) {
            resultEmbed.addFields({
                name: "⚠️ Failures",
                value: `Could not unlock:\n${failedUnlocks.slice(0, 10).join(', ')}${failedUnlocks.length > 10 ? '...' : ''}`,
                inline: false
            });
        }

        return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });
    }
};

