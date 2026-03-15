const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'deafenall',
    description: 'Deafen everyone in your current voice channel.',
    category: 'utility',

    data: new SlashCommandBuilder()
        .setName('deafenall')
        .setDescription('Deafen everyone in your VC')
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),

    async execute(context) {
        const member = context.member;
        const isSlash = context.isChatInputCommand?.();

        if (!member.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            const noPerms = result(isSlash ? context.user : context.author, 'Voice Result', 'VC Deafen All', 'You do not have permission.', false, 'Missing Deafen Members permission.');
            return isSlash ? context.reply({ ...noPerms, flags: 64 }) : context.reply(noPerms);
        }

        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return context.reply(result(isSlash ? context.user : context.author, 'Voice Result', 'VC Deafen All', 'You must be in a voice channel to use this.', false, 'Not connected to voice.'));

        const members = voiceChannel.members.filter(m => !m.user.bot && !m.voice.serverDeaf);
        let count = 0;

        for (const [id, m] of members) {
            await m.voice.setDeaf(true, `Deafen-all by ${member.user.tag}`).catch(() => null);
            count++;
        }

        return context.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00f53d)
                .setDescription(`<:Marvel_Successfully:1417856966352568472> | Deafened **${count}** members in ${voiceChannel.name}.`)]
        });
    }
};
