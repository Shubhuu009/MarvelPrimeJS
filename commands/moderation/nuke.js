const {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const logger = require('../../services/logging');

module.exports = {
    name: 'nuke',
    description: "Clones and replaces a channel, effectively clearing all messages.",
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    argsCount: 0, // GLOBAL STRICT MODE: No args allowed

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription("Clones and replaces a channel, effectively clearing all messages.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) await context.deferReply({ flags: 64 });

        const { channel, guild } = context;
        const author = isSlash ? context.user : context.author;

        // --- Confirmation UI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle("⚠️ Confirmation Required")
            .setDescription(`Are you sure you want to nuke ${channel}?\n**This will delete all messages and cannot be undone.**`)
            .setColor(0xFFA500)
            .setFooter({ text: "This will time out in 30 seconds." });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_nuke')
                .setLabel('Yes, nuke it')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_nuke')
                .setLabel('No, cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        let response;
        if (isSlash) {
            response = await context.editReply({ embeds: [confirmEmbed], components: [row] });
        } else {
            response = await context.reply({ embeds: [confirmEmbed], components: [row] });
        }

        // --- Interaction Collector ---
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === author.id,
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'cancel_nuke') {
                await this.failure(interaction, channel, "Operation cancelled by user. ❌", true);
                return collector.stop();
            }

            if (interaction.customId === 'confirm_nuke') {
                try {
                    const position = channel.position;
                    const reason = `Channel nuked by ${author.username}`;

                    // Clone the channel
                    const newChannel = await channel.clone({ reason });

                    // Set correct position
                    await newChannel.setPosition(position);

                    // Delete original
                    await channel.delete(reason);

                    // Log to Audit Log
                    const auditLog = await guild.fetchAuditLogs({ type: 111, limit: 1 }).catch(() => null);

                    // Success Embed in new channel
                    const successEmbed = new EmbedBuilder()
                        .setTitle("**Nuke Result**")
                        .setColor(0x00f53d)
                        .setDescription(
                            `**__Action : Nuke__**\n` +
                            `<:Marvel_Successfully:1417856966352568472> **Channel Nuked**\n` +
                            `<:Marvel_arrow:1417857492238729289> This channel has been successfully cleared.\n` +
                            `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                        )
                        .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp();

                    if (guild.iconURL()) successEmbed.setThumbnail(guild.iconURL());

                    await newChannel.send({ embeds: [successEmbed] });
                } catch (err) {
                    logger.error(`Nuke Error: ${err.message}`);
                    await this.failure(interaction, channel, "An unexpected error occurred.", true);
                }
                collector.stop();
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await this.failure(response, channel, "Confirmation timed out. ⌛", false);
            }
        });
    },

    async failure(context, channel, reason, isInteraction) {
        const author = isInteraction ? context.user : context.author || context.client.user;
        const embed = new EmbedBuilder()
            .setTitle("**Nuke Result**")
            .setColor(0xFF0000)
            .setDescription(
                `**__Action : Nuke__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Nuke**\n` +
                `<:Marvel_arrow:1417857492238729289> ${channel}\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: (isInteraction ? context.user : context.author).displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (isInteraction) {
            await context.update({ embeds: [embed], components: [] });
        } else {
            await context.edit({ embeds: [embed], components: [] });
        }
    }
};

