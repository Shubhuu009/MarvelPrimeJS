const { SlashCommandBuilder, PermissionsBitField, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { info, warn, usage, MARVEL_GREEN, footer } = require('../../ui/embeds/marvel');

const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const PRESENCE_FILE = path.join(DATA_DIR, 'presence.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPresenceConfig() {
  try {
    if (!fs.existsSync(PRESENCE_FILE)) return null;
    const raw = fs.readFileSync(PRESENCE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePresenceConfig(config) {
  ensureDataDir();
  fs.writeFileSync(PRESENCE_FILE, JSON.stringify(config, null, 2));
}

function clearPresenceConfig() {
  if (fs.existsSync(PRESENCE_FILE)) fs.unlinkSync(PRESENCE_FILE);
}

function normalizeType(value) {
  if (!value) return null;
  const t = String(value).toLowerCase();
  if (['custom', 'playing', 'listening', 'watching', 'competing', 'streaming'].includes(t)) return t;
  return null;
}

function normalizeStatus(value) {
  if (!value) return null;
  const s = String(value).toLowerCase();
  if (['online', 'idle', 'dnd', 'invisible'].includes(s)) return s;
  return null;
}

function toPresencePayload(config) {
  const type = normalizeType(config.type) || 'playing';
  const status = normalizeStatus(config.status) || 'online';
  const activity = {
    name: config.text || '',
    type: ActivityType.Playing,
  };

  if (type === 'custom') {
    activity.type = ActivityType.Custom;
    activity.state = config.text || '';
  } else if (type === 'listening') {
    activity.type = ActivityType.Listening;
  } else if (type === 'watching') {
    activity.type = ActivityType.Watching;
  } else if (type === 'competing') {
    activity.type = ActivityType.Competing;
  } else if (type === 'streaming') {
    activity.type = ActivityType.Streaming;
    if (config.url) activity.url = config.url;
  } else {
    activity.type = ActivityType.Playing;
  }

  return { status, activities: [activity] };
}

function formatConfig(config) {
  if (!config) return 'No saved bot status.';
  return [
    `**Type :** \`${config.type}\``,
    `**Status :** \`${config.status}\``,
    `**Text :** ${config.text}`,
    config.url ? `**URL :** ${config.url}` : null,
  ].filter(Boolean).join('\n');
}

function reply(ctx, isSlash, payload) {
  if (isSlash) return ctx.reply(payload);
  return ctx.reply(payload);
}

module.exports = {
  name: 'botstatus',
  aliases: ['statusbot', 'setstatus', 'status'],
  description: 'Bot-owner only command to update the bot presence.',
  ownerOnly: true,
  category: 'owner',
  slash: new SlashCommandBuilder()
    .setName('botstatus')
    .setDescription('Bot-owner only command to update the bot presence')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the bot status')
        .addStringOption(option =>
          option.setName('type').setDescription('Activity type').setRequired(true)
            .addChoices(
              { name: 'Custom', value: 'custom' },
              { name: 'Playing', value: 'playing' },
              { name: 'Listening', value: 'listening' },
              { name: 'Watching', value: 'watching' },
              { name: 'Competing', value: 'competing' },
              { name: 'Streaming', value: 'streaming' },
            ))
        .addStringOption(option =>
          option.setName('status').setDescription('Online status').setRequired(true)
            .addChoices(
              { name: 'Online', value: 'online' },
              { name: 'Idle', value: 'idle' },
              { name: 'Do Not Disturb', value: 'dnd' },
              { name: 'Invisible', value: 'invisible' },
            ))
        .addStringOption(option => option.setName('text').setDescription('Status text').setRequired(true))
        .addStringOption(option => option.setName('url').setDescription('Streaming URL if type is streaming').setRequired(false)))
    .addSubcommand(sub => sub.setName('view').setDescription('View the saved bot status'))
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear the saved bot status')),

  async execute({ client, message, interaction, args, isSlash }) {
    const ctx = isSlash ? interaction : message;
    const author = isSlash ? interaction.user : message.author;

    if (!OWNER_IDS.includes(author.id)) {
      const embed = warn('Owner Only', 'This command is restricted to bot owners.', author);
      return reply(ctx, isSlash, { embeds: [embed], ephemeral: true });
    }

    let subcommand;
    let type;
    let status;
    let text;
    let url;

    if (isSlash) {
      subcommand = interaction.options.getSubcommand();
      type = interaction.options.getString('type');
      status = interaction.options.getString('status');
      text = interaction.options.getString('text');
      url = interaction.options.getString('url');
    } else {
      subcommand = args[0]?.toLowerCase();
      if (!subcommand) {
        const embed = usage('BOTSTATUS', '.botstatus <set|view|clear>', [
          '.botstatus set <type> <status> <text>',
          '.botstatus custom <status> <text>',
          '.botstatus set streaming online Live now https://twitch.tv/example',
          '.botstatus view',
          '.botstatus clear',
        ], 'Set or view the bot status.');
        return reply(ctx, isSlash, { embeds: [embed] });
      }

      if (subcommand === 'set') {
        type = args[1];
        status = args[2];
        const remainder = args.slice(3);
        if (String(type || '').toLowerCase() === 'streaming') {
          const urlCandidate = remainder[remainder.length - 1];
          if (urlCandidate && /^https?:\/\//i.test(urlCandidate)) {
            url = urlCandidate;
            text = remainder.slice(0, -1).join(' ');
          } else {
            text = remainder.join(' ');
          }
        } else {
          text = remainder.join(' ');
        }
      }
    }

    if (!isSlash && subcommand === 'custom') {
      subcommand = 'set';
      type = 'custom';
      status = args[1];
      text = args.slice(2).join(' ');
    }

    if (subcommand === 'view') {
      const saved = loadPresenceConfig();
      const embed = info('Bot Status', formatConfig(saved), author);
      return reply(ctx, isSlash, { embeds: [embed], ephemeral: isSlash });
    }

    if (subcommand === 'clear') {
      clearPresenceConfig();
      await client.user.setPresence({ status: 'online', activities: [] });
      const embed = info('Bot Status', 'Bot status cleared and reset to default.', author);
      return reply(ctx, isSlash, { embeds: [embed], ephemeral: isSlash });
    }

    if (subcommand !== 'set') {
      const embed = usage('BOTSTATUS', '.botstatus <set|view|clear>', [
        '.botstatus set <type> <status> <text>',
        '.botstatus custom <status> <text>',
        '.botstatus view',
        '.botstatus clear',
      ], 'Set or view the bot status.');
      return reply(ctx, isSlash, { embeds: [embed] });
    }

    const normalizedType = normalizeType(type);
    const normalizedStatus = normalizeStatus(status);

    if (!normalizedType || !text?.trim()) {
      const embed = warn('Bot Status', 'Provide a valid type, status, and text.', author);
      return reply(ctx, isSlash, { embeds: [embed], ephemeral: isSlash });
    }

    if (normalizedType === 'streaming' && !url) {
      const embed = warn('Bot Status', 'Streaming status requires a valid URL.', author);
      return reply(ctx, isSlash, { embeds: [embed], ephemeral: isSlash });
    }

    const config = {
      type: normalizedType,
      status: normalizedStatus || 'online',
      text: text.trim(),
      url: url || '',
    };

    await client.user.setPresence(toPresencePayload(config));
    savePresenceConfig(config);

    const typeLabel = normalizedType === 'custom'
      ? 'Custom'
      : normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
    const preview = normalizedType === 'custom'
      ? `Set custom status to \`${config.text}\` with bot status \`${config.status}\`.`
      : `Set ${typeLabel.toLowerCase()} activity to \`${config.text}\` with bot status \`${config.status}\`.`;

    const embed = info('Bot Status', preview, author).setColor(MARVEL_GREEN).setFooter(footer(author));
    return reply(ctx, isSlash, { embeds: [embed], ephemeral: isSlash });
  },
};
