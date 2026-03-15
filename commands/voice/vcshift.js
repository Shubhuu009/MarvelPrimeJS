const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcshift',
    aliases: ['vcmoveall', 'shiftvc'],
    category: 'utility',
    description: 'Shifts everyone in your current VC to a target VC.',
    argsCount: 1, // STRICT: .vcshift <channel_id>

    data: new SlashCommandBuilder()
        .setName('vcshift')
        .setDescription('Shifts everyone in your current VC into another.')
        .addChannelOption(opt => 
            opt.setName('destination')
                .setDescription('The VC to shift members into')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MoveMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Shift', 'You do not have permission.', false, 'Missing Move Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Check if Moderator is in a VC
        if (!moderator.voice?.channel) {
            const err = result(user, 'Voice Result', 'VC Shift', 'You must be in a VC to shift members.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const sourceChannel = moderator.voice.channel;
        const targetChannel = isSlash 
            ? context.options.getChannel('destination') 
            : guild.channels.cache.get(args[0]?.replace(/[<#>]/g, ''));

        if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) {
            const err = result(user, 'Voice Result', 'VC Shift', 'Please provide a valid voice channel ID.', false, 'Invalid destination.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        if (sourceChannel.id === targetChannel.id) {
            const err = result(user, 'Voice Result', 'VC Shift', 'You are already in that voice channel.', false, 'Same source and destination.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        let count = 0;

        // 3. Execution Phase
        try {
            for (const [id, m] of sourceChannel.members) {
                // Skip the bot itself
                if (m.id === client.user.id) continue;

                // Native Discord Audit Log: Reason is passed here
                await m.voice.setChannel(targetChannel, `VC Shift by ${user.username}`).catch(() => null);
                count++;
            }

            // 4. Final Embed (Styled like vcdrag/vcdragall/vckickall)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Shift\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\` \n` +
                    `<:Marvel_Reason:1417815247905095761> **Count :** \`${count}\` Members Moved\n` +
                    `<:Marvel_arrow:1417857492238729289> **To :** ${targetChannel.name}`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Shift', 'A fatal error occurred during the shift operation.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
