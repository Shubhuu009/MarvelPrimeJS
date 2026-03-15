const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'clear',
    aliases: ['purge', 'c'],
    description: 'Clears messages from the current channel with advanced filters.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageMessages],
    botPermissions: [PermissionFlagsBits.ManageMessages],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clears messages from the current channel.')
        .addIntegerOption(opt => 
            opt.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(opt => 
            opt.setName('user')
                .setDescription('Only delete messages from this user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) {
            try {
                await context.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (error) {
                if (error.code === 10062) return;
                throw error;
            }
        }

        const { channel, author } = context;

        // 2. Get Amount
        const amount = isSlash 
            ? context.options.getInteger('amount')
            : parseInt(args[1]) || parseInt(args[0]);

        // 3. Get Target User (optional for slash, for message it's subcommand based)
        const targetUser = isSlash ? context.options.getUser('user') : null;

        if (amount < 1 || amount > 100) {
            return this.failure(context, "Please provide an amount between 1 and 100. 🤔", isSlash);
        }

        try {
            let messages = await channel.messages.fetch({ limit: 100 });
            // Filter out the command message itself if it's a message command
            if (!isSlash) {
                messages = messages.filter(m => m.id !== context.id);
            }

            if (targetUser) {
                messages = messages.filter(m => m.author.id === targetUser.id).first(amount);
            } else {
                messages = messages.first(amount);
            }

            if (messages.length === 0) return this.failure(context, "No matching messages found to clear.", isSlash);

            const deleted = await channel.bulkDelete(messages, true);
            
            const successEmbed = new EmbedBuilder()
                .setTitle("**Purge Result**")
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Clear__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Purge**\n` +
                    `<:Marvel_arrow:1417857492238729289> Cleared **${deleted.size}** messages.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            if (context.guild?.iconURL()) successEmbed.setThumbnail(context.guild.iconURL());

            return isSlash ? context.editReply({ embeds: [successEmbed] }) : context.reply({ embeds: [successEmbed] });
        } catch (err) {
            logger.error(`Purge Error: ${err.message}`);
            return this.failure(context, "Could not purge messages (they might be older than 14 days).", isSlash);
        }
    },

    async failure(context, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Purge Result**")
            .setColor(0xFF0000)
            .setDescription(
                `**__Action : Clear__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Purge**\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    },

    sendHelp(context) {
        const isSlash = context.isChatInputCommand?.();
        const p = process.env.DEFAULT_PREFIX || ".";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ Clear Command Usage")
            .setColor(0x0099ff)
            .setDescription(
                `\`\`\`\n${p}clear <amount>\n${p}clear <amount> @user\n\`\`\``
            );
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
