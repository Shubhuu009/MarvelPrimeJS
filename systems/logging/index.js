const {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  WebhookClient,
  PermissionsBitField,
} = require('discord.js');
const { getOrCreateSettings } = require('../../database/logging');
const BlacklistManager = require('../blacklist/blacklist');

const CHANNEL_NAMES = {
  message: 'xieron-message-logs',
  member: 'xieron-member-logs',
  server: 'xieron-server-logs',
  voice: 'xieron-voice-logs',
  channel: 'xieron-channel-logs',
  role: 'xieron-role-logs',
  mod: 'xieron-mod-logs',
};

const CATEGORY_NAME = process.env.LOG_CATEGORY_NAME || 'xieron-logs';
const DEFAULT_COLOR = 0x0ea5e9;

const getWebhookName = (guild) => process.env.LOG_WEBHOOK_NAME || `${guild.name} Logs`;
const getWebhookAvatar = (client) => (
  process.env.LOG_WEBHOOK_AVATAR_URL
  || client.user.displayAvatarURL({ extension: 'png', size: 256 })
);

const ensureCategory = async (guild, settings) => {
  let category = settings.categoryId ? guild.channels.cache.get(settings.categoryId) : null;
  if (!category) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME.toLowerCase()
    );
  }
  if (!category) {
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: 'Logging setup',
    });
  }
  settings.categoryId = category.id;
  return category;
};

const ensureChannel = async (guild, settings, type, category) => {
  const existingId = settings.channels?.[type];
  let channel = existingId ? guild.channels.cache.get(existingId) : null;
  if (!channel) {
    channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES[type]
    );
  }
  if (!channel) {
    channel = await guild.channels.create({
      name: CHANNEL_NAMES[type],
      type: ChannelType.GuildText,
      parent: category?.id || null,
      reason: 'Logging setup',
    });
  }
  settings.channels = settings.channels || {};
  settings.channels[type] = channel.id;
  return channel;
};

const ensureWebhook = async (client, channel, settings, type) => {
  settings.webhooks = settings.webhooks || {};
  const existing = settings.webhooks[type];
  if (existing?.id && existing?.token && existing?.channelId === channel.id) {
    try {
      const hooks = await channel.fetchWebhooks();
      const hook = hooks.get(existing.id);
      if (hook) {
        const name = settings.webhookName || getWebhookName(channel.guild);
        const avatar = settings.webhookAvatar || getWebhookAvatar(client);
        if (hook.name !== name) {
          await hook.edit({ name, avatar });
        }
      }
    } catch {
      // ignore
    }
    return existing;
  }

  const name = settings.webhookName || getWebhookName(channel.guild);
  const avatar = settings.webhookAvatar || getWebhookAvatar(client);
  const webhook = await channel.createWebhook({
    name,
    avatar,
    reason: 'Logging setup',
  });

  const data = { id: webhook.id, token: webhook.token, channelId: channel.id };
  settings.webhooks[type] = data;
  return data;
};

const ensureSetup = async (client, guild) => {
  const settings = await getOrCreateSettings(guild.id);

  const botMember = guild.members.me || guild.members.cache.get(client.user.id);
  if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
    throw new Error('Missing Manage Channels permission.');
  }
  if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageWebhooks)) {
    throw new Error('Missing Manage Webhooks permission.');
  }

  const category = await ensureCategory(guild, settings);
  const types = Object.keys(CHANNEL_NAMES);
  for (const type of types) {
    const channel = await ensureChannel(guild, settings, type, category);
    await ensureWebhook(client, channel, settings, type);
  }

  settings.enabled = true;
  settings.webhookName = settings.webhookName || getWebhookName(guild);
  settings.webhookAvatar = settings.webhookAvatar || getWebhookAvatar(client);
  await settings.save();
  return settings;
};

const sendLog = async (client, guild, type, embed) => {
  try {
    if (!guild || !type || !embed) return;
    if (BlacklistManager.isGuildBlocked(guild.id)) return;

    const settings = await getOrCreateSettings(guild.id);
    if (!settings.enabled) return;

    let channelId = settings.channels?.[type];
    let channel = channelId ? guild.channels.cache.get(channelId) : null;

    if (!channel) {
      const category = settings.categoryId ? guild.channels.cache.get(settings.categoryId) : null;
      channel = await ensureChannel(guild, settings, type, category);
    }

    const hook = await ensureWebhook(client, channel, settings, type);
    await settings.save();

    const webhook = new WebhookClient({ id: hook.id, token: hook.token });
    const username = settings.webhookName || getWebhookName(guild);
    const avatarURL = settings.webhookAvatar || getWebhookAvatar(client);

    if (process.env.LOG_EMBED_BANNER_URL) {
      embed.setImage(process.env.LOG_EMBED_BANNER_URL);
    }

    await webhook.send({
      embeds: [embed],
      username,
      avatarURL,
      allowedMentions: { parse: [] },
    }).catch(() => null);
  } catch {
    // swallow logging errors
  }
};

const makeEmbed = (title, description, color = DEFAULT_COLOR) => new EmbedBuilder()
  .setColor(color)
  .setTitle(title)
  .setDescription(description)
  .setTimestamp();

const safeContent = (content, limit = 1024) => {
  if (!content) return '`No content`';
  if (content.length <= limit) return content;
  return `${content.slice(0, limit - 3)}...`;
};

