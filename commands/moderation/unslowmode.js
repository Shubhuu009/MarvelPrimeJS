const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unslowmode',
    aliases: ['usm', 'unsl'],
    description: 'Disables slowmode in a channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 1, // GLOBAL STRICT MODE: Ignores command if more than 1 arg is provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unslowmode')
        .setDescription('Disables slowmode in a channel.')
        .addChannelOption(opt => 
            opt.setName('channel')
                .setDescription('The channel to disable slowmode in'))
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

        // Logic check: Is slowmode already disabled?
        if (targetChannel.rateLimitPerUser === 0) {
            return this.failure(context, targetChannel, "The channel is already as speedy as it gets! 🏎️", isSlash);
        }

        try {
            // Action: Set rate limit to 0 (disabled)
            await targetChannel.setRateLimitPerUser(0, `Unslowmode by ${author.username}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Slowmode Removed**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Unslowmode__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Slowmode Disabled**\n` +
                    `<:Marvel_arrow:1417857492238729289> Normal chat speed has been restored in ${targetChannel}.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });

        } catch (err) {
            logger.error(`Unslowmode Command Error: ${err.message}`);
            return this.failure(context, targetChannel, "An unexpected error occurred while removing slowmode.", isSlash);
        }
    },

    failure(context, channel, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Unslowmode Result**")
            .setColor(0xff0000)
            .setDescription(
                `**__Action : Unslowmode__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Unslowmode**\n` +
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
            .setTitle("⚙️ How to use the Unslowmode Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}unslowmode [#channel]\n\`\`\` \n \`\`\`\n${prefix}unslowmode 123456789\n\`\`\``
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
