const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'ban',
    description: 'Bans a user from the server.',
    aliases: ['b'],
    category: 'moderation',
    permissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a member from the server.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, member, client } = context;
        const user = isSlash ? context.user : context.author;
        const author = isSlash ? context.user : context.author;

        // 2. Fetch Target Member
        const target = isSlash 
            ? context.options.getUser('member') 
            : (context.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null));

        if (!target) {
            const msg = result(author, 'Ban Result', 'Ban', 'Could not find that user.', false, 'User lookup failed.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(1).join(' ') || "No reason provided");

        // Safety Checks
        if (target.id === author.id) return this.failure(context, target, "You can't ban yourself silly 😂", isSlash);
        if (target.id === client.user.id) return this.failure(context, target, "I can't ban myself silly 🤪", isSlash);
        if (target.id === guild.ownerId) return this.failure(context, target, "You can't ban the server owner dumb 🤦", isSlash);

        const targetMember = await guild.members.fetch(target.id).catch(() => null);

        if (targetMember) {
            if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
                return this.failure(context, target, "They are more powerful than me 💪", isSlash);
            }
            if (author.id !== guild.ownerId && targetMember.roles.highest.position >= member.roles.highest.position) {
                return this.failure(context, target, "They have the same or a higher role than you! 🤔", isSlash);
            }
        }

        let dmSent = false;
        try {
            await target.send(`🚨 You have been banned from **${guild.name}** | Reason: \`${reason}\``);
            dmSent = true;
        } catch (e) { }

        try {
            await guild.members.ban(target, { reason: `Banned by ${author.tag} | ${reason}` });

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 22, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Ban Result**")
                .setColor(0x00f53d)
                .setThumbnail(target.displayAvatarURL())
                .setDescription(
                    `**__Action : Ban__**\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Ban**\n` +
                    `<:Marvel_arrow:1417857492238729289> \`${target.username}\`\n` +
                    `<:marvel_DM:1417874202433683608> **DM Member :** \`${dmSent ? 'Yes' : 'No'}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(err);
            return this.failure(context, target, "An unexpected error occurred while banning.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const embed = new EmbedBuilder()
            .setTitle("**Ban Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Ban__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${context.user?.username || context.author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Ban**\n` +
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
            .setTitle("⚙️ How to use the Ban Command")
            .setColor(120000)
            .setDescription(
                ` \n \`\`\`\n${prefix}ban @user [reason]\n\`\`\` \n \`\`\`\n${prefix}ban 123456789 [reason]\n\`\`\``
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
