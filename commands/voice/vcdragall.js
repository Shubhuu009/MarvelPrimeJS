const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'vcdragall',
    aliases: ['vcpullall', 'dragall'],
    category: 'utility',
    description: 'Drags members from a specific VC or the whole server to yours.',
    argsCount: null, // Dynamic: can be 0 or 1

    data: new SlashCommandBuilder()
        .setName('vcdragall')
        .setDescription('Drags members from a specific VC or the whole server to yours.')
        .addChannelOption(opt => 
            opt.setName('from')
                .setDescription('The specific channel to pull from (leave empty for Global Pull)')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers), // Updated to MoveMembers to match vcdrag

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const moderator = context.member;

        // 1. Permission Check
        if (!moderator.permissions.has(PermissionFlagsBits.MoveMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Drag All', 'You do not have permission.', false, 'Missing Move Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Validation: Moderator must be in a destination VC
        if (!moderator.voice.channel) {
            const err = result(user, 'Voice Result', 'VC Drag All', 'You must be in a VC to drag someone.', false, 'Not connected to voice.');
            return isSlash ? context.editReply(err) : context.reply(err);
        }

        const targetChannel = moderator.voice.channel;
        let sourceChannel = null;

        // 3. Logic: Determine if specific channel or Global
        if (isSlash) {
            sourceChannel = context.options.getChannel('from');
        } else if (args && args.length > 0) {
            const channelId = args[0].replace(/[<#>]/g, '');
            sourceChannel = guild.channels.cache.get(channelId);
        }

        let count = 0;
        let mode = "";

        // 4. Execution Phase
        try {
            if (sourceChannel) {
                // TYPE 1: Specific Channel Drag
                if (sourceChannel.id === targetChannel.id) {
                    const err = result(user, 'Voice Result', 'VC Drag All', 'Source and destination channels are the same.', false, 'Invalid destination.');
                    return isSlash ? context.editReply(err) : context.reply(err);
                }

                mode = sourceChannel.name;
                for (const [id, m] of sourceChannel.members) {
                    if (m.id === client.user.id || m.id === moderator.id) continue;
                    await m.voice.setChannel(targetChannel, `VC Dragall by ${user.username}`).catch(() => null);
                    count++;
                }
            } else {
                // TYPE 2: Global Server Pull
                mode = "Global (All VCs)";
                const allVCs = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice && c.id !== targetChannel.id);
                
                for (const [vId, vc] of allVCs) {
                    for (const [mId, m] of vc.members) {
                        if (m.id === client.user.id || m.id === moderator.id) continue;
                        await m.voice.setChannel(targetChannel, `Global Pull by ${user.username}`).catch(() => null);
                        count++;
                    }
                }
            }

            // 5. Final Embed (Styled like vcdrag)
            const embed = new EmbedBuilder()
                .setTitle("**Voice Displacement**")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Action :** VC Drag All\n` +
                    `<:Marvel_moderator:1417818626769027184> **Target Count :** \`${count}\` Members\n` +
                    `<:Marvel_Reason:1417815247905095761> **Mode :** ${mode}\n` +
                    `<:Marvel_arrow:1417857492238729289> **To :** ${targetChannel.name}`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const fail = result(user, 'Voice Result', 'VC Drag All', 'A fatal error occurred during the drag operation.', false, 'Internal error.');
            return isSlash ? context.editReply(fail) : context.reply(fail);
        }
    }
};
