const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'unban',
    description: "Unbans a user from the server.",
    aliases: ['ub'],
    category: 'moderation',
    permissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription("Unbans a user from the server.")
        .addStringOption(opt => 
            opt.setName('user')
                .setDescription('The user ID to unban')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('reason')
                .setDescription('Reason for unban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const author = isSlash ? context.user : context.author;

        // 2. Get parameters
        const userId = isSlash 
            ? context.options.getString('user')
            : args[0];
            
        const reason = isSlash 
            ? (context.options.getString('reason') || "No reason provided")
            : (args.slice(1).join(' ') || "No reason provided");

        if (!userId) return this.sendHelp(context);

        // Fetch the user object
        const targetUser = await client.users.fetch(userId).catch(() => null);
        if (!targetUser) return this.failure(context, author, `I couldn't find a user with the ID \`${userId}\` 🤷`, isSlash);

        // --- Safety Check: See if the user is actually banned ---
        const banEntry = await guild.bans.fetch(targetUser.id).catch(() => null);
        if (!banEntry) {
            return this.failure(context, targetUser, "This user isn't banned here! 🤔", isSlash);
        }

        // --- Action ---
        let dmSent = false;
        try {
            // Note: DMing a user not in the server is unlikely to succeed unless they have mutual servers/DMs open
            await targetUser.send(`✅ You have been unbanned from **${guild.name}**. Reason: \`${reason}\``);
            dmSent = true;
        } catch (e) { /* DM failed */ }

        try {
            await guild.bans.remove(targetUser.id, `Unbanned by ${author.tag} | ${reason}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 23, limit: 1 }).catch(() => null);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Unban Result**")
                .setColor(0x00f53d)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(
                    `**__Action : Unban__**\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Unban**\n` +
                    `<:Marvel_arrow:1417857492238729289> \`${targetUser.username}\`\n` +
                    `<:marvel_DM:1417874202433683608> **DM Member :** \`${dmSent ? 'Yes' : 'No'}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(`Unban Error: ${err.message}`);
            return this.failure(context, targetUser, "An unexpected error occurred while unbanning.", isSlash);
        }
    },

    failure(context, user, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Unban Result**")
            .setColor(0xff0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `**__Action : Unban__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Unban**\n` +
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
            .setTitle("⚙️ How to use the Unban Command")
            .setColor(0x0099ff)
            .setDescription(
                ` \n \`\`\`\n${prefix}unban <User_ID> [reason]\n\`\`\``
            )
            .setFooter({ text: "Tip: Use the User ID since the user is not in the server." });
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: 64 });
    }
};
