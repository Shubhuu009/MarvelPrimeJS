const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcdrag',
    aliases: ['vcpull', 'vcshift'],
    category: 'utility',
    description: 'Drags a member from their current VC to yours.',
    argsCount: 1, // STRICT: .vcdrag <@user>

    data: new SlashCommandBuilder()
        .setName('vcdrag')
        .setDescription('Drags a member to your current voice channel.')
        .addUserOption(opt => opt.setName('member').setDescription('Member to drag').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, member: moderator } = context;
        const user = isSlash ? context.user : context.author;

        if (!moderator.permissions.has(PermissionFlagsBits.MoveMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Drag', 'You do not have permission.', false, 'Missing Move Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        const target = isSlash ? context.options.getMember('member') : (context.mentions.members.first() || guild.members.cache.get(args[0]));

        if (!moderator.voice.channel) {
            const err = result(user, 'Voice Result', 'VC Drag', 'You must be in a VC to drag someone.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        if (!target?.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Drag', 'Target user is not in a voice channel.', false, 'Invalid target state.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const targetChannel = moderator.voice.channel;
        await target.voice.setChannel(targetChannel, `Dragged by ${user.username}`);

        const embed = new EmbedBuilder()
            .setTitle("**Voice Displacement**")
            .setColor(0x00f53d)
            .setDescription(
                `<:Marvel_Successfully:1417856966352568472> **Action :** VC Drag\n` +
                `<:Marvel_moderator:1417818626769027184> **Target :** <@${target.id}>\n` +
                `<:Marvel_Reason:1417815247905095761> **To :** ${targetChannel.name}`
            )
            .setFooter({ text: "Marvel Development ⚡" });

        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    }
};
