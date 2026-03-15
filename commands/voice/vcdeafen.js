const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcdeafen',
    description: 'Deafen a specific member in a voice channel.',
    category: 'utility',
    argsCount: 1, 

    data: new SlashCommandBuilder()
        .setName('vcdeafen')
        .setDescription('Deafen a specific member')
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers)
        .addUserOption(opt => opt.setName('target').setDescription('Member to deafen').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild, member } = context;

        if (!member.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            const noPerms = result(isSlash ? context.user : context.author, 'Voice Result', 'VC Deafen', 'You do not have permission.', false, 'Missing Deafen Members permission.');
            return isSlash ? context.reply({ ...noPerms, flags: 64 }) : context.reply(noPerms);
        }

        const target = isSlash ? context.options.getMember('target') : context.mentions.members.first() || guild.members.cache.get(args[0]);

        if (!target || !target.voice.channel) return context.reply(result(isSlash ? context.user : context.author, 'Voice Result', 'VC Deafen', 'User is not in a voice channel.', false, 'Invalid target.'));
        
        await target.voice.setDeaf(true, `Deafened by ${isSlash ? context.user.tag : context.author.tag}`);
        
        return context.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00f53d)
                .setDescription(`<:Marvel_Successfully:1417856966352568472> | **${target.user.username}** has been server deafened.`)]
        });
    }
};
