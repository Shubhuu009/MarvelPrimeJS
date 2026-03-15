const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcunmute',
    aliases: ['voice-unmute', 'vunmute'],
    category: 'utility',
    description: 'Unmutes a member in a voice channel.',
    argsCount: 1, // GLOBAL STRICT MODE

    data: new SlashCommandBuilder()
        .setName('vcunmute')
        .setDescription('Unmutes a member in a voice channel.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to unmute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check (Manual check for Prefix compatibility)
        if (!moderator.permissions.has(PermissionFlagsBits.MuteMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Unmute', 'You do not have permission.', false, 'Missing Mute Members permission.');
            return context.reply(noPerms);
        }

        const target = isSlash 
            ? context.options.getMember('member') 
            : (context.mentions.members.first() || guild.members.cache.get(args[0]));

        // 2. Validation
        if (!target) return context.reply({ ...result(user, 'Voice Result', 'VC Unmute', 'Could not find that member.', false, 'Member lookup failed.'), flags: 64 });

        if (!target.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Unmute', `**${target.user.username}** is not in a voice channel.`, false, 'Invalid target state.');
            return context.reply(err);
        }

        // 3. Execution Phase
        try {
            // Native Discord Audit Log: Reason is passed here
            await target.voice.setMute(false, `VC Unmute by ${user.username}`);

            // 4. Final Embed (Standardized Marvel Style)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** Voice Unmute\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target :** <@${target.id}>\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${target.voice.channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Voice Restored`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Unmute', 'Failed to unmute member. Check my hierarchy or permissions.', false, 'Hierarchy or permission issue.');
            return context.reply(fail);
        }
    }
};
