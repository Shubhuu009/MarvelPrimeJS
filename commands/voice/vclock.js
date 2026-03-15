const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vclock',
    aliases: ['lockvc'],
    category: 'utility',
    description: 'Locks the voice channel so no one can join.',
    argsCount: 0, 

    data: new SlashCommandBuilder()
        .setName('vclock')
        .setDescription('Locks the voice channel so no one can join.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers), // Updated to match voice utility levels

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MuteMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Lock', 'You do not have permission.', false, 'Missing permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Lock', 'You must be in a VC to lock it.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;

        // 3. Execution Phase
        try {
            // Native Discord Audit Log: Reason is passed here
            await channel.permissionOverwrites.edit(guild.roles.everyone, 
                { Connect: false }, 
                { reason: `VC Lock by ${user.username}` }
            );

            // 4. Final Embed (Styled like vcdrag/vckickall)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Locked\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\` \n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Private`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Lock', 'A fatal error occurred while locking the channel.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
