const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'undeafenall',
    aliases: ['vundeafenall', 'voice-undeafenall'],
    description: 'Undeafen everyone in your current voice channel.',
    category: 'utility',
    argsCount: 0, // GLOBAL STRICT MODE

    data: new SlashCommandBuilder()
        .setName('undeafenall')
        .setDescription('Undeafen everyone in your current voice channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { client } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Undeafen All', 'You do not have permission.', false, 'Missing Deafen Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Undeafen All', 'You must be in a VC to undeafen someone.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;
        const members = channel.members;
        let count = 0;

        // 3. Execution Phase
        try {
            for (const [id, m] of members) {
                // Skip the bot, the moderator, and those not deafened
                if (m.id === client.user.id || m.id === moderator.id || !m.voice.serverDeaf) continue;
                
                // Native Discord Audit Log: Reason is passed here
                await m.voice.setDeaf(false, `Voice Undeafenall by ${user.username}`).catch(() => null);
                count++;
            }

            // 4. Final Embed (Styled like vcdrag/vckickall/vcmuteall)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Undeafen All\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target Count :** \`${count}\` Members\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Hearing Restored`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Undeafen All', 'A fatal error occurred during the mass undeafen operation.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
