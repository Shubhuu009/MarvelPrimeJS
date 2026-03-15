const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    name: 'uptime',
    category: 'info',
    description: 'Check how long the bot and its services have been online.',
    argsCount: 0, // GLOBAL STRICT MODE: Ignore command if extra text is added

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check how long the bot and its services have been online.'),

    async execute(context) {
        const isSlash = context.isChatInputCommand?.();
        const { client, guild } = context;
        const user = isSlash ? context.user : context.author;

        // 2. Manual Time Calculation (YY/MM/DD/HH/MM/SS)
        let totalSeconds = (client.uptime / 1000);
        
        const years = Math.floor(totalSeconds / 31536000);
        totalSeconds %= 31536000;
        const months = Math.floor(totalSeconds / 2592000);
        totalSeconds %= 2592000;
        const days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);

        // Format: YY/MM/DD/HH/MM/SS (using padStart for leading zeros)
        const formattedUptime = [
            years, months, days, hours, minutes, seconds
        ].map(v => String(v).padStart(2, '0')).join('/');

        // 3. Service Status Check
        const dbConnected = mongoose.connection.readyState === 1;
        const redisStatus = client.redis?.isOpen ? "Operational ✅" : "Offline ❌";

        const embed = new EmbedBuilder()
            .setTitle("**Marvel System Uptime**")
            .setColor(0x00f53d)
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**__Detailed Time__**\n` +
                `<:Marvel_arrow:1417857492238729289> **Format :** \`YY/MM/DD/HH/MM/SS\`\n` +
                `<:Marvel_arrow:1417857492238729289> **Duration :** \`${formattedUptime}\`\n\n` +
                `**__Service Status__**\n` +
                `**Database :** ${dbConnected ? "MongoDB Connected ✅" : "Disconnected ❌"}\n` +
                `**Redis :** ${redisStatus}`
            )
            .setFooter({ 
                text: "Marvel Hot-Reload ⚡", 
                iconURL: user.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        return context.reply({ embeds: [embed] });
    }
};