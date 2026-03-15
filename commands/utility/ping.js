const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'ping',
    category: 'info',
    description: 'Detailed latency report including Database and Cache.',
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Detailed latency report including Database and Cache.'),
    
    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const client = context.client;
        const user = isSlash ? context.user : context.author;

        try {
            let initialResponse;
            if (isSlash) {
                initialResponse = await context.deferReply({ fetchReply: true });
            } else {
                initialResponse = await context.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('**Ping Result**')
                            .setColor(0x0099ff)
                            .setDescription('⚙️ Measuring system latency...')
                            .setFooter({ text: 'Marvel Development ⚡', iconURL: user.displayAvatarURL({ dynamic: true }) })
                            .setTimestamp()
                    ]
                });
            }

            // 1. Latency Calculations
            const redisStart = Date.now();
            await client.redis.ping();
            const redisLatency = Date.now() - redisStart;

            const dbStart = Date.now();
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.db.admin().ping();
            }
            const dbLatency = mongoose.connection.readyState === 1 ? Date.now() - dbStart : 'N/A';

            const gatewayPing = client.ws.ping;
            const botLatency = initialResponse.createdTimestamp - context.createdTimestamp;

            // 2. UI Configuration (No gaps, inline values)
            let status = gatewayPing <= 100 ? 'Healthy ⚡' : 'High Latency 🐢';
            let color = gatewayPing <= 100 ? 0x00f53d : 0xffa500;

            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `Marvel System Status`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setColor(color)
                .setDescription(
                    `**Overall Status :** \`${status}\`\n` +
                    `**Bot Latency :** \`${botLatency}ms\`\n` +
                    `<:Marvel_Reason:1417815247905095761> **Redis Latency :** \`${redisLatency}ms\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Database Latency :** \`${dbLatency}${typeof dbLatency === 'number' ? 'ms' : ''}\``
                )
                .setFooter({
                    text: "Marvel Hot-Reload ⚡",
                    iconURL: user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // 3. Response Delivery
            if (isSlash) {
                return await context.editReply({ embeds: [embed] });
            } else {
                return await initialResponse.edit({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Ping Command Error:', error);
            const errorMsg = result(user, 'Ping Result', 'System Ping', 'Failed to calculate system latency.', false, 'Internal error.');
            if (isSlash) {
                return context.deferred ? context.editReply(errorMsg) : context.reply(errorMsg);
            }
            return context.reply(errorMsg);
        }
    }
};
