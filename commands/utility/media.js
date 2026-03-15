const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const Media = require('../../models/Media');
const { deleteCache } = require('../../services/runtime');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'media',
    description: 'Manage media-only channels.',
    data: new SlashCommandBuilder()
        .setName('media')
        .setDescription('Manage media-only channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('setup').setDescription('Set media channel').addChannelOption(o => o.setName('channel').setDescription('The text channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove media channel'))
        .addSubcommandGroup(g => g.setName('bypass').setDescription('Bypass list')
            .addSubcommand(s => s.setName('add').setDescription('Add user').addUserOption(o => o.setName('user').setDescription('User to bypass').setRequired(true)))
            .addSubcommand(s => s.setName('clear').setDescription('Clear list'))
            .addSubcommand(s => s.setName('show').setDescription('Show list'))),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const sub = isSlash ? context.options.getSubcommand() : args[0]?.toLowerCase();
        const subGroup = isSlash ? context.options.getSubcommandGroup() : null;
        const guildId = context.guild.id;

        if (!sub) {
            const help = new EmbedBuilder()
                .setTitle("**Marvel | Media System**")
                .setColor(0x95a5a6)
                .addFields({ name: "📝 Commands", value: `\`setup\`, \`remove\`, \`bypass add/show/clear\`` });
            return context.reply({ embeds: [help] });
        }

        if (sub === 'setup') {
            const channel = isSlash ? context.options.getChannel('channel') : context.mentions.channels.first();
            await Media.findOneAndUpdate({ guildId }, { channelId: channel.id }, { upsert: true });
            deleteCache(`media:${guildId}`);
            return context.reply(result(context.user || context.author, 'Media Result', 'Setup', `<#${channel.id}> is now media-only.`));
        }

        if (subGroup === 'bypass' || sub === 'bypass') {
            const bypassSub = isSlash ? context.options.getSubcommand() : args[1]?.toLowerCase();
            let data = await Media.findOne({ guildId }) || await Media.create({ guildId });

            if (bypassSub === 'add') {
                const user = isSlash ? context.options.getUser('user') : context.mentions.users.first();
                if (!data.bypassedUsers.includes(user.id)) {
                    data.bypassedUsers.push(user.id);
                    await data.save();
                }
                deleteCache(`media:${guildId}`);
                return context.reply(result(context.user || context.author, 'Media Result', 'Bypass Add', `Bypassed **${user.username}**.`));
            }

            if (bypassSub === 'clear') {
                data.bypassedUsers = [];
                await data.save();
                deleteCache(`media:${guildId}`);
                return context.reply(result(context.user || context.author, 'Media Result', 'Bypass Clear', 'Bypass list cleared.'));
            }

            if (bypassSub === 'show') {
                const list = data.bypassedUsers.map(id => `<@${id}>`).join('\n') || "None";
                return context.reply({ embeds: [new EmbedBuilder().setTitle("Bypass List").setDescription(list).setColor(0x95a5a6)] });
            }
        }
    }
};
