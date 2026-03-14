const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const { getOrCreate } = require('../../database/automod');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;
const statusColor = (enabled) => enabled
  ? (Embeds?.COLORS?.success || DEFAULT_COLOR)
  : (Embeds?.COLORS?.error || DEFAULT_COLOR);

const antilinkRegex = '(?:https?:\\/\\/)?(?:www\\.)?(?:discordapp\\.com\\/invite|discord\\.com\\/invite|discord\\.me|discord\\.gg|[^\\s]+\\.[^\\s]+)(?:\\/#)?(?:\\/invite)?\\/?[a-zA-Z0-9-]*';

const buildStatusEmbed = (guild, settings) => new EmbedBuilder()
  .setColor(statusColor(
    settings.antilink_enabled || settings.antispam_enabled || settings.antibadwords_enabled
  ))
  .setTitle('AutoMod Status')
  .addFields(
    { name: 'AntiLink', value: settings.antilink_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'AntiSpam', value: settings.antispam_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'AntiBadWords', value: settings.antibadwords_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
  )
  .setFooter({ text: `Server: ${guild.name}` })
  .setTimestamp();

const formatRoleList = (roles) => roles.length === 0 ? 'Not Set Yet' : roles.map((id) => `<@&${id}>`).join('\n');
const formatChannelList = (channels) => channels.length === 0 ? 'Not Set Yet' : channels.map((id) => `<#${id}>`).join('\n');

const buildAntilinkEmbed = (settings) => new EmbedBuilder()
  .setColor(statusColor(settings.antilink_enabled))
  .setTitle('AntiLink Settings')
  .setDescription('AutoMod rule to block invite links and common URLs.')
  .addFields(
    { name: 'Status', value: settings.antilink_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Rule ID', value: settings.antilink_rule_id ? `\`${settings.antilink_rule_id}\`` : 'Not Set', inline: true },
    { name: 'Whitelisted Roles', value: formatRoleList(settings.antilink_whitelist_roles || []), inline: true },
    { name: 'Whitelisted Channels', value: formatChannelList(settings.antilink_whitelist_channels || []), inline: true },
  )
  .setTimestamp();

const buildAntibadwordsEmbed = (settings) => new EmbedBuilder()
  .setColor(statusColor(settings.antibadwords_enabled))
  .setTitle('AntiBadWords Settings')
  .setDescription('AutoMod rule to block bad words.')
  .addFields(
    { name: 'Status', value: settings.antibadwords_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Rule ID', value: settings.antibadwords_rule_id ? `\`${settings.antibadwords_rule_id}\`` : 'Not Set', inline: true },
    { name: 'Bad Words', value: settings.antibadwords_words?.length ? `||${settings.antibadwords_words.join(', ')}||` : 'Not Set Yet', inline: false },
    { name: 'Whitelisted Roles', value: formatRoleList(settings.antibadwords_whitelist_roles || []), inline: true },
    { name: 'Whitelisted Channels', value: formatChannelList(settings.antibadwords_whitelist_channels || []), inline: true },
  )
  .setTimestamp();

const buildAntispamEmbed = (settings) => new EmbedBuilder()
  .setColor(statusColor(settings.antispam_enabled))
  .setTitle('AntiSpam Settings')
  .setDescription('AutoMod anti-spam toggles and whitelist.')
  .addFields(
    { name: 'Status', value: settings.antispam_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Trigger', value: `>${settings.antispam_max_messages} messages in ${settings.antispam_max_interval}s`, inline: true },
    { name: 'Mentions', value: `>${settings.antispam_max_mentions} mentions`, inline: true },
    { name: 'Emojis', value: `>${settings.antispam_max_emojis} emojis`, inline: true },
    { name: 'Caps', value: `>${settings.antispam_max_caps}% caps`, inline: true },
    { name: 'Punishment', value: `${settings.antispam_punishment} for ${settings.antispam_punishment_duration} minutes`, inline: true },
    { name: 'Whitelisted Roles', value: formatRoleList(settings.antispam_whitelist_roles || []), inline: true },
    { name: 'Whitelisted Channels', value: formatChannelList(settings.antispam_whitelist_channels || []), inline: true },
  )
  .setTimestamp();

const buildAntilinkView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('automod:antilink:toggle')
    .setLabel(settings.antilink_enabled ? 'Click to Disable' : 'Click to Enable')
    .setStyle(settings.antilink_enabled ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setEmoji(settings.antilink_enabled ? '❌' : '✅');
  const setup = new ButtonBuilder()
    .setCustomId('automod:antilink:setup')
    .setLabel(settings.antilink_rule_id ? 'Re-Run Setup' : 'Run Setup')
    .setStyle(ButtonStyle.Primary);

  const roles = new RoleSelectMenuBuilder()
    .setCustomId('automod:antilink:roles')
    .setPlaceholder('Select Whitelisted Roles')
    .setMinValues(0)
    .setMaxValues(25);
  const roleDefaults = (settings.antilink_whitelist_roles || [])
    .map((id) => guild.roles.cache.get(id))
    .filter(Boolean);
  if (roleDefaults.length) roles.setDefaultRoles(roleDefaults);

  const channels = new ChannelSelectMenuBuilder()
    .setCustomId('automod:antilink:channels')
    .setPlaceholder('Select Whitelisted Channels')
    .setMinValues(0)
    .setMaxValues(25)
    .setChannelTypes(ChannelType.GuildText);
  const channelDefaults = (settings.antilink_whitelist_channels || [])
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean);
  if (channelDefaults.length) channels.setDefaultChannels(channelDefaults);

  const row1 = new ActionRowBuilder().addComponents(toggle, setup);
  const row2 = new ActionRowBuilder().addComponents(roles);
  const row3 = new ActionRowBuilder().addComponents(channels);

  if (disabled) {
    row1.components.forEach((c) => c.setDisabled(true));
    row2.components.forEach((c) => c.setDisabled(true));
    row3.components.forEach((c) => c.setDisabled(true));
  }
  return [row1, row2, row3];
};

const buildAntibadwordsView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('automod:antibadwords:toggle')
    .setLabel(settings.antibadwords_enabled ? 'Click to Disable' : 'Click to Enable')
    .setStyle(settings.antibadwords_enabled ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setEmoji(settings.antibadwords_enabled ? '❌' : '✅');
  const setup = new ButtonBuilder()
    .setCustomId('automod:antibadwords:setup')
    .setLabel(settings.antibadwords_rule_id ? 'Re-Run Setup' : 'Run Setup')
    .setStyle(ButtonStyle.Primary);
  const words = new ButtonBuilder()
    .setCustomId('automod:antibadwords:words')
    .setLabel('Configure Bad Words')
    .setStyle(ButtonStyle.Primary);

  const roles = new RoleSelectMenuBuilder()
    .setCustomId('automod:antibadwords:roles')
    .setPlaceholder('Select Whitelisted Roles')
    .setMinValues(0)
    .setMaxValues(25);
  const roleDefaults = (settings.antibadwords_whitelist_roles || [])
    .map((id) => guild.roles.cache.get(id))
    .filter(Boolean);
  if (roleDefaults.length) roles.setDefaultRoles(roleDefaults);

  const channels = new ChannelSelectMenuBuilder()
    .setCustomId('automod:antibadwords:channels')
    .setPlaceholder('Select Whitelisted Channels')
    .setMinValues(0)
    .setMaxValues(25)
    .setChannelTypes(ChannelType.GuildText);
  const channelDefaults = (settings.antibadwords_whitelist_channels || [])
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean);
  if (channelDefaults.length) channels.setDefaultChannels(channelDefaults);

  const row1 = new ActionRowBuilder().addComponents(toggle, setup);
  const row2 = new ActionRowBuilder().addComponents(words);
  const row3 = new ActionRowBuilder().addComponents(roles);
  const row4 = new ActionRowBuilder().addComponents(channels);

  if (disabled) {
    row1.components.forEach((c) => c.setDisabled(true));
    row2.components.forEach((c) => c.setDisabled(true));
    row3.components.forEach((c) => c.setDisabled(true));
    row4.components.forEach((c) => c.setDisabled(true));
  }
  return [row1, row2, row3, row4];
};

const buildAntispamView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('automod:antispam:toggle')
    .setLabel(settings.antispam_enabled ? 'Click to Disable' : 'Click to Enable')
    .setStyle(settings.antispam_enabled ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setEmoji(settings.antispam_enabled ? '❌' : '✅');
  const reset = new ButtonBuilder()
    .setCustomId('automod:antispam:reset')
    .setLabel('Reset')
    .setStyle(ButtonStyle.Danger);

  const roles = new RoleSelectMenuBuilder()
    .setCustomId('automod:antispam:roles')
    .setPlaceholder('Select Whitelisted Roles')
    .setMinValues(0)
    .setMaxValues(25);
  const roleDefaults = (settings.antispam_whitelist_roles || [])
    .map((id) => guild.roles.cache.get(id))
    .filter(Boolean);
  if (roleDefaults.length) roles.setDefaultRoles(roleDefaults);

  const channels = new ChannelSelectMenuBuilder()
    .setCustomId('automod:antispam:channels')
    .setPlaceholder('Select Whitelisted Channels')
    .setMinValues(0)
    .setMaxValues(25)
    .setChannelTypes(ChannelType.GuildText);
  const channelDefaults = (settings.antispam_whitelist_channels || [])
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean);
  if (channelDefaults.length) channels.setDefaultChannels(channelDefaults);

  const row1 = new ActionRowBuilder().addComponents(toggle, reset);
  const row2 = new ActionRowBuilder().addComponents(roles);
  const row3 = new ActionRowBuilder().addComponents(channels);

  if (disabled) {
    row1.components.forEach((c) => c.setDisabled(true));
    row2.components.forEach((c) => c.setDisabled(true));
    row3.components.forEach((c) => c.setDisabled(true));
  }
  return [row1, row2, row3];
};

const ensureRule = async (guild, settings, type, actorName) => {
  if (type === 'antilink') {
    const rule = await guild.autoModerationRules.create({
      name: `AntiLink by ${actorName}`,
      eventType: 1,
      triggerType: 4,
      triggerMetadata: { regexPatterns: [antilinkRegex] },
      actions: [{ type: 1, metadata: { customMessage: 'Links are not allowed in this server.' } }],
      enabled: true,
      exemptRoles: settings.antilink_whitelist_roles || [],
      exemptChannels: settings.antilink_whitelist_channels || [],
      reason: `AntiLink setup by ${actorName}`,
    });
    settings.antilink_rule_id = rule.id;
    settings.antilink_enabled = true;
    await settings.save();
    return;
  }
  if (type === 'antibadwords') {
    const keywords = (settings.antibadwords_words || []).map((w) => `*${w}*`);
    const rule = await guild.autoModerationRules.create({
      name: `AntiBadWords by ${actorName}`,
      eventType: 1,
      triggerType: 4,
      triggerMetadata: { keywordFilter: keywords },
      actions: [
        { type: 1, metadata: { customMessage: 'Bad words are not allowed in this server.' } },
        { type: 2, metadata: { durationSeconds: 60 } },
      ],
      enabled: true,
      exemptRoles: settings.antibadwords_whitelist_roles || [],
      exemptChannels: settings.antibadwords_whitelist_channels || [],
      reason: `AntiBadWords setup by ${actorName}`,
    });
    settings.antibadwords_rule_id = rule.id;
    settings.antibadwords_enabled = true;
    await settings.save();
  }
};

const toggleRuleEnabled = async (guild, settings, type, enabled) => {
  const ruleId = settings[`${type}_rule_id`];
  if (!ruleId) return false;
  try {
    const rule = await guild.autoModerationRules.fetch(ruleId);
    await rule.edit({ enabled });
    settings[`${type}_enabled`] = enabled;
    await settings.save();
    return true;
  } catch {
    settings[`${type}_enabled`] = false;
    settings[`${type}_rule_id`] = '';
    await settings.save();
    return false;
  }
};

module.exports = {
  name: 'automod',
  description: 'Manage AutoMod settings',
  category: 'automod',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage AutoMod settings')
    .addSubcommand(s => s.setName('enable').setDescription('Enable AutoMod'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable AutoMod'))
    .addSubcommand(s => s.setName('status').setDescription('View AutoMod status'))
    .addSubcommandGroup(g => g.setName('antilink').setDescription('Manage AntiLink')
      .addSubcommand(s => s.setName('enable').setDescription('Enable AntiLink'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable AntiLink'))
      .addSubcommand(s => s.setName('status').setDescription('AntiLink status'))
      .addSubcommand(s => s.setName('panel').setDescription('Open AntiLink panel')))
    .addSubcommandGroup(g => g.setName('antispam').setDescription('Manage AntiSpam')
      .addSubcommand(s => s.setName('enable').setDescription('Enable AntiSpam'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable AntiSpam'))
      .addSubcommand(s => s.setName('status').setDescription('AntiSpam status'))
      .addSubcommand(s => s.setName('panel').setDescription('Open AntiSpam panel')))
    .addSubcommandGroup(g => g.setName('antibadwords').setDescription('Manage AntiBadWords')
      .addSubcommand(s => s.setName('enable').setDescription('Enable AntiBadWords'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable AntiBadWords'))
      .addSubcommand(s => s.setName('status').setDescription('AntiBadWords status'))
      .addSubcommand(s => s.setName('panel').setDescription('Open AntiBadWords panel'))),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;

    const reply = (payload) => (
      isSlash
        ? interaction.reply(payload)
        : message.reply(payload)
    );

    if (!executor.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return reply({ embeds: [Embeds.error('No Permission', 'Administrator permission required.')], ephemeral: true });
    }

    const settings = await getOrCreate(guild.id);

    const subGroup = isSlash ? interaction.options.getSubcommandGroup(false) : args[0]?.toLowerCase();
    const sub = isSlash ? interaction.options.getSubcommand() : (subGroup ? args[1]?.toLowerCase() : args[0]?.toLowerCase());

    if (!sub) {
      const help = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('AutoMod Commands')
        .setDescription('Use `/automod enable|disable|status` or `/automod <group> <action>`.')
        .addFields(
          { name: 'Groups', value: '`antilink`, `antispam`, `antibadwords`' },
          { name: 'Actions', value: '`enable`, `disable`, `status`, `panel`' },
        );
      return reply({ embeds: [help] });
    }

    if (!subGroup && sub === 'status') {
      return reply({ embeds: [buildStatusEmbed(guild, settings)] });
    }

    if (!subGroup && sub === 'enable') {
      settings.antilink_enabled = true;
      settings.antispam_enabled = true;
      settings.antibadwords_enabled = true;
      await settings.save();
      return reply({ embeds: [Embeds.success('AutoMod Enabled', 'AntiLink, AntiSpam, and AntiBadWords are now enabled.')] });
    }

    if (!subGroup && sub === 'disable') {
      settings.antilink_enabled = false;
      settings.antispam_enabled = false;
      settings.antibadwords_enabled = false;
      await settings.save();
      return reply({ embeds: [Embeds.error('AutoMod Disabled', 'AntiLink, AntiSpam, and AntiBadWords are now disabled.')] });
    }

    const setModule = async (moduleKey, enabled) => {
      settings[`${moduleKey}_enabled`] = enabled;
      await settings.save();
      const title = `${moduleKey.replace('anti', 'Anti')} ${enabled ? 'Enabled' : 'Disabled'}`;
      const messageText = `${moduleKey.replace('anti', 'Anti')} has been ${enabled ? 'enabled' : 'disabled'}.`;
      return reply({ embeds: [enabled ? Embeds.success(title, messageText) : Embeds.error(title, messageText)] });
    };

    const showModuleStatus = (moduleKey, label) => reply({
      embeds: [new EmbedBuilder()
        .setColor(statusColor(settings[`${moduleKey}_enabled`]))
        .setTitle(`${label} Status`)
        .setDescription(settings[`${moduleKey}_enabled`] ? '✅ Enabled' : '❌ Disabled')
        .setTimestamp()],
    });

    const openPanel = async (type) => {
      if (!isSlash) {
        return reply({ embeds: [Embeds.info('Use Slash', 'Please use the slash command to open the panel.')], ephemeral: true });
      }

      const build = {
        antilink: {
          embed: () => buildAntilinkEmbed(settings),
          view: (disabled) => buildAntilinkView(guild, settings, disabled),
        },
        antibadwords: {
          embed: () => buildAntibadwordsEmbed(settings),
          view: (disabled) => buildAntibadwordsView(guild, settings, disabled),
        },
        antispam: {
          embed: () => buildAntispamEmbed(settings),
          view: (disabled) => buildAntispamView(guild, settings, disabled),
        },
      }[type];

      await interaction.reply({ embeds: [build.embed()], components: build.view(false) });
      const panelMessage = await interaction.fetchReply();
      const collector = panelMessage.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== executor.id) {
          return i.reply({ embeds: [Embeds.error('Not Allowed', 'Only the command user can interact here.')], ephemeral: true });
        }

        if (i.customId === `automod:${type}:toggle`) {
          await i.deferUpdate();
          const enabled = !settings[`${type}_enabled`];
          const ok = await toggleRuleEnabled(guild, settings, type, enabled);
          if (!ok && enabled) {
            await i.followUp({ embeds: [Embeds.error('Missing Rule', 'Run setup before enabling.')], ephemeral: true });
          }
        }

        if (i.customId === `automod:${type}:setup`) {
          await i.deferUpdate();
          await ensureRule(guild, settings, type, executor.displayName || executor.user.username);
        }

        if (i.customId === `automod:${type}:roles`) {
          await i.deferUpdate();
          settings[`${type}_whitelist_roles`] = i.values;
          await settings.save();
        }

        if (i.customId === `automod:${type}:channels`) {
          await i.deferUpdate();
          settings[`${type}_whitelist_channels`] = i.values;
          await settings.save();
        }

        if (i.customId === 'automod:antibadwords:words') {
          const modal = new ModalBuilder()
            .setCustomId('automod:antibadwords:words_modal')
            .setTitle('Configure Bad Words');
          const input = new TextInputBuilder()
            .setCustomId('bad_words')
            .setLabel('Bad Words (comma separated)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue((settings.antibadwords_words || []).join(', '));
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await i.showModal(modal);

          const modalSubmit = await i.awaitModalSubmit({
            time: 60000,
            filter: (m) => m.customId === 'automod:antibadwords:words_modal' && m.user.id === executor.id,
          }).catch(() => null);
          if (modalSubmit) {
            const raw = modalSubmit.fields.getTextInputValue('bad_words');
            settings.antibadwords_words = raw
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean);
            await settings.save();
            await modalSubmit.deferUpdate();
          }
        }

        if (i.customId === 'automod:antispam:reset') {
          await i.deferUpdate();
          settings.antispam_enabled = false;
          settings.antispam_whitelist_roles = [];
          settings.antispam_whitelist_channels = [];
          settings.antispam_max_messages = 5;
          settings.antispam_max_interval = 30;
          settings.antispam_max_mentions = 5;
          settings.antispam_max_emojis = 10;
          settings.antispam_max_caps = 50;
          settings.antispam_punishment = 'mute';
          settings.antispam_punishment_duration = 10;
          await settings.save();
        }

        await panelMessage.edit({ embeds: [build.embed()], components: build.view(false) });
      });

      collector.on('end', async () => {
        await panelMessage.edit({ embeds: [build.embed()], components: build.view(true) });
      });
    };

    const group = subGroup || '';
    if (group === 'antilink') {
      if (sub === 'status') return showModuleStatus('antilink', 'AntiLink');
      if (sub === 'enable') return setModule('antilink', true);
      if (sub === 'disable') return setModule('antilink', false);
      if (sub === 'panel') return openPanel('antilink');
    }
    if (group === 'antispam') {
      if (sub === 'status') return showModuleStatus('antispam', 'AntiSpam');
      if (sub === 'enable') return setModule('antispam', true);
      if (sub === 'disable') return setModule('antispam', false);
      if (sub === 'panel') return openPanel('antispam');
    }
    if (group === 'antibadwords') {
      if (sub === 'status') return showModuleStatus('antibadwords', 'AntiBadWords');
      if (sub === 'enable') return setModule('antibadwords', true);
      if (sub === 'disable') return setModule('antibadwords', false);
      if (sub === 'panel') return openPanel('antibadwords');
    }

    return reply({ embeds: [Embeds.error('Invalid', 'Unknown subcommand.')] });
  },
};
