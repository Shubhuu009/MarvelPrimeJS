const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'resetnick',
    description: "Resets a member's nickname.",
    aliases: ['rnick', 'clearnick'],
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageNicknames],
    botPermissions: [PermissionFlagsBits.ManageNicknames],
    argsCount: 1, // GLOBAL STRICT MODE: Ignores command if more than 1 arg is provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('resetnick')
        .setDescription("Resets a member's nickname.")
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to reset nickname')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const author = isSlash ? context.user : context.author;

        // 2. Get parameters
        const targetMember = isSlash 
            ? context.options.getMember('member')
            : (context.mentions.members.first() || await guild.members.fetch(args[0]).catch(() => null));

        if (!targetMember) {
            const msg = result(author, 'Reset Nickname Result', 'Reset Nickname', 'Please mention a user or provide a valid ID.', false, 'Invalid member input.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        if (targetMember.id === guild.ownerId) {
            const msg = result(author, 'Reset Nickname Result', 'Reset Nickname', 'The owner nickname cannot be reset.', false, 'Target is the server owner.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }
        if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
            const msg = result(author, 'Reset Nickname Result', 'Reset Nickname', 'They are too powerful for me to manage.', false, 'Role hierarchy.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }
        if (!targetMember.nickname) {
            const msg = result(author, 'Reset Nickname Result', 'Reset Nickname', 'That member does not have a nickname to reset.', false, 'No nickname set.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        const oldDisplayName = targetMember.displayName;

        try {
            await targetMember.setNickname(null, `Nickname reset by ${author.tag}`);

            // Log to Audit Log
            const auditLog = await guild.fetchAuditLogs({ type: 24, limit: 1 }).catch(() => null);

            const embed = new EmbedBuilder()
                .setTitle("**Nickname Reset**")
                .setColor(0x00f53d)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setDescription(
                    `**__Action : Reset Nickname__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Nickname Reset**\n` +
                    `<:Marvel_arrow:1417857492238729289> **Member:** ${targetMember}\n` +
                    `📝 **Old Name:** \`${oldDisplayName}\`\n` +
                    `🏷️ **New Name:** \`${targetMember.user.displayName}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
        } catch (err) {
            logger.error(err);
            const msg = result(author, 'Reset Nickname Result', 'Reset Nickname', 'Failed to reset the nickname.', false, 'Internal error.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }
    }
};
