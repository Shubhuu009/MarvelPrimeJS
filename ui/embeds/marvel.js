const { EmbedBuilder } = require('discord.js');

const MARVEL_GREEN = 0x22c55e;
const MARVEL_RED = 0xef4444;
const MARVEL_BLUE = 0x3b82f6;
const MARVEL_GOLD = 0xf59e0b;
const MARVEL_PURPLE = 0x8b5cf6;

const E = {
  success: '✅',
  cross: '❌',
  reason: '📝',
  moderator: '🛡️',
  arrow: '➜',
};

const footer = (user) => {
  const icon = user?.displayAvatarURL?.({ dynamic: true });
  const name = user?.tag || user?.username || 'Marvel Bot';
  return icon ? { text: name, iconURL: icon } : { text: name };
};

const info = (title, description, user) => new EmbedBuilder()
  .setColor(MARVEL_BLUE)
  .setTitle(title)
  .setDescription(description || '')
  .setFooter(footer(user))
  .setTimestamp();

const warn = (title, description, user) => new EmbedBuilder()
  .setColor(MARVEL_RED)
  .setTitle(title)
  .setDescription(description || '')
  .setFooter(footer(user))
  .setTimestamp();

const usage = (title, usageLine, examples = [], description = '') => {
  const embed = new EmbedBuilder()
    .setColor(MARVEL_GOLD)
    .setTitle(title);

  if (description) embed.setDescription(description);
  embed.addFields({ name: 'Usage', value: `\`${usageLine}\`` });
  if (examples.length) {
    embed.addFields({ name: 'Examples', value: examples.map((e) => `\`${e}\``).join('\n') });
  }
  return embed;
};

module.exports = {
  E,
  MARVEL_GREEN,
  MARVEL_RED,
  MARVEL_BLUE,
  MARVEL_GOLD,
  MARVEL_PURPLE,
  footer,
  info,
  warn,
  usage,
};
