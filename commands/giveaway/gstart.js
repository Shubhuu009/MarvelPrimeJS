const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const ms = require('ms');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'gstart',
    description: 'Starts a new giveaway.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('gstart')
        .setDescription('Start a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('time').setDescription('Duration (1h, 30m)').setRequired(true))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true))
        .addStringOption(o => o.setName('prize').setDescription('Giveaway prize').setRequired(true)),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const prefix = context.client.prefix;
        
        const timeStr = isSlash ? context.options.getString('time') : args[0];
        const winners = isSlash ? context.options.getInteger('winners') : parseInt(args[1]);
        const prize = isSlash ? context.options.getString('prize') : args.slice(2).join(' ');

        if (!isSlash && (!timeStr || isNaN(winners) || !prize)) {
            const help = new EmbedBuilder()
                .setTitle("🎉 Giveaway Start | Help")
                .setColor(0x95a5a6)
                .setDescription(`**Usage:** \`${prefix}gstart <time> <winners> <prize>\` \n**Example:** \`${prefix}gstart 10m 1 Discord Nitro\``)
                .setFooter({ text: "Time units: s, m, h, d" });
            return context.reply({ embeds: [help] });
        }

        const duration = ms(timeStr);
        if (!duration || duration > ms('31d')) return context.reply(result(context.user || context.author, 'Giveaway Result', 'Start Giveaway', 'Invalid time format.', false, 'Maximum duration is 31 days.'));

        const endsAt = new Date(Date.now() + duration);
        const embed = new EmbedBuilder()
            .setTitle(`🎉 Giveaway: ${prize}`)
            .setDescription(`React with 🎉 to participate!\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n**Winners:** ${winners}\n**Hosted by:** ${context.member}`)
            .setColor(0x00f53d)
            .setTimestamp(endsAt);

        // Send the message without the button component
        const msg = await context.reply({ embeds: [embed], fetchReply: true });

        // Have the bot add the initial reaction
        await msg.react('🎉');

        await Giveaway.create({
            guildId: context.guild.id,
            messageId: msg.id,
            channelId: context.channel.id,
            hostId: isSlash ? context.user.id : context.author.id,
            prize,
            winnersCount: winners,
            endsAt
        });
    }
};
