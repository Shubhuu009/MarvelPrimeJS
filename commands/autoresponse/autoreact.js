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
  listReacts,
  getReact,
  upsertReact,
  deleteReact,
} = require('../../database/autoreact');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;

const buildMenuEmbed = (guild) => new EmbedBuilder()
  .setColor(DEFAULT_COLOR)
  .setAuthor({ name: 'Autoreact Menu', iconURL: guild.iconURL({ dynamic: true }) || undefined })
  .setDescription(
    'Please choose an option from the buttons below.\n' +
    '**Add**\nCreate a new autoreact.\n' +
    '**Remove**\nRemove an autoreact.\n' +
    '**Config**\nList current autoreacts.'
  );

const buildMenuView = (disabled = false) => {
  const add = new ButtonBuilder()
    .setCustomId('autoreact:add')
    .setLabel('Add')
    .setStyle(ButtonStyle.Success);
  const remove = new ButtonBuilder()
    .setCustomId('autoreact:remove')
    .setLabel('Remove')
    .setStyle(ButtonStyle.Danger);
  const config = new ButtonBuilder()
    .setCustomId('autoreact:config')
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
      .setTitle('Autoreact Config')
      .setDescription('No autoreacts are set.');
  }
  const lines = list.map((r) => `\`${r.trigger}\` → ${r.emoji} (${r.matchType}${r.caseSensitive ? ', case' : ''})`).join('\n');
  return new EmbedBuilder()
    .setColor(infoColor())
    .setTitle('Autoreact Config')
    .setDescription(lines)
    .setFooter({ text: `Server: ${guild.name}` });
};

const buildHelpEmbed = () => new EmbedBuilder()
  .setColor(infoColor())
  .setTitle('Autoreact Commands')
  .setDescription('Use `/autoreact panel` or subcommands below.')
  .addFields(
    { name: 'Add', value: '`/autoreact add <trigger> <emoji> [contains|exact] [case]`' },
    { name: 'Remove', value: '`/autoreact remove <trigger>`' },
    { name: 'Config', value: '`/autoreact config`' },
  );

module.exports = {
  name: 'autoreact',
  description: 'Manage autoreact',
  aliases: ['arx', 'autoreact'],
  category: 'utility',
  cooldown: 1,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('autoreact')
    .setDescription('Manage autoreact')
    .addSubcommand(s => s.setName('panel').setDescription('Open autoreact panel'))
    .addSubcommand(s => s.setName('add').setDescription('Add autoreact')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger word or phrase').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji (unicode or custom)').setRequired(true))
      .addStringOption(o => o.setName('match').setDescription('Match type').addChoices(
        { name: 'Contains', value: 'contains' },
        { name: 'Exact', value: 'exact' },
      ))
      .addBooleanOption(o => o.setName('case').setDescription('Case sensitive')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove autoreact')
      .addStringOption(o => o.setName('trigger').setDescription('Trigger to remove').setRequired(true)))
    .addSubcommand(s => s.setName('config').setDescription('List autoreacts')),

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
        if (i.customId === 'autoreact:config') {
          const list = await listReacts(guild.id);
          return i.reply({ embeds: [buildConfigEmbed(guild, list)], ephemeral: true });
        }
        if (i.customId === 'autoreact:add') {
          const modal = new ModalBuilder()
            .setCustomId('autoreact:add_modal')
            .setTitle('Add Autoreact');
          const trigger = new TextInputBuilder()
            .setCustomId('trigger')
            .setLabel('Trigger')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const emoji = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Emoji')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const match = new TextInputBuilder()
            .setCustomId('match')
            .setLabel('Match Type (contains|exact)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
          const caseField = new TextInputBuilder()
            .setCustomId('case')
            .setLabel('Case sensitive? (yes/no)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
          modal.addComponents(
            new ActionRowBuilder().addComponents(trigger),
            new ActionRowBuilder().addComponents(emoji),
            new ActionRowBuilder().addComponents(match),
            new ActionRowBuilder().addComponents(caseField),
          );
          await i.showModal(modal);
          const submit = await i.awaitModalSubmit({
            time: 60000,
            filter: (m) => m.customId === 'autoreact:add_modal' && m.user.id === executor.id,
          }).catch(() => null);
          if (submit) {
            const t = submit.fields.getTextInputValue('trigger').trim().toLowerCase();
            const e = submit.fields.getTextInputValue('emoji').trim();
            const m = submit.fields.getTextInputValue('match').trim().toLowerCase() || 'contains';
            const c = submit.fields.getTextInputValue('case').trim().toLowerCase() === 'yes';
            await upsertReact(guild.id, t, e, m === 'exact' ? 'exact' : 'contains', c);
            await submit.reply({ embeds: [Embeds.success('Saved', `Autoreact \`${t}\` saved.`)], ephemeral: true });
          }
        }
        if (i.customId === 'autoreact:remove') {
          const modal = new ModalBuilder()
            .setCustomId('autoreact:remove_modal')
            .setTitle('Remove Autoreact');
          const trigger = new TextInputBuilder()
            .setCustomId('trigger')
            .setLabel('Trigger to remove')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(trigger));
          await i.showModal(modal);
          const submit = await i.awaitModalSubmit({
            time: 60000,
            filter: (m) => m.customId === 'autoreact:remove_modal' && m.user.id === executor.id,
          }).catch(() => null);
          if (submit) {
            const t = submit.fields.getTextInputValue('trigger').trim().toLowerCase();
            const existing = await getReact(guild.id, t);
            if (!existing) {
              return submit.reply({ embeds: [Embeds.error('Not Found', `No autoreact for \`${t}\`.`)], ephemeral: true });
            }
            await deleteReact(guild.id, t);
            await submit.reply({ embeds: [Embeds.success('Removed', `Autoreact \`${t}\` removed.`)], ephemeral: true });
          }
        }
      });

      collector.on('end', async () => {
        await panelMessage.edit({ embeds: [buildMenuEmbed(guild)], components: buildMenuView(true) });
      });
      return;
    }

    if (sub === 'config') {
      const list = await listReacts(guild.id);
      return reply({ embeds: [buildConfigEmbed(guild, list)] });
    }

    if (sub === 'add') {
      const trigger = isSlash ? interaction.options.getString('trigger') : args[1];
      const emoji = isSlash ? interaction.options.getString('emoji') : args[2];
      const match = isSlash ? interaction.options.getString('match') : args[3];
      const caseSensitive = isSlash ? interaction.options.getBoolean('case') : (args[4] === 'case');
      if (!trigger || !emoji) return reply({ embeds: [Embeds.error('Invalid', 'Provide trigger and emoji.')] });
      const t = trigger.trim().toLowerCase();
      await upsertReact(guild.id, t, emoji.trim(), match === 'exact' ? 'exact' : 'contains', Boolean(caseSensitive));
      return reply({ embeds: [Embeds.success('Saved', `Autoreact \`${t}\` saved.`)] });
    }

    if (sub === 'remove') {
      const trigger = isSlash ? interaction.options.getString('trigger') : args[1];
      if (!trigger) return reply({ embeds: [Embeds.error('Invalid', 'Provide a trigger to remove.')] });
      const t = trigger.trim().toLowerCase();
      const existing = await getReact(guild.id, t);
      if (!existing) return reply({ embeds: [Embeds.error('Not Found', `No autoreact for \`${t}\`.`)] });
      await deleteReact(guild.id, t);
      return reply({ embeds: [Embeds.success('Removed', `Autoreact \`${t}\` removed.`)] });
    }

    return reply({ embeds: [buildHelpEmbed()] });
  },
};
