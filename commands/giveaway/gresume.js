const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Giveaway = require('../../models/Giveaway'); // Ensure this model exists
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'gresume',
    description: 'Resume a paused giveaway.',
    category: 'giveaway',
    data: new SlashCommandBuilder()
        .setName('gresume')
        .setDescription('Resume a paused giveaway')
        .addStringOption(option => 
            option.setName('message_id')
                .setDescription('The ID of the giveaway message to resume')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const messageId = isSlash ? context.options.getString('message_id') : args[0];
        const guildId = context.guild.id;
        const author = context.user || context.author;

        if (!messageId) {
            return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', 'Please provide the giveaway message ID.', false, 'Missing message ID.'));
        }

        try {
            // 1. Fetch the giveaway from the database
            const giveawayData = await Giveaway.findOne({ guildId, messageId });

            if (!giveawayData) {
                return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', 'No giveaway found with that message ID.', false, 'Giveaway not found.'));
            }

            // 2. Check if it is already running or already ended
            if (!giveawayData.paused) {
                return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', `**${giveawayData.prize}** is not paused.`, false, 'Giveaway is already active.'));
            }

            if (giveawayData.ended) {
                return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', `**${giveawayData.prize}** has already ended.`, false, 'Giveaway already ended.'));
            }

            // 3. Logic to update status and resume timer
            giveawayData.paused = false;
            await giveawayData.save();

            // 4. Update the actual Discord message to show it is active again
            const channel = context.guild.channels.cache.get(giveawayData.channelId);
            if (channel) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    const embed = EmbedBuilder.from(message.embeds[0])
                        .setColor(0x95a5a6) // Marvel Theme
                        .setFooter({ text: "Giveaway is active! Ends at:" });
                    
                    await message.edit({ embeds: [embed] });
                }
            }

            return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', `Successfully resumed the giveaway for **${giveawayData.prize}**.`));

        } catch (error) {
            logger.error(`Error in gresume: ${error.message}`);
            return context.reply(result(author, 'Giveaway Result', 'Resume Giveaway', 'Failed to resume the giveaway.', false, 'Internal error.'));
        }
    }
};
