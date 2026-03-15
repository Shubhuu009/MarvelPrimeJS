const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const PrefixModel = require('../../models/Prefix'); 
const logger = require('../../services/logging');
const { deleteCache, safeRedisDel } = require('../../services/runtime');
const { usage } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'setprefix',
    aliases: ['prefix'],
    description: "Changes the bot's prefix for this server.",
    category: 'moderation',
    // 1. Data property for Global Slash Registration
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription("Changes the bot's prefix for this server.")
        .addStringOption(option => 
            option.setName('new_prefix')
                .setDescription('The new prefix (max 5 characters)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false), // Security: Disable in DMs

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const member = context.member;
        
        // 2. Hybrid Extraction
        const newPrefix = isSlash ? context.options.getString('new_prefix') : args[0];

        // 3. Permission Check (Security Engineering)
        const isOwner = client.ownerIds.includes(user.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAdmin && !isOwner) {
            return this.failure(context, "You need **Administrator** permissions to change the prefix. 🛡️", isSlash);
        }

        // 4. Input Validation
        if (!newPrefix) return this.sendHelp(context, isSlash);
        if (newPrefix.length > 5) {
            return this.failure(context, "Keep the prefix under 5 characters. 😉", isSlash);
        }

        try {
            // 5. Database & Cache Synchronization
            await PrefixModel.findOneAndUpdate(
                { guildId: guild.id },
                { prefix: newPrefix },
                { upsert: true, returnDocument: 'after', lean: true }
            );

            // Safety: Only call redis if client.redis exists
            if (client.redis) {
                await safeRedisDel(client.redis, `prefix:${guild.id}`);
            }
            deleteCache(`prefix:${guild.id}`);

            const successEmbed = new EmbedBuilder()
                .setTitle("**Prefix Set Result**")
                .setURL("https://discord.gg/9aQBxwVyh7")
                .setColor(0x00f53d)
                .setDescription(
                    `<:Marvel_Successfully:1417856966352568472> **Prefix Updated**\n` +
                    `<:Marvel_arrow:1417857492238729289> **New Prefix :** \`${newPrefix}\`\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\``
                )
                .setFooter({ 
                    text: "Marvel Development ⚡", 
                    iconURL: "https://cdn.discordapp.com/attachments/1417463432910995620/1417804459077144659/db7091072edc5ac1ee9ac90a53a1744.gif" 
                })
                .setTimestamp();

            if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

            // 6. Responsive Delivery
            return context.reply({ embeds: [successEmbed] });

        } catch (err) {
            logger.error(`SetPrefix Error: ${err.stack}`);
            return this.failure(context, "Database update failed. 😬", isSlash);
        }
    },

    failure(context, reason, isSlash) {
        const user = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Set Prefix Result**")
            .setColor(0xFF0000)
            .setDescription(
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Prefix Change**\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡" });
            
        return context.reply({ embeds: [embed], ...(isSlash ? { flags: 64 } : {}) });
    },

    sendHelp(context, isSlash) {
        const currentPrefix = context.client.prefix || '!';
        return context.reply({ ...usage(context.user || context.author, 'Set Prefix Usage', `Usage: \`${currentPrefix}setprefix <new_prefix>\``), ...(isSlash ? { flags: 64 } : {}) });
    }
};
