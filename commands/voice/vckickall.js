const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vckickall',
    aliases: ['voice-kickall', 'kickvc-all'],
    category: 'utility',
    description: 'Disconnects everyone from your current voice channel.',
    argsCount: 0, // GLOBAL STRICT MODE

    data: new SlashCommandBuilder()
        .setName('vckickall')
        .setDescription('Disconnects everyone from your current voice channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers), 

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MoveMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Kick All', 'You do not have permission.', false, 'Missing Move Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Kick All', 'You must be in a VC to kick someone.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;
        const membersToKick = channel.members;
        let count = 0;

        // 3. Execution Phase
        try {
            for (const [id, m] of membersToKick) {
                // Skip the bot and skip users already disconnected
                if (m.id === client.user.id || m.id === moderator.id) continue;
                
                // Native Discord Audit Log: Reason is passed here
                await m.voice.disconnect(`VC Kickall by ${user.username}`).catch(() => null);
                count++;
            }

            // 4. Final Embed (Styled like vcdrag/vcdragall)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Kick All\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target Count :** \`${count}\` Members\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Disconnected`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Kick All', 'A fatal error occurred during the kick operation.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
