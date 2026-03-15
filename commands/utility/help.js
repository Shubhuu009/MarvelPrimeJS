const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require('discord.js');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands'],
    category: 'info',
    description: 'Displays the Marvel help menu with all command categories.',
    async execute(message, args) {
        const client = message.client;
        const prefix = message.guild?.prefix || client.prefix;

        // 1. Create the Category Menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('🛡️ Select a command category')
            .addOptions([
                { label: 'Security', description: 'Anti-Nuke and protection settings', value: 'sec', emoji: '🛡️' },
                { label: 'Moderation', description: 'Staff tools for user management', value: 'mod', emoji: '🔨' },
                { label: 'Utility', description: 'Information and server tools', value: 'util', emoji: '⚙️' },
                { label: 'Welcomer', description: 'Member onboarding and greet settings', value: 'welc', emoji: '🚪' },
                { label: 'Voice', description: 'Dynamic VoiceMaster management', value: 'vc', emoji: '🎤' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        // 2. Initial Hub Embed
        const mainEmbed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setAuthor({ name: `${message.author.username}'s Help Desk`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**• Prefix:** \`${prefix}\`\n` +
                `**• Total commands:** \`${client.commands.size}\`\n` +
                `**[Invite](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot) | [Support](https://dsc.gg/marvel-dev)**\n\n` +
                `**Explore Categories:**`
            )
            .addFields({
                name: '\u200b',
                value: (
                    `🛡️ \`:\` **Security (AntiNuke)**\n` +
                    `🔨 \`:\` **Moderation**\n` +
                    `⚙️ \`:\` **Utility**\n` +
                    `🚪 \`:\` **Welcomer**\n` +
                    `🎤 \`:\` **Voice**\n\n` +
                    `*Choose a category from the dropdown menu to see individual commands.*`
                )
            })
            .setFooter({ text: "Marvel Architecture ⚡" });

        const helpMsg = await message.channel.send({ embeds: [mainEmbed], components: [row] });

        // 3. Handle Menu Interactions
        const collector = helpMsg.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ ...result(interaction.user, 'Help Result', 'Help Menu', 'This menu is not for you.', false, 'Interaction owner mismatch.'), flags: MessageFlags.Ephemeral });
            }

            let catTitle, catDesc, catCommands;

            // Logic to filter commands by category
            switch (interaction.values[0]) {
                case 'sec':
                    catTitle = 'Security Commands';
                    catCommands = '`antinuke`, `whitelist`, `bypass`, `config`';
                    break;
                case 'mod':
                    catTitle = 'Moderation Commands';
                    catCommands = '`ban`, `kick`, `mute`, `warn`, `clear`, `slowmode`';
                    break;
                case 'util':
                    catTitle = 'Utility Commands';
                    catCommands = '`botinfo`, `serverinfo`, `userinfo`, `ping`, `prefix`';
                    break;
                case 'welc':
                    catTitle = 'Welcomer Commands';
                    catCommands = '`welcome`, `autorole`, `autonick`, `greet`';
                    break;
                case 'vc':
                    catTitle = 'VoiceMaster Commands';
                    catCommands = '`vc setup`, `vc lock`, `vc limit`, `vc claim`';
                    break;
            }

            const catEmbed = new EmbedBuilder()
                .setTitle(`📂 ${catTitle}`)
                .setColor(0x95a5a6)
                .setDescription(`${catCommands}\n\n*Type \`${prefix}help <command>\` for more details on a specific tool.*`)
                .setFooter({ text: "Marvel Security" });

            await interaction.update({ embeds: [catEmbed] });
        });
    }
};
