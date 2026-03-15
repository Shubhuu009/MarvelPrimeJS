const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'voice-kick',
    aliases: ['vkick', 'vckick'],
    category: 'utility',
    description: 'Removes a user from the voice channel.',
    argsCount: 1, // GLOBAL STRICT MODE: Ignores command if more than 1 arg is provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('voice-kick')
        .setDescription('Removes a user from the voice channel.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to disconnect')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers), 

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { guild, member } = context;
        const user = isSlash ? context.user : context.author;

        if (!member.permissions.has(PermissionFlagsBits.MoveMembers)) {
            const noPerms = result(user, 'Voice Result', 'VC Kick', 'You do not have permission.', false, 'Missing Move Members permission.');
            return isSlash ? context.editReply(noPerms) : context.reply(noPerms);
        }

        // 2. Fetch Target Member
        const target = isSlash 
            ? context.options.getMember('member') 
            : (context.mentions.members.first() || guild.members.cache.get(args[0]));

        // 3. Validation Checks
        if (!target) {
            const msg = result(user, 'Voice Result', 'VC Kick', 'Could not find that member.', false, 'Member lookup failed.');
            return isSlash ? context.editReply(msg) : context.reply(msg);
        }

        if (!target.voice?.channel) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("**Voice Error**")
                .setColor(0xff0000)
                .setDescription(
                    `<:marvel_Cross:1417857962688512203> **Status :** Failed\n` +
                    `<:Marvel_Reason:1417815247905095761> **Reason :** **${target.user.username}** is not in a VC.`
                )
                .setFooter({ text: "Marvel Development ⚡" });

            return isSlash ? context.editReply({ embeds: [errorEmbed] }) : context.reply({ embeds: [errorEmbed] });
        }

        // 4. Action: Disconnect from Voice
        const channelName = target.voice.channel.name;
        try {
            await target.voice.disconnect(`Voice-kick by ${user.username}`);

            const embed = new EmbedBuilder()
                .setTitle("**Voice Management**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Disconnect__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Target :** <@.${target.id}>\n` +
                    `<:Marvel_Reason:1417815247905095761> **Channel :** \`${channelName}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });

        } catch (err) {
            const failMsg = result(user, 'Voice Result', 'VC Kick', 'I do not have permission to disconnect this user.', false, 'Hierarchy or permission issue.');
            return isSlash ? context.editReply(failMsg) : context.reply(failMsg);
        }
    }
};
