const { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'steal',
    aliases: ['eadd'],
    description: 'Steal an emoji or sticker from a message or reply.',
    category: 'utility',
    argsCount: 1, // Strict mode: Expects 1 emoji or a reply

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Steal an emoji from a custom input.')
        .addStringOption(option => 
            option.setName('emoji')
                .setDescription('The emoji to steal')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        const { guild, client } = context;
        const user = isSlash ? context.user : context.author;
        const member = context.member;

        // 2. Permission Check
        if (!member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
            return this.failure(context, "You need **Manage Emojis** permissions to use this! 🛡️", isSlash);
        }

        let targetContent = { attachments: [], stickers: [], emojis: [] };
        const emojiRegex = /<(a?):(\w+):(\d+)>/g;

        // 3. Logic: Handle Reply/Reference
        const messageRef = isSlash ? null : context.reference;
        if (messageRef) {
            const refMessage = await context.channel.messages.fetch(messageRef.message_id);
            targetContent.attachments = Array.from(refMessage.attachments.values());
            targetContent.stickers = Array.from(refMessage.stickers.values());
            
            let match;
            while ((match = emojiRegex.exec(refMessage.content)) !== null) {
                targetContent.emojis.push({
                    animated: match[1] === 'a',
                    name: match[2],
                    id: match[3],
                    url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] === 'a' ? 'gif' : 'png'}`
                });
            }
        }

        // 4. Logic: Handle Direct Argument (Prefix or Slash)
        const input = isSlash ? context.options.getString('emoji') : args[0];
        if (input) {
            let match;
            while ((match = emojiRegex.exec(input)) !== null) {
                targetContent.emojis.push({
                    animated: match[1] === 'a',
                    name: match[2],
                    id: match[3],
                    url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] === 'a' ? 'gif' : 'png'}`
                });
            }
        }

        if (targetContent.attachments.length || targetContent.stickers.length || targetContent.emojis.length) {
            return this.createButtons(context, targetContent, isSlash);
        }

        return this.failure(context, "No valid emoji, sticker, or image found.", isSlash);
    },

    async createButtons(context, content, isSlash) {
        const user = isSlash ? context.user : context.author;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('steal_emoji')
                .setLabel('Steal Emoji')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('steal_sticker')
                .setLabel('Steal Sticker')
                .setStyle(ButtonStyle.Success)
        );

        const previewUrl = content.emojis[0]?.url || content.stickers[0]?.url || content.attachments[0]?.url;

        const embed = new EmbedBuilder()
            .setTitle("**Steal Asset Management**")
            .setColor(0x00f53d)
            .setThumbnail(previewUrl)
            .setDescription(
                `<:Marvel_Successfully:1417856966352568472> **Assets Detected**\n` +
                `<:Marvel_arrow:1417857492238729289> **Emojis Found :** \`${content.emojis.length}\`\n` +
                `<:Marvel_arrow:1417857492238729289> **Stickers Found :** \`${content.stickers.length}\`\n` +
                `<:Marvel_moderator:1417818626769027184> **Requester :** \`${user.username}\``
            )
            .setFooter({ text: "Marvel Development ⚡" })
            .setTimestamp();

        const response = await context.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== user.id) return i.reply({ ...result(i.user, 'Steal Result', 'Steal Assets', 'This menu is not for you.', false, 'Interaction owner mismatch.'), flags: 64 });

            await i.deferReply();

            try {
                if (i.customId === 'steal_emoji') {
                    for (const emoji of content.emojis) {
                        await context.guild.emojis.create({ attachment: emoji.url, name: emoji.name });
                    }
                    await i.editReply(result(user, 'Steal Result', 'Steal Emoji', `Successfully added **${content.emojis.length}** emojis.`));
                } else {
                    for (const sticker of content.stickers) {
                        await context.guild.stickers.create({ file: sticker.url, name: sticker.name, tags: 'stolen' });
                    }
                    await i.editReply(result(user, 'Steal Result', 'Steal Sticker', `Successfully added **${content.stickers.length}** stickers.`));
                }
            } catch (err) {
                await i.editReply(result(user, 'Steal Result', 'Steal Assets', 'Failed to add the selected assets.', false, err.message));
            }
        });
    },

    failure(context, reason, isSlash) {
        const user = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Steal Error**")
            .setColor(0xFF0000)
            .setDescription(
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${user.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Status :** Unsuccessful\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡" });
        return context.reply({ embeds: [embed] });
    }
};
