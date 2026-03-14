const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const {
  listResponses,
  getResponse,
  upsertResponse,
  deleteResponse,
} = require('../../database/autoresponse');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;

const buildMenuEmbed = (guild) => new EmbedBuilder()
  .setColor(DEFAULT_COLOR)
  .setAuthor({ name: 'Autoresponder Menu', iconURL: guild.iconURL({ dynamic: true }) || undefined })
  .setDescription(
    'Please choose an option from the buttons below.\n' +
    '**Add**\nCreate a new autoresponder.\n' +
    '**Remove**\nRemove an autoresponder.\n' +
    '**Config**\nList current autoresponders.'
  );

const buildMenuView = (disabled = false) => {
  const add = new ButtonBuilder()
    .setCustomId('autoresponse:add')
    .setLabel('Add')
    .setStyle(ButtonStyle.Success);
  const remove = new ButtonBuilder()
    .setCustomId('autoresponse:remove')
    .setLabel('Remove')
    .setStyle(ButtonStyle.Danger);
  const config = new ButtonBuilder()
    .setCustomId('autoresponse:config')
    .setLabel('Config')
    .setStyle(ButtonStyle.Primary);
  if (disabled) {
    add.setDisabled(true);
    remove.setDisabled(true);
    config.setDisabled(true);
  }
  return [new ActionRowBuilder().addComponents(add, remove, config)];
};

const buildConfigEmbed = (guild, list) => {
  if (!list.length) {
    return new EmbedBuilder()
      .setColor(infoColor())
      .setTitle('Autoresponder Config')
      .setDescription('No autoresponders are set.');
  }
  const lines = list.map((r) => `\`${r.trigger}\` → ${r.response}`).join('\n');
  return new EmbedBuilder()
    .setColor(infoColor())
    .setTitle('Autoresponder Config')
    .setDescription(lines)
    .setFooter({ text: `Server: ${guild.name}` });
};

const buildHelpEmbed = () => new EmbedBuilder()
  .setColor(infoColor())
  .setTitle('Autoresponder Commands')
  .setDescription('Use `/autoresponse panel` or subcommands below.')
  .addFields(
    { name: 'Add', value: '`/autoresponse add <trigger> <response>`' },
    { name: 'Remove', value: '`/autoresponse remove <trigger>`' },
    { name: 'Config', value: '`/autoresponse config`' },
  );

module.exports = {
  name: 'autoresponse',
  description: 'Manage autoresponder',
  aliases: ['ar', 'autoresponder', 'autoreact'],
  category: 'utility',
  cooldown: 1,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Manage autoresponder')
    .addSubcommand(s => s.setName('panel').setDescription('Open autoresponder panel'))
    .addSubcommand(s => s.setName('add').setDescription('Add autoresponder')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger word or phrase').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('Response message').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove autoresponder')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger to remove').setRequired(true)))
    .addSubcommand(s => s.setName('config').setDescription('List autoresponders')),

  async execute({ message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;

    const reply = (payload) => (
      isSlash
        ? interaction.reply(payload)
        : message.reply(payload)
    );

    if (!executor.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return reply({ embeds: [Embeds.error('No Permission', 'Manage Messages permission required.')], ephemeral: true });
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    if (!sub || sub === 'panel') {
      if (!isSlash) {
        return reply({ embeds: [buildMenuEmbed(guild)], components: buildMenuView(false) });
      }
      await interaction.reply({ embeds: [buildMenuEmbed(guild)], components: buildMenuView(false) });
      const panelMessage = await interaction.fetchReply();
      const collector = panelMessage.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== executor.id) {
          return i.reply({ embeds: [Embeds.error('Not Allowed', 'Only the command user can interact here.')], ephemeral: true });
        }
        if (i.customId === 'autoresponse:config') {
          const list = await listResponses(guild.id);
          return i.reply({ embeds: [buildConfigEmbed(guild, list)], ephemeral: true });
        }
        if (i.customId === 'autoresponse:add') {
          const modal = new ModalBuilder()
            .setCustomId('autoresponse:add_modal')
            .setTitle('Add Autoresponder');
          const trigger = new TextInputBuilder()
            .setCustomId('trigger')
            .setLabel('Trigger')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const response = new TextInputBuilder()
            .setCustomId('response')
            .setLabel('Response')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(
            new ActionRowBuilder().addComponents(trigger),
            new ActionRowBuilder().addComponents(response),
          );
          await i.showModal(modal);
          const submit = await i.awaitModalSubmit({
            time: 60000,
            filter: (m) => m.customId === 'autoresponse:add_modal' && m.user.id === executor.id,
          }).catch(() => null);
          if (submit) {
            const t = submit.fields.getTextInputValue('trigger').trim().toLowerCase();
            const r = submit.fields.getTextInputValue('response').trim();
            await upsertResponse(guild.id, t, r);
            await submit.reply({ embeds: [Embeds.success('Saved', `Autoresponder \`${t}\` saved.`)], ephemeral: true });
          }
        }
        if (i.customId === 'autoresponse:remove') {
          const modal = new ModalBuilder()
            .setCustomId('autoresponse:remove_modal')
            .setTitle('Remove Autoresponder');
          const trigger = new TextInputBuilder()
            .setCustomId('trigger')
            .setLabel('Trigger to remove')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(trigger));
          await i.showModal(modal);
          const submit = await i.awaitModalSubmit({
            time: 60000,
            filter: (m) => m.customId === 'autoresponse:remove_modal' && m.user.id === executor.id,
          }).catch(() => null);
          if (submit) {
            const t = submit.fields.getTextInputValue('trigger').trim().toLowerCase();
            const existing = await getResponse(guild.id, t);
            if (!existing) {
              return submit.reply({ embeds: [Embeds.error('Not Found', `No autoresponder for \`${t}\`.`)], ephemeral: true });
            }
            await deleteResponse(guild.id, t);
            await submit.reply({ embeds: [Embeds.success('Removed', `Autoresponder \`${t}\` removed.`)], ephemeral: true });
          }
        }
      });

      collector.on('end', async () => {
        await panelMessage.edit({ embeds: [buildMenuEmbed(guild)], components: buildMenuView(true) });
      });
      return;
    }

    if (sub === 'config') {
      const list = await listResponses(guild.id);
      return reply({ embeds: [buildConfigEmbed(guild, list)] });
    }

    if (sub === 'add') {
      const trigger = isSlash ? interaction.options.getString('trigger') : args[1];
      const response = isSlash ? interaction.options.getString('response') : args.slice(2).join(' ');
      if (!trigger || !response) return reply({ embeds: [Embeds.error('Invalid', 'Provide trigger and response.')] });
      const t = trigger.trim().toLowerCase();
      await upsertResponse(guild.id, t, response.trim());
      return reply({ embeds: [Embeds.success('Saved', `Autoresponder \`${t}\` saved.`)] });
    }

    if (sub === 'remove') {
      const trigger = isSlash ? interaction.options.getString('trigger') : args[1];
      if (!trigger) return reply({ embeds: [Embeds.error('Invalid', 'Provide a trigger to remove.')] });
      const t = trigger.trim().toLowerCase();
      const existing = await getResponse(guild.id, t);
      if (!existing) return reply({ embeds: [Embeds.error('Not Found', `No autoresponder for \`${t}\`.`)] });
      await deleteResponse(guild.id, t);
      return reply({ embeds: [Embeds.success('Removed', `Autoresponder \`${t}\` removed.`)] });
    }

    return reply({ embeds: [buildHelpEmbed()] });
  },
};
