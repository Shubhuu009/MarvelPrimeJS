const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcunprivate',
    aliases: ['showvc', 'vcpublic'],
    category: 'utility',
    description: 'Shows the voice channel to everyone.',
    argsCount: 0,

    data: new SlashCommandBuilder()
        .setName('vcunprivate')
        .setDescription('Shows the voice channel to everyone.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers), // Standardized for voice utility access

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check (Manual check for Prefix compatibility)
        if (!moderator.permissions.has(PermissionFlagsBits.MuteMembers) && !moderator.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const noPerms = result(user, 'Voice Result', 'VC Public', 'You do not have permission.', false, 'Missing permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Join a VC check
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Public', 'You must be in a VC to make it public.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;

        // 3. Execution Phase
        try {
            // Native Discord Audit Log: Reason is passed here
            // Setting to 'null' reverts to server defaults, 'true' forces visibility
            await channel.permissionOverwrites.edit(guild.roles.everyone, 
                { ViewChannel: null, Connect: null }, 
                { reason: `VC Unprivate by ${user.username}` }
            );

            // 4. Final Embed (Standardized Marvel Style)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Made Public\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\` \n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Visible to Everyone`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Public', 'A fatal error occurred while making the channel public.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
