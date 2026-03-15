const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcunlock',
    aliases: ['unlockvc'],
    category: 'utility',
    description: 'Unlocks the voice channel so anyone can join.',
    argsCount: 0, 

    data: new SlashCommandBuilder()
        .setName('vcunlock')
        .setDescription('Unlocks the voice channel so anyone can join.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers), // Standardized for voice utility levels

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MuteMembers) && !moderator.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const noPerms = result(user, 'Voice Result', 'VC Unlock', 'You do not have permission.', false, 'Missing permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Unlock', 'You must be in a VC to unlock it.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const channel = moderator.voice.channel;

        // 3. Execution Phase
        try {
            // Native Discord Audit Log: Reason is passed here
            await channel.permissionOverwrites.edit(guild.roles.everyone, 
                { Connect: null }, // Using 'null' resets the permission to default/neutral
                { reason: `VC Unlock by ${user.username}` }
            );

            // 4. Final Embed (Standardized Marvel Style)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Unlocked\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\` \n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** ${channel.name}\n` +
                    `<:Marvel_arrow:1417857492238729289> **Status :** Open to Everyone`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Unlock', 'A fatal error occurred while unlocking the channel.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
