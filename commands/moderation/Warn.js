const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const WarnModel = require('../../models/warn');
const logger = require('../../services/logging');

module.exports = {
    name: 'warn',
    description: "Warns a member in the server.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription("Warns a member in the server.")
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to warn')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for warning'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, member, client } = context;
        const author = isSlash ? context.user : context.author;

        // 2. Get parameters
        const targetMember = isSlash 
            ? context.options.getMember('member')
            : (context.mentions.members.first() || await guild.members.fetch(args[0]).catch(() => null));
            
        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(1).join(' ') || "No reason provided");

        if (!targetMember) return this.sendHelp(context);

        // --- Safety Checks ---
        if (targetMember.id === author.id) return this.failure(context, targetMember.user, "You can't warn yourself silly 😂", isSlash);
        if (targetMember.id === client.user.id) return this.failure(context, targetMember.user, "I can't warn myself silly 🤪", isSlash);
        if (targetMember.id === guild.ownerId) return this.failure(context, targetMember.user, "You can't warn the server owner dumb 🤦", isSlash);

        if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
            return this.failure(context, targetMember.user, "They are more powerful than me 💪", isSlash);
        }
        if (author.id !== guild.ownerId && targetMember.roles.highest.position >= member.roles.highest.position) {
            return this.failure(context, targetMember.user, "They have the same or a higher role than you! 🤔", isSlash);
        }

        try {
            // --- Database Action ---
            const docId = `${guild.id}-${targetMember.id}`;
            const data = await WarnModel.findOneAndUpdate(
                { _id: docId },
                { $inc: { warnCount: 1 }, $setOnInsert: { guildId: guild.id, userId: targetMember.id } },
                { upsert: true, returnDocument: 'after' }
            );

            // --- DM Action ---
            let dmSent = false;
            try {
                await targetMember.send(`🚨 You have been warned in **${guild.name}**. You now have **${data.warnCount}** warning(s). Reason: \`${reason}\``);
                dmSent = true;
            } catch (e) { }

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            // --- Success Embed ---
            const successEmbed = new EmbedBuilder()
                .setTitle("**Warn Result**")
                .setColor(0x00f53d)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setDescription(
                    `**__Action : Warn__**\n` +
                    `<:marvel_Time:1417874202433683608> **Total Warns :** \`${data.warnCount}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Warn**\n` +
                    `<:Marvel_arrow:1417857492238729289> \`${targetMember.user.username}\`\n` +
                    `<:marvel_DM:1417874202433683608> **DM Member :** \`${dmSent ? 'Yes' : 'No'}\`\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}\n`
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(err);
            return this.failure(context, targetMember.user, "Database error while processing warn.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Warn Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Warn__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Warn**\n` +
                `<:Marvel_arrow:1417857492238729289> \`${user.username}\`\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    },

    sendHelp(context) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = process.env.DEFAULT_PREFIX || ".";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ How to use the Warn Command")
            .setColor(0x0099ff)
            .setDescription(` \n \`\`\`\n${prefix}warn @user [reason]\n\`\`\` \n \`\`\`\n${prefix}warn 123456789 [reason]\n\`\`\``);
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: 64 });
    }
};
