const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'nick',
    description: "Changes a member's nickname.",
    aliases: ['nickname', 'setnick'],
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageNicknames],
    botPermissions: [PermissionFlagsBits.ManageNicknames],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription("Changes a member's nickname.")
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to change nickname')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('nickname')
                .setDescription('The new nickname')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

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
            
        const newNickname = isSlash 
            ? context.options.getString('nickname')
            : args.slice(1).join(' ');

        if (!targetMember || !newNickname) return this.sendHelp(context);

        // --- Safety Checks ---
        if (targetMember.id === guild.ownerId) return this.failure(context, targetMember.user, "Even I can't change the boss's name! 👑", isSlash);
        if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
            return this.failure(context, targetMember.user, "They're too powerful for me to nickname! 💪", isSlash);
        }
        if (author.id !== guild.ownerId && targetMember.roles.highest.position >= member.roles.highest.position) {
            return this.failure(context, targetMember.user, "You can't change the nickname of someone with a higher or equal role! 🤔", isSlash);
        }
        if (newNickname.length > 32) return this.failure(context, targetMember.user, "That nickname is too long! Keep it under 32 characters. 📏", isSlash);

        const oldDisplayName = targetMember.displayName;

        try {
            await targetMember.setNickname(newNickname, `Nickname changed by ${author.tag}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Nickname Changed**")
                .setColor(0x00f53d)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setDescription(
                    `**__Action : Nickname__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Nickname Change**\n` +
                    `<:Marvel_arrow:1417857492238729289> **Member:** ${targetMember}\n` +
                    `📝 **Old Name:** \`${oldDisplayName}\`\n` +
                    `🏷️ **New Name:** \`${newNickname}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(err);
            return this.failure(context, targetMember.user, "An unexpected error occurred.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Nickname Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Nickname__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Nickname Change**\n` +
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
            .setTitle("⚙️ How to use the Nick Command")
            .setColor(0x0099ff)
            .setDescription(` \n \`\`\`\n${prefix}nick @user <new nickname>\n\`\`\` \n \`\`\`\n${prefix}nick 123456789 <new nickname>\n\`\`\``);
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: 64 });
    }
};
