const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const Embeds = require('../../utils/embeds');
const { getOrCreateSettings } = require('../../database/logging');
const { ensureSetup } = require('../../systems/logging');

const buildStatusEmbed = (guild, settings) => {
  const channels = settings.channels || {};
  const list = Object.entries(channels)
    .map(([key, id]) => `**${key}**: ${id ? `<#${id}>` : '`Not set`'}`)
    .join('\n');
  return new EmbedBuilder()
    .setColor(Embeds?.COLORS?.info || 0x3b82f6)
    .setTitle('Logging Status')
    .setDescription(settings.enabled ? '✅ Enabled' : '❌ Disabled')
    .addFields({ name: 'Channels', value: list || '`Not set`' })
    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined });
};

module.exports = {
  name: 'logging',
  description: 'Setup server logging',
  category: 'utility',
  cooldown: 3,
  slash: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Setup server logging')
    .addSubcommand(s => s.setName('setup').setDescription('Create logging channels and webhooks'))
    .addSubcommand(s => s.setName('status').setDescription('Show logging status'))
    .addSubcommand(s => s.setName('enable').setDescription('Enable logging'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable logging')),

  async execute({ client, message, interaction, args, isSlash }) {
    const ctx = isSlash ? interaction : message;
    const member = isSlash ? interaction.member : message.member;
    const guild = isSlash ? interaction.guild : message.guild;

    if (!guild || !member) return;

    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const embed = Embeds.error('No Permission', 'Administrator permission required.');
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    const settings = await getOrCreateSettings(guild.id);

    if (!sub || sub === 'status') {
      const embed = buildStatusEmbed(guild, settings);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    if (sub === 'enable') {
      settings.enabled = true;
      await settings.save();
      return isSlash
        ? ctx.reply({ embeds: [Embeds.success('Logging Enabled', 'Logging has been enabled.')], ephemeral: true })
        : ctx.reply({ embeds: [Embeds.success('Logging Enabled', 'Logging has been enabled.')] });
    }

    if (sub === 'disable') {
      settings.enabled = false;
      await settings.save();
      return isSlash
        ? ctx.reply({ embeds: [Embeds.error('Logging Disabled', 'Logging has been disabled.')], ephemeral: true })
        : ctx.reply({ embeds: [Embeds.error('Logging Disabled', 'Logging has been disabled.')] });
    }

    if (sub === 'setup') {
      try {
        await ensureSetup(client, guild);
        return isSlash
          ? ctx.reply({ embeds: [Embeds.success('Logging Setup', 'Logging channels and webhooks created.')], ephemeral: true })
          : ctx.reply({ embeds: [Embeds.success('Logging Setup', 'Logging channels and webhooks created.')] });
      } catch (err) {
        return isSlash
          ? ctx.reply({ embeds: [Embeds.error('Setup Failed', err.message || 'Failed to setup logging.')], ephemeral: true })
          : ctx.reply({ embeds: [Embeds.error('Setup Failed', err.message || 'Failed to setup logging.')] });
      }
    }

    return ctx.reply({ embeds: [Embeds.error('Invalid', 'Unknown subcommand.')], ephemeral: isSlash });
  },
};
