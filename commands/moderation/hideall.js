const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'hideall',
    description: "Immediately hides all text and voice channels from the @everyone role.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('hideall')
        .setDescription("Immediately hides all text and voice channels from the @everyone role.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial Working Message
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Hiding all visible text and voice channels. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // Main Hiding Logic
        let hiddenCount = 0;
        const failedHides = [];
        const reason = `Mass hide (Text + VC) executed by ${author.username}.`;
        const everyoneRole = guild.roles.everyone;

        // Filter for Text, Voice, and Stage channels currently visible to @everyone
        const channelsToHide = guild.channels.cache.filter(ch =>
            [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type) &&
            ch.permissionsFor(everyoneRole).has(PermissionFlagsBits.ViewChannel)
        );

        for (const [id, channel] of channelsToHide) {
            try {
                // Update permissions for @everyone
                await channel.permissionOverwrites.edit(everyoneRole, {
                    ViewChannel: false
                }, { reason });

                hiddenCount++;

                // 500ms delay to prevent global rate limits (Audit Log limit)
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failedHides.push(channel.toString());
                logger.error(`Failed to hide ${channel.name}: ${err.message}`);
            }
        }

        // Log to Audit Log
        const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

        // Final Result Embed
        const resultEmbed = new EmbedBuilder()
            .setTitle("**Hide All Result**")
            .setColor(0x00f53d)
            .setDescription(
                `**__Action : Hide All__**\n` +
                `<:Marvel_Successfully:1417856966352568472> **Mass Hide Complete**\n` +
                `<:Marvel_arrow:1417857492238729289> Hidden **${hiddenCount}** total channels (Text + VC).\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

        if (failedHides.length > 0) {
            resultEmbed.addFields({
                name: "⚠️ Failures",
                value: `Could not hide:\n${failedHides.slice(0, 10).join(', ')}${failedHides.length > 10 ? '...' : ''}`,
                inline: false
            });
        }

        return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });
    }
};

