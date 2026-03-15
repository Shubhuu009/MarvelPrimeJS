const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const Afk = require('../../models/Afk');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'afk',
    description: 'Set your status to Global AFK.',
    category: 'moderation',
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your status to Global AFK')
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for being AFK')),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const user = isSlash ? context.user : context.author;
        const member = context.member;
        
        // 1. Filter Logic: Block Invites and Mass Pings
        let reason = (isSlash ? context.options.getString('reason') : args.join(' ')) || "I'm AFK -_-";
        const forbidden = ["discord.gg", "discord.com/invite", "gg/", "@everyone", "@here"];
        
        if (forbidden.some(word => reason.toLowerCase().includes(word))) {
            const safetyErr = {
                ...result(user, 'AFK Result', 'Set AFK', 'Your AFK reason contains forbidden content.', false, 'Invites and mass pings are not allowed.'),
                flags: 64
            };
            return isSlash ? context.reply(safetyErr) : context.reply(safetyErr);
        }

        // 2. Database Execution: Global Scope
        // guildIds is set to an empty array or ignored since the check is now global in messageCreate
        await Afk.findOneAndUpdate(
            { userId: user.id },
            { 
                reason: reason, 
                time: Date.now(), 
                mentions: 0 
            },
            { upsert: true }
        );

        // 3. Improved Marvel-Style Embed
        const successEmbed = new EmbedBuilder()
            .setTitle("**Status Displacement**")
            .setColor(0x95a5a6)
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `<:Marvel_Successfully:1417856966352568472> **Action :** Global AFK Set\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}\n` +
                `<:Marvel_arrow:1417857492238729289> **Status :** Watching Mentions`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: context.client.user.displayAvatarURL() })
            .setTimestamp();

        return context.reply({ embeds: [successEmbed] });
    }
};