const registerLogging = (client) => {
  client.on('messageDelete', async (message) => {
    if (!message?.guild) return;
    if (message.partial) {
      try { await message.fetch(); } catch { /* ignore */ }
    }
    const embed = makeEmbed(
      'Message Deleted',
      [
        `**Author:** ${message.author ? `${message.author.tag} (\`${message.author.id}\`)` : 'Unknown'}`,
        `**Channel:** <#${message.channel.id}>`,
        `**Content:** ${safeContent(message.content)}`,
      ].join('\n')
    );
    await sendLog(client, message.guild, 'message', embed);
  });

  client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!newMsg?.guild) return;
    if (oldMsg.partial) {
      try { await oldMsg.fetch(); } catch { /* ignore */ }
    }
    if (newMsg.partial) {
      try { await newMsg.fetch(); } catch { /* ignore */ }
    }
    if (oldMsg.content === newMsg.content) return;
    const embed = makeEmbed(
      'Message Edited',
      [
        `**Author:** ${newMsg.author ? `${newMsg.author.tag} (\`${newMsg.author.id}\`)` : 'Unknown'}`,
        `**Channel:** <#${newMsg.channel.id}>`,
        `**Before:** ${safeContent(oldMsg.content)}`,
        `**After:** ${safeContent(newMsg.content)}`,
      ].join('\n')
    );
    await sendLog(client, newMsg.guild, 'message', embed);
  });

  client.on('guildMemberAdd', async (member) => {
    if (!member?.guild) return;
    const embed = makeEmbed(
      'Member Joined',
      `**User:** ${member.user.tag} (\`${member.id}\`)\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`
    );
    await sendLog(client, member.guild, 'member', embed);
  });

  client.on('guildMemberRemove', async (member) => {
    if (!member?.guild) return;
    let kickedBy = null;
    try {
      const audits = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
      const entry = audits.entries.first();
      if (entry && entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 5000) {
        kickedBy = entry.executor?.tag;
      }
    } catch {
      // ignore
    }
    const embed = makeEmbed(
      kickedBy ? 'Member Kicked' : 'Member Left',
      [
        `**User:** ${member.user.tag} (\`${member.id}\`)`,
        kickedBy ? `**Kicked By:** ${kickedBy}` : null,
      ].filter(Boolean).join('\n')
    );
    await sendLog(client, member.guild, kickedBy ? 'mod' : 'member', embed);
  });

  client.on('guildBanAdd', async (ban) => {
    if (!ban?.guild) return;
    const embed = makeEmbed(
      'Member Banned',
      `**User:** ${ban.user.tag} (\`${ban.user.id}\`)\n**Reason:** ${ban.reason || 'No reason provided'}`
    );
    await sendLog(client, ban.guild, 'mod', embed);
  });

  client.on('guildBanRemove', async (ban) => {
    if (!ban?.guild) return;
    const embed = makeEmbed(
      'Member Unbanned',
      `**User:** ${ban.user.tag} (\`${ban.user.id}\`)`
    );
    await sendLog(client, ban.guild, 'mod', embed);
  });

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const user = newState.member?.user || oldState.member?.user;
    if (!user) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    if (oldChannel?.id === newChannel?.id) return;

    let desc = '';
    if (!oldChannel && newChannel) {
      desc = `**User:** ${user.tag} (\`${user.id}\`)\n**Joined:** ${newChannel.name}`;
    } else if (oldChannel && !newChannel) {
      desc = `**User:** ${user.tag} (\`${user.id}\`)\n**Left:** ${oldChannel.name}`;
    } else {
      desc = `**User:** ${user.tag} (\`${user.id}\`)\n**Moved:** ${oldChannel.name} → ${newChannel.name}`;
    }
    const embed = makeEmbed('Voice Update', desc);
    await sendLog(client, guild, 'voice', embed);
  });

  client.on('channelCreate', async (channel) => {
    if (!channel?.guild) return;
    const embed = makeEmbed(
      'Channel Created',
      `**Channel:** ${channel.name}\n**Type:** ${channel.type}`
    );
    await sendLog(client, channel.guild, 'channel', embed);
  });

  client.on('channelDelete', async (channel) => {
    if (!channel?.guild) return;
    const embed = makeEmbed(
      'Channel Deleted',
      `**Channel:** ${channel.name}\n**Type:** ${channel.type}`
    );
    await sendLog(client, channel.guild, 'channel', embed);
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel?.guild) return;
    if (oldChannel.name === newChannel.name) return;
    const embed = makeEmbed(
      'Channel Updated',
      `**Before:** ${oldChannel.name}\n**After:** ${newChannel.name}`
    );
    await sendLog(client, newChannel.guild, 'channel', embed);
  });

  client.on('roleCreate', async (role) => {
    const embed = makeEmbed(
      'Role Created',
      `**Role:** ${role.name} (\`${role.id}\`)`
    );
    await sendLog(client, role.guild, 'role', embed);
  });

  client.on('roleDelete', async (role) => {
    const embed = makeEmbed(
      'Role Deleted',
      `**Role:** ${role.name} (\`${role.id}\`)`
    );
    await sendLog(client, role.guild, 'role', embed);
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    if (oldRole.name === newRole.name) return;
    const embed = makeEmbed(
      'Role Updated',
      `**Before:** ${oldRole.name}\n**After:** ${newRole.name}`
    );
    await sendLog(client, newRole.guild, 'role', embed);
  });

  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (oldGuild.name === newGuild.name) return;
    const embed = makeEmbed(
      'Server Updated',
      `**Before:** ${oldGuild.name}\n**After:** ${newGuild.name}`
    );
    await sendLog(client, newGuild, 'server', embed);
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!newMember?.guild) return;
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const timedOut = newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now();
      const embed = makeEmbed(
        timedOut ? 'Member Timed Out' : 'Timeout Removed',
        `**User:** ${newMember.user.tag} (\`${newMember.id}\`)\n**Until:** ${timedOut ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>` : 'N/A'}`
      );
      await sendLog(client, newMember.guild, 'mod', embed);
    }
  });
};

module.exports = {
  ensureSetup,
  sendLog,
  registerLogging,
};
