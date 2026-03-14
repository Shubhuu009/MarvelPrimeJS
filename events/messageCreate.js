const { listReacts } = require('../database/autoreact');
const { isBlacklisted } = require('../database/blacklist');
const { handleMessageRate } = require('../utils/ratelimit');

const parseEmoji = (raw) => {
  if (!raw) return null;
  const match = raw.match(/<a?:\w+:(\d+)>/);
  if (match) return match[1];
  return raw;
};

module.exports = async (client, message) => {
  if (!message?.guild || message.author?.bot) return;

  if (await isBlacklisted('guild', message.guild.id)) return;
  if (await isBlacklisted('user', message.author.id)) return;
  if (await handleMessageRate(message)) return;

  const reacts = await listReacts(message.guild.id);
  if (!reacts.length) return;

  for (const react of reacts) {
    const trigger = react.caseSensitive ? react.trigger : react.trigger.toLowerCase();
    const content = react.caseSensitive ? message.content : message.content.toLowerCase();
    const match = react.matchType === 'exact'
      ? content.trim() === trigger
      : content.includes(trigger);
    if (!match) continue;

    const emoji = parseEmoji(react.emoji);
    if (!emoji) continue;
    try {
      await message.react(emoji);
    } catch {
      // Ignore invalid emoji or permission errors
    }
  }
};
