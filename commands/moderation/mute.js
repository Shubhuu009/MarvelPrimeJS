const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

/**
 * Helper to parse duration strings (e.g., 10m, 1h, 5d)
 * Returns milliseconds and a friendly string.
 */
function parseDuration(durationStr) {
    const regex = /^(\d+)([mhd])$/i;
    const match = durationStr.match(regex);
    if (!match) return { ms: null, friendly: null };

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    let ms = 0;
    let unitStr = "";

    switch (unit) {
        case 'm': ms = value * 60000; unitStr = "minute"; break;
        case 'h': ms = value * 3600000; unitStr = "hour"; break;
        case 'd': ms = value * 86400000; unitStr = "day"; break;
        default: return { ms: null, friendly: null };
    }

    if (ms > 2419200000) return { ms: null, friendly: null }; // Max 28 days

    const friendly = `${value} ${unitStr}${value > 1 ? 's' : ''}`;
    return { ms, friendly };
}

module.exports = {
    name: 'mute',
    aliases: ['timeout', 'stfu'],
    description: 'Mutes a member for a specified duration.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
    argsCount: 3, // GLOBAL STRICT MODE: Ignores command if more than 3 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mutes a member for a specified duration.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to mute')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('duration')
                .setDescription('Duration (e.g., 10m, 1h, 5d)')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for the mute'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, member, client } = context;
        const author = isSlash ? context.user : context.author;

        // 2. Fetch Target Member
        const targetMember = isSlash 
            ? context.options.getMember('member') 
            : (context.mentions.members.first() || await guild.members.fetch(args[0]).catch(() => null));

        if (!targetMember) {
            const msg = result(author, 'Mute Result', 'Mute', 'Could not find that member.', false, 'Member lookup failed.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        // Logic: <user> [duration] [reason...]
        const durationArg = isSlash 
            ? context.options.getString('duration')
            : (args[1] || "24h");
        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(2).join(' ') || "No reason provided");

        const { ms, friendly } = parseDuration(durationArg);
        if (!ms) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("⚙️ Invalid Duration Format")
                .setDescription("Please use a valid format for the duration.\nThe maximum duration is **28 days**.")
                .setColor(0x0099ff)
                .addFields({ name: "Examples:", value: "`10m` (10 minutes)\n`1h` (1 hour)\n`5d` (5 days)" });
            return isSlash ? context.editReply({ embeds: [errorEmbed] }) : context.reply({ embeds: [errorEmbed] });
        }

        // --- Safety Checks ---
        if (targetMember.id === author.id) return this.failure(context, targetMember.user, "You can't mute yourself silly 😂", isSlash);
        if (targetMember.id === client.user.id) return this.failure(context, targetMember.user, "I can't mute myself silly 🤪", isSlash);
        if (targetMember.id === guild.ownerId) return this.failure(context, targetMember.user, "You can't mute the server owner dumb 🤦", isSlash);

        if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
            return this.failure(context, targetMember.user, "They are more powerful than me 💪", isSlash);
        }
        if (author.id !== guild.ownerId && targetMember.roles.highest.position >= member.roles.highest.position) {
            return this.failure(context, targetMember.user, "They have the same or a higher role than you! 🤔", isSlash);
        }
        if (targetMember.communicationDisabledUntilTimestamp > Date.now()) {
            return this.failure(context, targetMember.user, "They are already muted 🤫", isSlash);
        }

        // --- Action ---
        let dmSent = false;
        try {
            await targetMember.send(`🚨 You have been muted in **${guild.name}** for **${friendly}**. Reason: \`${reason}\``);
            dmSent = true;
        } catch (e) { }

        try {
            await targetMember.timeout(ms, `Muted by ${author.tag} | ${reason}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Timeout Result**")
                .setColor(0x00f53d)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setDescription(
                    `**__Action : Mute__**\n` +
                    `<:marvel_Time:1417874202433683608> **Duration :** \`${friendly}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Timeout**\n` +
                    `<:Marvel_arrow:1417857492238729289> \`${targetMember.user.username}\`\n` +
                    `<:marvel_DM:1417874202433683608> **DM Member :** \`${dmSent ? 'Yes' : 'No'}\`\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(err);
            return this.failure(context, targetMember.user, "An unexpected error occurred while muting.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const embed = new EmbedBuilder()
            .setTitle("**Timeout Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Mute__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${context.user?.username || context.author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Timeout**\n` +
                `<:Marvel_arrow:1417857492238729289> \`${user.username}\`\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: (context.user || context.author).displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    },

    sendHelp(context) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = process.env.DEFAULT_PREFIX || ".";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ How to use the Mute Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}mute @user [duration] [reason]\n\`\`\` \n \`\`\`\n${prefix}mute 123456789 [duration] [reason]\n\`\`\``
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
