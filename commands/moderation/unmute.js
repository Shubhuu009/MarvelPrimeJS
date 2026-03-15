const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'unmute',
    aliases: ['untimeout'],
    description: 'Removes a timeout from a member.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Removes a timeout from a member.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to unmute')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for the unmute'))
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
            const msg = result(author, 'Unmute Result', 'Unmute', 'Could not find that member.', false, 'Member lookup failed.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(1).join(' ') || "No reason provided");

        // --- Safety Checks ---
        if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp < Date.now()) {
            return this.failure(context, targetMember.user, "You can't unmute someone who isn't muted! 🤔", isSlash);
        }

        if (author.id !== guild.ownerId && targetMember.roles.highest.position >= member.roles.highest.position) {
            return this.failure(context, targetMember.user, "This member's role is too high for you to manage. 🤷", isSlash);
        }

        // --- Action ---
        let dmSent = false;
        try {
            await targetMember.send(`✅ You have been unmuted in **${guild.name}**. Reason: \`${reason}\``);
            dmSent = true;
        } catch (e) { }

        try {
            // Passing null as the first argument removes the timeout
            await targetMember.timeout(null, `Unmuted by ${author.tag} | ${reason}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Timeout Removed**")
                .setColor(0x00f53d)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setDescription(
                    `**__Action : Unmute__**\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Unmute**\n` +
                    `<:Marvel_arrow:1417857492238729289> \`${targetMember.user.username}\`\n` +
                    `<:marvel_DM:1417874202433683608> **DM Member :** \`${dmSent ? 'Yes' : 'No'}\`\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}\n`
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(err);
            return this.failure(context, targetMember.user, "An unexpected error occurred while unmuting.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const embed = new EmbedBuilder()
            .setTitle("**Unmute Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Unmute__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${context.user?.username || context.author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Unmute**\n` +
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
            .setTitle("⚙️ How to use the Unmute Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}unmute @user [reason]\n\`\`\` \n \`\`\`\n${prefix}unmute 123456789 [reason]\n\`\`\``
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
