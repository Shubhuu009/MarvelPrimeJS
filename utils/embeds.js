const { EmbedBuilder } = require('discord.js');

const COLORS = {
  success: 0x22c55e,
  error: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
};

const base = (color, title, description) => {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
};

const success = (title, description) => base(COLORS.success, title, description);
const error = (title, description) => base(COLORS.error, title, description);
const warning = (title, description) => base(COLORS.warning, title, description);
const info = (title, description) => base(COLORS.info, title, description);

module.exports = {
  COLORS,
  success,
  error,
  warning,
  info,
};
