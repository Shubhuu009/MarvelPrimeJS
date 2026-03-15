const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unhideall',
    aliases: ['showall'],
    description: "Immediately makes all hidden text and voice channels visible to the @everyone role.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unhideall')
        .setDescription("Immediately makes all hidden text and voice channels visible to the @everyone role.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, author } = context;

        // Initial "Working..." Embed
        const workingEmbed = new EmbedBuilder()
            .setTitle("⚙️ Working...")
            .setDescription("Making all hidden channels visible. This may take a moment...")
            .setColor(0x0099ff);

        let statusMsg;
        if (isSlash) {
            statusMsg = await context.editReply({ embeds: [workingEmbed] });
        } else {
            statusMsg = await context.reply({ embeds: [workingEmbed] });
        }

        // --- Main Unhiding Logic ---
        let unhiddenCount = 0;
        const failedUnhides = [];
        const reason = `Mass unhide (Text + VC) executed by ${author.username}.`;
        const everyoneRole = guild.roles.everyone;

        // Filter for Text, Voice, and Stage channels currently hidden from @everyone
        const channelsToUnhide = guild.channels.cache.filter(ch =>
            [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type) &&
            !ch.permissionsFor(everyoneRole).has(PermissionFlagsBits.ViewChannel)
        );

        for (const [id, channel] of channelsToUnhide) {
            try {
                // Restore ViewChannel permission for @everyone
                await channel.permissionOverwrites.edit(everyoneRole, {
                    ViewChannel: true
                }, { reason });

                unhiddenCount++;

                // 500ms delay to prevent hitting global rate limits (Audit Log limit)
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failedUnhides.push(channel.toString());
                logger.error(`Failed to unhide ${channel.name}: ${err.message}`);
            }
        }

        // Log to Audit Log
        const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

        // --- Final "Marvel" Result Embed ---
        const resultEmbed = new EmbedBuilder()
            .setTitle("**Unhide All Result**")
            .setColor(0x00f53d)
            .setDescription(
                `**__Action : Unhide All__**\n` +
                `<:Marvel_Successfully:1417856966352568472> **Mass Unhide Complete**\n` +
                `<:Marvel_arrow:1417857492238729289> Unhidden **${unhiddenCount}** total channels (Text + VC).\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (guild.iconURL()) resultEmbed.setThumbnail(guild.iconURL());

        if (failedUnhides.length > 0) {
            resultEmbed.addFields({
                name: "⚠️ Failures",
                value: `Could not unhide:\n${failedUnhides.slice(0, 10).join(', ')}${failedUnhides.length > 10 ? '...' : ''}`,
                inline: false
            });
        }

        return isSlash ? context.editReply({ embeds: [resultEmbed] }) : statusMsg.edit({ embeds: [resultEmbed] });
    }
};

