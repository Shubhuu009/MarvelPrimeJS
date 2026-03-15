const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'lockall',
    description: "Immediately locks all unlocked text and voice channels in the server.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('lockall')
        .setDescription("Immediately locks all unlocked text and voice channels in the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial "Working..." Embed
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Locking all unlocked text and voice channels. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // --- Main Locking Logic ---
        let lockedCount = 0;
        const failedLocks = [];
        const reason = `Mass lock (Text + VC) executed by ${author.username}.`;
        const everyoneRole = guild.roles.everyone;

        // Filter for Text, Announcement, Voice, and Stage channels currently unlocked
        const channelsToLock = guild.channels.cache.filter(ch => {
            const isTargetType = [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice
            ].includes(ch.type);

            const perms = ch.permissionsFor(everyoneRole);

            // Check if they can either send messages (Text) or connect (Voice)
            const isUnlocked = perms.has(PermissionFlagsBits.SendMessages) || perms.has(PermissionFlagsBits.Connect);

            return isTargetType && isUnlocked;
        });

        for (const [id, channel] of channelsToLock) {
            try {
                // Determine which permissions to revoke based on channel type
                const overrides = {};
                if (channel.isTextBased()) overrides.SendMessages = false;
                if (channel.isVoiceBased()) overrides.Connect = false;

                // Update permission overwrites
                await channel.permissionOverwrites.edit(everyoneRole, overrides, { reason });

                lockedCount++;

                // 500ms delay to prevent hitting global rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failedLocks.push(channel.toString());
                logger.error(`Failed to lock ${channel.name}: ${err.message}`);
            }
        }

        // Log to Audit Log
        const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

        // --- Final "Marvel" Result Embed ---
        const resultEmbed = new EmbedBuilder()
            .setTitle("**Lock All Result**")
            .setColor(0x00f53d)
            .setDescription(
                `**__Action : Lock All__**\n` +
                `<:Marvel_Successfully:1417856966352568472> **Mass Lock Complete**\n` +
                `<:Marvel_arrow:1417857492238729289> Locked **${lockedCount}** total channels.\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

        if (failedLocks.length > 0) {
            resultEmbed.addFields({
                name: "⚠️ Failures",
                value: `Could not lock:\n${failedLocks.slice(0, 10).join(', ')}${failedLocks.length > 10 ? '...' : ''}`,
                inline: false
            });
        }

        return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });
    }
};

