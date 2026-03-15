const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unlock',
    description: "Unlocks a channel to allow members to send messages.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription("Unlocks a channel to allow members to send messages.")
        .addChannelOption(opt => 
            opt.setName('channel')
                .setDescription('The channel to unlock (default: current channel)'))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for unlocking'))
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
            
        const everyoneRole = guild.roles.everyone;

        // Logic check: Is it already unlocked?
        const currentPermissions = targetChannel.permissionsFor(everyoneRole);
        if (currentPermissions && currentPermissions.has(PermissionFlagsBits.SendMessages)) {
            return this.failure(context, targetChannel, "This channel isn't locked in the first place! 🤔", isSlash);
        }

        try {
            // Action: Restore SendMessages for @everyone
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: true
            }, { reason: `Unlocked by ${author.username} | ${reason}` });

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Channel Unlock Result**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Unlock__**\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful unlock**\n` +
                    `<:Marvel_arrow:1417857492238729289> ${targetChannel}\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });

        } catch (err) {
            logger.error(`Unlock Command Error: ${err.message}`);
            return this.failure(context, targetChannel, "An unexpected error occurred while unlocking the channel.", isSlash);
        }
    },

    failure(context, channel, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Channel Unlock Result**")
            .setColor(0xff0000)
            .setDescription(
                `**__Action : Unlock__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful unlock**\n` +
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
            .setTitle("⚙️ How to use the Unlock Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}unlock [#channel] [reason]\n\`\`\` \n \`\`\`\n${prefix}unlock 123456789 [reason]\n\`\`\``
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
