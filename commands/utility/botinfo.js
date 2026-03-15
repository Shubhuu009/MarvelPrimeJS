const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, version, MessageFlags } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'botinfo',
    aliases: ['stats', 'about'],
    description: 'Get detailed technical info about the bot.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Get detailed technical info about the bot'),

    async execute(context) {
        const client = context.client;

        // 1. Gather Bot Stats
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
        const totalEmojis = client.guilds.cache.reduce((acc, g) => acc + g.emojis.cache.size, 0);
        
        const channels = client.channels.cache;
        const txt = channels.filter(c => c.type === 0).size; 
        const vc = channels.filter(c => c.type === 2).size;  

        // 2. System Usage (Native Node.js)
        const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const cpuLoad = os.loadavg()[0].toFixed(2); // 1-minute load average
        const uptime = formatUptime(client.uptime);

        const embed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setAuthor({ 
                name: `Technical Overview: ${client.user.username}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setDescription(
                `**Hey, It's Marvel!** — A Quality Security Bot With Breathtaking Features.\n` +
                `Enhancing security across Discord servers with powerful, blazing-fast protection.`
            )
            .addFields(
                {
                    name: "**📊 Bot Stat(s)**",
                    value: (
                        `**→** Guilds: \`${client.guilds.cache.size}\`\n` +
                        `**→** Users: \`${totalMembers}\`\n` +
                        `**→** Channels: \`${txt}\` text | \`${vc}\` voice\n` +
                        `**→** Emojis: \`${totalEmojis}\`\n`
                    ),
                    inline: false
                },
                {
                    name: "**⚙️ System Usage**",
                    value: (
                        `**→** RAM: \`${ramUsage} MB\`\n` +
                        `**→** CPU Load: \`${cpuLoad}%\`\n` +
                        `**→** Uptime: \`${uptime}\`\n` +
                        `**→** Node: \`${process.version}\``
                    ),
                    inline: true
                }
            )
            .setFooter({ text: "Marvel Development ⚡" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Support")
                .setStyle(ButtonStyle.Link)
                .setURL("https://discord.gg/marvel-dev"),
            new ButtonBuilder()
                .setLabel("Invite")
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        );

        await context.reply({ embeds: [embed], components: [row] });
    }
};

function formatUptime(ms) {
    let s = ms / 1000;
    let d = Math.floor(s / 86400);
    s %= 86400;
    let h = Math.floor(s / 3600);
    s %= 3600;
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return `${d}d ${h}h ${m}m ${sec}s`;
}