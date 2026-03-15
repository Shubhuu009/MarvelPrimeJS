const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const BlacklistManager = require('../../systems/blacklist/blacklist');

const MODULES = ['j2c', 'automod', 'antinuke', 'logging', 'welcomer', 'ticket', 'music'];
const COOLDOWN_MS = 60 * 1000;
const guildCooldowns = new Map();

const onCooldown = (guildId) => {
  const now = Date.now();
  const last = guildCooldowns.get(guildId) || 0;
  if (now - last < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
  guildCooldowns.set(guildId, now);
  return 0;
};

const moduleAvailable = (client, name) => {
  if (name === 'j2c') return client?.commands?.has('voicepanel');
  return client?.commands?.has(name);
};

const buildOverviewEmbed = (client, guild) => {
  const list = MODULES.map((m) => {
    const available = moduleAvailable(client, m);
    const label = m === 'j2c' ? 'j2c (voicepanel)' : m;
    return `${available ? '✅' : '⚠️'} \`${label}\`${available ? '' : ' (not installed)'}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(Embeds?.COLORS?.info || 0x3b82f6)
    .setTitle('Setup Modules')
    .setDescription('Select a module to configure.')
    .addFields({ name: 'Available Modules', value: list })
    .setFooter({ text: guild?.name || 'Setup', iconURL: guild?.iconURL?.({ dynamic: true }) || undefined });
};

const moduleHelp = (module, prefix = '.') => {
  const helpMap = {
    automod: `Use \`/automod status\` or \`${prefix}automod status\` to view settings.\nOpen panels with \`/automod antilink panel\`, \`/automod antispam panel\`, or \`/automod antibadwords panel\`.`,
    antinuke: `Use \`/antinuke status\` or \`${prefix}antinuke status\` to view settings.\nEnable with \`/antinuke enable\`.`,
    welcomer: `Use \`/welcomer settings\` or \`${prefix}welcomer settings\` to view configuration.`,
    ticket: `Use \`/ticket settings\` or \`${prefix}ticket settings\` to view configuration.`,
    j2c: `Join-to-Create VC uses the voice panel.\nUse \`/voicepanel\` or \`${prefix}voicepanel\` while in a voice channel.`,
    logging: `Use \`/logging setup\` or \`${prefix}logging setup\` to create logging channels and webhooks.`,
    music: 'Music module is not installed in this bot yet.',
  };
  return helpMap[module] || 'Module not available.';
};

module.exports = {
  name: 'setup',
  aliases: ['settings'],
  description: 'Setup modules',
  category: 'utility',
  cooldown: 3,
  slash: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup modules')
    .addSubcommand(s => s.setName('all').setDescription('Show setup menu for all modules'))
    .addSubcommand(s => s.setName('j2c').setDescription('Setup Join-To-Create VC module'))
    .addSubcommand(s => s.setName('automod').setDescription('Setup AutoMod module'))
    .addSubcommand(s => s.setName('antinuke').setDescription('Setup AntiNuke module'))
    .addSubcommand(s => s.setName('logging').setDescription('Setup Logging module'))
    .addSubcommand(s => s.setName('welcomer').setDescription('Setup Welcomer module'))
    .addSubcommand(s => s.setName('ticket').setDescription('Setup Ticket module'))
    .addSubcommand(s => s.setName('music').setDescription('Setup Music module')),

  async execute({ client, message, interaction, args, isSlash }) {
    const ctx = isSlash ? interaction : message;
    const member = isSlash ? interaction.member : message.member;
    const guild = isSlash ? interaction.guild : message.guild;

    if (!guild || !member) return;

    if (BlacklistManager.isGuildBlocked(guild.id) || BlacklistManager.isUserBlocked(member.id)) {
      return;
    }

    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const embed = Embeds.error('No Permission', 'Administrator permission required.');
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const left = onCooldown(guild.id);
    if (left > 0) {
      const embed = Embeds.warning('Cooldown', `Please wait **${left}s** before using this command again.`);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const subRaw = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    const sub = subRaw === 'voicepanel' ? 'j2c' : subRaw;
    if (!sub || sub === 'all') {
      const embed = buildOverviewEmbed(client, guild);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    if (!MODULES.includes(sub)) {
      const embed = Embeds.error('Invalid Module', `Available modules: ${MODULES.map((m) => `\`${m}\``).join(', ')}`);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    if (sub === 'j2c') {
      const voicePanel = client.commands?.get('voicepanel');
      if (voicePanel?.execute) {
        return voicePanel.execute({ client, message, interaction, isSlash });
      }
    }

    const prefix = process.env.PREFIX || '.';
    const embed = new EmbedBuilder()
      .setColor(Embeds?.COLORS?.info || 0x3b82f6)
      .setTitle(`Setup — ${sub.toUpperCase()}`)
      .setDescription(moduleHelp(sub, prefix))
      .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined });

    return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  },
};
