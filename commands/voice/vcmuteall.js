const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcmuteall',
    aliases: ['voice-muteall', 'mutevc-all'],
    category: 'utility',
    description: 'Mutes everyone in your current voice channel.',
    argsCount: 0, // GLOBAL STRICT MODE

    data: new SlashCommandBuilder()
        .setName('vcmuteall')
        .setDescription('Mutes everyone in your current voice channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MuteMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Mute All', 'You do not have permission.', false, 'Missing Mute Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Mute All', 'You must be in a VC to mute someone.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;
        const members = channel.members;
        let count = 0;

        // 3. Execution Phase
        try {
            for (const [id, m] of members) {
                // Skip the bot, the moderator, and those already muted
                if (m.id === client.user.id || m.id === moderator.id || m.voice.serverMute) continue;
                
                // Native Discord Audit Log: Reason is passed here
                await m.voice.setMute(true, `VC Muteall by ${user.username}`).catch(() => null);
                count++;
            }

            // 4. Final Embed (Styled like vcdrag/vckickall)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Mute All\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target Count :** \`${count}\` Members\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Server Muted`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Mute All', 'A fatal error occurred during the mass mute operation.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
