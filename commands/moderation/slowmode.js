const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

/**
 * Parses a duration string (e.g., 5s, 10m, 2h) into seconds and a friendly string.
 */
function parseSlowmodeDuration(durationStr) {
    const regex = /^(\d+)([smh])$/i;
    const match = durationStr.match(regex);
    if (!match) return { seconds: null, friendly: null };

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    let seconds = 0;
    let unitStr = "";

    switch (unit) {
        case 's': seconds = value; unitStr = "second"; break;
        case 'm': seconds = value * 60; unitStr = "minute"; break;
        case 'h': seconds = value * 3600; unitStr = "hour"; break;
        default: return { seconds: null, friendly: null };
    }

    // Discord's slowmode limit is 6 hours (21600 seconds)
    if (seconds > 21600) return { seconds: null, friendly: null };

    const friendly = `${value} ${unitStr}${value > 1 ? 's' : ''}`;
    return { seconds, friendly };
}

module.exports = {
    name: 'slowmode',
    aliases: ['sm', 'sl'],
    description: 'Sets slowmode in a channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 3, // GLOBAL STRICT MODE: Ignores command if more than 3 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Sets slowmode in a channel.')
        .addStringOption(opt => 
            opt.setName('duration')
                .setDescription('Duration (e.g., 5s, 10m, 2h)')
                .setRequired(true))
        .addChannelOption(opt => 
            opt.setName('channel')
                .setDescription('The channel to set slowmode in'))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for setting slowmode'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, channel, author } = context;

        // 2. Get parameters
        const durationArg = isSlash 
            ? context.options.getString('duration')
            : args[0];
            
        const targetChannel = isSlash 
            ? context.options.getChannel('channel') || channel
            : (context.mentions.channels.first() || guild.channels.cache.get(args[1]) || channel);
            
        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(2).join(' ') || "No reason provided");

        if (!durationArg) return this.sendHelp(context);

        const { seconds, friendly } = parseSlowmodeDuration(durationArg);
        if (seconds === null) {
            return this.failure(context, targetChannel, "Invalid duration format! Use `5s`, `10m`, or `2h`.\n(Max is 6 hours).", isSlash);
        }

        if (targetChannel.rateLimitPerUser === seconds) {
            return this.failure(context, targetChannel, `The slowmode is already set to \`${friendly}\`! 🐢`, isSlash);
        }

        try {
            await targetChannel.setRateLimitPerUser(seconds, `Slowmode by ${author.username} | Reason: ${reason}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Slowmode Set**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Slowmode__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Slowmode Enabled**\n` +
                    `<:Marvel_arrow:1417857492238729289> ${targetChannel} now has a **${friendly}** delay between messages.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });

        } catch (err) {
            logger.error(`Slowmode Command Error: ${err.message}`);
            return this.failure(context, targetChannel, "An unexpected error occurred while setting slowmode.", isSlash);
        }
    },

    failure(context, channel, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Slowmode Result**")
            .setColor(0xff0000)
            .setDescription(
                `**__Action : Slowmode__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful slowmode**\n` +
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
            .setTitle("⚙️ How to use the Slowmode Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}slowmode <duration> [#channel] [reason]\n\`\`\` \n \`\`\`\n${prefix}slowmode 10m #general spamming\n\`\`\``
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
