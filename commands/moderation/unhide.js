const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unhide',
    description: "Makes a channel visible to the @everyone role.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unhide')
        .setDescription("Makes a channel visible to the @everyone role.")
        .addChannelOption(opt => 
            opt.setName('channel')
                .setDescription('The channel to unhide (default: current channel)'))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for unhiding'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, channel, author } = context;

        // 2. Determine target channel
        const targetChannel = isSlash 
            ? context.options.getChannel('channel') || channel
            : (context.mentions.channels.first() || guild.channels.cache.get(args[0]) || channel);

        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(1).join(' ') || "No reason provided");

        // Logic check: Is it already visible?
        const everyoneRole = guild.roles.everyone;
        const currentPermissions = targetChannel.permissionsFor(everyoneRole);

        if (currentPermissions && currentPermissions.has(PermissionFlagsBits.ViewChannel)) {
            return this.failure(context, targetChannel, "This channel isn't hidden in the first place! 👀", isSlash);
        }

        try {
            // Action: Restore ViewChannel for @everyone
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                ViewChannel: true
            }, { reason: `Unhidden by ${author.username} | ${reason}` });

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Channel Unhide Result**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Unhide__**\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful unhidden**\n` +
                    `<:Marvel_arrow:1417857492238729289> ${targetChannel}\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });

        } catch (err) {
            logger.error(`Unhide Command Error: ${err.message}`);
            return this.failure(context, targetChannel, "An unexpected error occurred while unhiding the channel.", isSlash);
        }
    },

    failure(context, channel, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Channel Unhide Result**")
            .setColor(0xff0000)
            .setDescription(
                `**__Action : Unhide__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful unhide**\n` +
                `<:Marvel_arrow:1417857492238729289> ${channel}\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (context.guild?.iconURL()) embed.setThumbnail(context.guild.iconURL());

        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    },

    sendHelp(context) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = process.env.DEFAULT_PREFIX || ".";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ How to use the Unhide Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}unhide [#channel] [reason]\n\`\`\` \n \`\`\`\n${prefix}unhide 123456789 [reason]\n\`\`\``
            );
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: 64 });
    }
};
