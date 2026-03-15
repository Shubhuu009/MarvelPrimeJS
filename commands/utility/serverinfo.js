const { EmbedBuilder, SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'serverinfo',
    aliases: ['sinfo', 'si'],
    description: 'Get detailed information about the server.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get detailed information about the server'),

    async execute(context) {
        try {
            const { guild } = context;
            const client = context.client;

            // Fetch owner as it is not always cached
            const owner = await guild.fetchOwner();

            const embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setAuthor({
                    name: `${guild.name}'s Information`,
                    iconURL: guild.iconURL() || client.user.displayAvatarURL()
                })
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({
                    text: `Requested By ${context.member.user.username}`,
                    iconURL: context.member.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // Use Discord dynamic timestamps
            const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
            
            embed.addFields({
                name: "**__About__**",
                value: `**Name : ** ${guild.name}\n**ID :** ${guild.id}\n**Owner <:owner:1359934594517962884> :** ${owner.user.tag} (${owner})\n**Created At : ** ${createdAt}\n**Members :** ${guild.memberCount}`,
                inline: false
            });

            const channels = guild.channels.cache;
            const roles = guild.roles.cache;
            const emojis = guild.emojis.cache;

            embed.addFields({
                name: "**__General Stats__**",
                value: `**Verification Level :** ${guild.verificationLevel}\n**Channels :** ${channels.size}\n**Roles :** ${roles.size}\n**Emojis :** ${emojis.size}\n**Boost Status :** Level ${guild.premiumTier} (Boosts: ${guild.premiumSubscriptionCount})`,
                inline: false
            });

            // Features section using marvel_tick
            if (guild.features.length > 0) {
                const features = guild.features
                    .map(f => `<:marvel_tick:1407276220793749577>: ${f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, ' ')}`)
                    .join('\n');
                
                embed.addFields({
                    name: "**__Features__**",
                    value: features.length <= 1024 ? features : features.substring(0, 1000) + '...',
                    inline: false
                });
            }

            const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;

            embed.addFields({
                name: "**__Channels__**",
                value: `**Total:** ${channels.size}\n**Channels:** ${textChannels} text, ${voiceChannels} voice`,
                inline: false
            });

            const rolesList = roles.sort((a, b) => b.position - a.position).map(r => r.toString());
            const displayRoles = rolesList.slice(0, 10).join(', ');
            const remaining = rolesList.length > 10 ? ` and ${rolesList.length - 10} more` : '';

            embed.addFields({
                name: `**__Server Roles__ [ ${roles.size} ]**`,
                value: displayRoles + remaining,
                inline: false
            });

            if (guild.bannerURL()) {
                embed.setImage(guild.bannerURL({ size: 1024 }));
            }

            await context.reply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Error in serverinfo command: ${error.stack}`);
            await context.reply({ ...result(context.user || context.author, 'Server Info Result', 'Server Info', 'Failed to fetch server information.', false, 'Internal error.'), flags: MessageFlags.Ephemeral });
        }
    }
};
