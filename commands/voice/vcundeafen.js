const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'undeafen',
    aliases: ['vundeafen', 'voice-undeafen'],
    description: 'Undeafen a specific member in a voice channel.',
    category: 'utility',
    argsCount: 1,

    data: new SlashCommandBuilder()
        .setName('undeafen')
        .setDescription('Undeafen a specific member')
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers)
        .addUserOption(opt => opt.setName('target').setDescription('Member to undeafen').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check (Manual check for Prefix compatibility)
        if (!moderator.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Undeafen', 'You do not have permission.', false, 'Missing Deafen Members permission.');
            return isSlash ? context.reply(noPerms) : context.reply(noPerms);
        }

        const target = isSlash 
            ? context.options.getMember('target') 
            : (context.mentions.members.first() || guild.members.cache.get(args[0]));

        // 2. Validation
        if (!target) return context.reply({ ...result(user, 'Voice Result', 'VC Undeafen', 'Could not find that member.', false, 'Member lookup failed.'), flags: 64 });

        if (!target.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Undeafen', `**${target.user.username}** is not in a voice channel.`, false, 'Invalid target state.');
            return context.reply(err);
        }

        // 3. Execution Phase
        try {
            // Native Discord Audit Log: Reason is passed here
            await target.voice.setDeaf(false, `Voice Undeafen by ${user.username}`);

            // 4. Final Embed (Standardized Marvel Style)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** Voice Undeafen\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target :** <@${target.id}>\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${target.voice.channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Hearing Restored`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Undeafen', 'Failed to undeafen member. Check my hierarchy or permissions.', false, 'Hierarchy or permission issue.');
            return context.reply(fail);
        }
    }
};
