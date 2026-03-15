const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const Embeds = require('./embeds');
const BlacklistManager = require('../systems/blacklist/blacklist');

const DEFAULT_PREFIX = '.';
const DEFAULT_COOLDOWN = 3;

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
};

const resolveCommand = (client, name) => {
  if (!name) return null;
  const direct = client.commands.get(name);
  if (direct) return direct;
  const alias = client.aliases.get(name);
  return alias ? client.commands.get(alias) : null;
};

const getCooldownLeft = (client, command, userId) => {
  const now = Date.now();
  const cooldowns = client.cooldowns;
  if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());
  const timestamps = cooldowns.get(command.name);
  const cooldownMs = (command.cooldown || DEFAULT_COOLDOWN) * 1000;
  const last = timestamps.get(userId);
  if (last) {
    const expires = last + cooldownMs;
    if (now < expires) return Math.ceil((expires - now) / 1000);
  }
  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownMs);
  return 0;
};

const loadCommands = (client, commandsDir = path.join(__dirname, '..', 'commands')) => {
  const commands = new Collection();
  const aliases = new Collection();
  const slashCommands = [];

  const files = walk(commandsDir);
  for (const file of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const command = require(file);
    if (!command || !command.name) continue;
    commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
      command.aliases.forEach((alias) => aliases.set(alias, command.name));
    }

    const slash = command.slashData || command.data || (command.slash?.toJSON ? command.slash : null);
    if (slash) slashCommands.push(slash);
  }

  client.commands = commands;
  client.aliases = aliases;
  client.slashCommands = slashCommands;
  return { commands, aliases, slashCommands };
};

const handleMessageCommand = async (client, message) => {
  if (!message?.guild || message.author?.bot) return;
  if (!message.content) return;
  if (BlacklistManager.isGuildBlocked(message.guild.id)) return;
  if (BlacklistManager.isUserBlocked(message.author.id)) return;

  const prefix = process.env.PREFIX || DEFAULT_PREFIX;
  const noPrefix = String(process.env.NO_PREFIX || '').toLowerCase() === 'true';
  const envNoPrefixUsers = new Set(
    (process.env.NO_PREFIX_USERS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const runtimeNoPrefixUsers = client.noPrefixUsers instanceof Set ? client.noPrefixUsers : new Set();
  const noPrefixUsers = new Set([...envNoPrefixUsers, ...runtimeNoPrefixUsers]);

  const content = message.content.trim();
  if (!content.length) return;

  let usedPrefix = null;
  const mentionPrefix = new RegExp(`^<@!?${client.user.id}>(\\s+)?`);
  const mentionMatch = content.match(mentionPrefix);
  if (mentionMatch) usedPrefix = mentionMatch[0];
  else if (prefix && content.startsWith(prefix)) usedPrefix = prefix;
  else if (noPrefix && (!noPrefixUsers.size || noPrefixUsers.has(message.author.id))) usedPrefix = '';
  else if (!noPrefix && noPrefixUsers.has(message.author.id)) usedPrefix = '';
  else return;

  const withoutPrefix = content.slice(usedPrefix.length).trim();
  if (!withoutPrefix) return;

  const args = withoutPrefix.split(/\s+/);
  const name = args.shift()?.toLowerCase();
  const command = resolveCommand(client, name);
  if (!command) return;

  const cooldownLeft = getCooldownLeft(client, command, message.author.id);
  if (cooldownLeft > 0) {
    const embed = Embeds.warning('Cooldown', `Please wait **${cooldownLeft}s** before using this command again.`);
    await message.reply({ embeds: [embed] }).catch(() => null);
    return;
  }

  try {
    await command.execute({ client, message, args, isSlash: false });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Command error:', err);
    const embed = Embeds.error('Error', 'Something went wrong while executing this command.');
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};

const handleInteractionCommand = async (client, interaction) => {
  if (!interaction?.isChatInputCommand?.()) return;
  if (BlacklistManager.isGuildBlocked(interaction.guildId)) return;
  if (BlacklistManager.isUserBlocked(interaction.user?.id)) return;

  const command = resolveCommand(client, interaction.commandName);
  if (!command) return;

  const cooldownLeft = getCooldownLeft(client, command, interaction.user.id);
  if (cooldownLeft > 0) {
    const embed = Embeds.warning('Cooldown', `Please wait **${cooldownLeft}s** before using this command again.`);
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
    return;
  }

  try {
    await command.execute({ client, interaction, args: [], isSlash: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Slash command error:', err);
    const embed = Embeds.error('Error', 'Something went wrong while executing this command.');
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
    }
  }
};

module.exports = {
  loadCommands,
  handleMessageCommand,
  handleInteractionCommand,
};
