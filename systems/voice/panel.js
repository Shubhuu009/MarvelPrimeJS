const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  UserSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { getOwner, setOwner } = require('../../database/voice');

const PANEL_PREFIX = 'vcpanel';
const NOT_OWNER_MESSAGE = 'You are not the owner of this voice channel.';

const buildVoicePanelEmbed = (guild) => new EmbedBuilder()
  .setColor(0x0f172a)
  .setTitle('Voice Channel Control Panel')
  .setDescription('Click the buttons below to manage your voice channel.')
  .addFields({
    name: 'Button Usage',
    value: [
      '🔒 — Lock the voice channel',
      '🔓 — Unlock the voice channel',
      '👻 — Ghost the voice channel',
      '👁️ — Reveal the voice channel',
      '🎤 — Claim the voice channel',
      '🔨 — Disconnect a member',
      '➕ — Increase the user limit',
      '➖ — Decrease the user limit',
      '⛔ — Block a user',
      '✅ — Unblock a user',
    ].join('\n'),
  })
  .setFooter({ text: guild?.name || 'VoiceMaster', iconURL: guild?.iconURL?.({ dynamic: true }) || undefined });

const buildVoicePanelComponents = () => {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:lock`).setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:unlock`).setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:ghost`).setLabel('Ghost').setEmoji('👻').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:reveal`).setLabel('Reveal').setEmoji('👁️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:claim`).setLabel('Claim').setEmoji('🎤').setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:disconnect`).setLabel('Disconnect').setEmoji('🔨').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:limit_up`).setLabel('Increase').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:limit_down`).setLabel('Decrease').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:block`).setLabel('Block User').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${PANEL_PREFIX}:unblock`).setLabel('Unblock User').setEmoji('✅').setStyle(ButtonStyle.Success),
  );

  return [row1, row2];
};

const replyEphemeral = async (interaction, content) => {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content, ephemeral: true }).catch(() => null);
  }
  return interaction.reply({ content, ephemeral: true }).catch(() => null);
};

const resolveOwnerContext = async (guild, member, channel) => {
  let doc = await getOwner(guild.id, channel.id);
  if (!doc) {
    doc = await setOwner(guild.id, channel.id, member.id);
  }

  const ownerId = doc.ownerId;
  const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
  const ownerInChannel = ownerMember?.voice?.channelId === channel.id;
  const isOwner = ownerId === member.id;
  return { ownerId, ownerMember, ownerInChannel, isOwner };
};

const ensureBotPerms = (guild, perms) => {
  const botMember = guild.members.me || guild.members.cache.get(guild.client.user.id);
  return botMember?.permissions?.has(perms);
};

const openUserSelect = async (interaction, action, channelId, label) => {
  const menu = new UserSelectMenuBuilder()
    .setCustomId(`${PANEL_PREFIX}:select:${action}:${channelId}`)
    .setPlaceholder(label)
    .setMinValues(1)
    .setMaxValues(1);
  const row = new ActionRowBuilder().addComponents(menu);
  return interaction.reply({
    content: `Select a user to ${label.toLowerCase()}.`,
    components: [row],
    ephemeral: true,
  });
};

const handleButton = async (interaction) => {
  const action = interaction.customId.split(':')[1];
  const guild = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) return false;
  if (!member.voice?.channel) {
    await replyEphemeral(interaction, 'You must be in a voice channel to use this panel.');
    return true;
  }

  const channel = member.voice.channel;
  const { ownerId, ownerInChannel, isOwner } = await resolveOwnerContext(guild, member, channel);

  if (action !== 'claim' && !isOwner) {
    await replyEphemeral(interaction, NOT_OWNER_MESSAGE);
    return true;
  }

  if (action === 'claim') {
    if (ownerInChannel) {
      await replyEphemeral(interaction, NOT_OWNER_MESSAGE);
      return true;
    }
    await setOwner(guild.id, channel.id, member.id);
    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    }).catch(() => null);
    await replyEphemeral(interaction, 'You are now the owner of this voice channel.');
    return true;
  }

  if (!ensureBotPerms(guild, PermissionsBitField.Flags.ManageChannels)) {
    await replyEphemeral(interaction, 'I need **Manage Channels** permission to do that.');
    return true;
  }

  if (action === 'lock') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }, { reason: `Voice Panel: lock by ${member.user.tag}` });
    await replyEphemeral(interaction, 'Voice channel locked.');
    return true;
  }

  if (action === 'unlock') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null }, { reason: `Voice Panel: unlock by ${member.user.tag}` });
    await replyEphemeral(interaction, 'Voice channel unlocked.');
    return true;
  }

  if (action === 'ghost') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }, { reason: `Voice Panel: ghost by ${member.user.tag}` });
    await channel.permissionOverwrites.edit(ownerId, { ViewChannel: true, Connect: true }, { reason: 'Voice Panel: keep owner access' }).catch(() => null);
    await replyEphemeral(interaction, 'Voice channel hidden (ghosted).');
    return true;
  }

  if (action === 'reveal') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null }, { reason: `Voice Panel: reveal by ${member.user.tag}` });
    await replyEphemeral(interaction, 'Voice channel revealed.');
    return true;
  }

  if (action === 'limit_up') {
    const next = Math.min(99, (channel.userLimit || 0) + 1);
    await channel.setUserLimit(next, `Voice Panel: increase by ${member.user.tag}`);
    await replyEphemeral(interaction, `User limit increased to **${next || 'Unlimited'}**.`);
    return true;
  }

  if (action === 'limit_down') {
    const next = Math.max(0, (channel.userLimit || 0) - 1);
    await channel.setUserLimit(next, `Voice Panel: decrease by ${member.user.tag}`);
    await replyEphemeral(interaction, `User limit decreased to **${next || 'Unlimited'}**.`);
    return true;
  }

  if (action === 'disconnect') {
    if (!ensureBotPerms(guild, PermissionsBitField.Flags.MoveMembers)) {
      await replyEphemeral(interaction, 'I need **Move Members** permission to disconnect users.');
      return true;
    }
    await openUserSelect(interaction, 'disconnect', channel.id, 'Disconnect');
    return true;
  }

  if (action === 'block') {
    await openUserSelect(interaction, 'block', channel.id, 'Block');
    return true;
  }

  if (action === 'unblock') {
    await openUserSelect(interaction, 'unblock', channel.id, 'Unblock');
    return true;
  }

  return false;
};

const handleSelect = async (interaction) => {
  const parts = interaction.customId.split(':');
  if (parts.length < 4) return false;
  const action = parts[2];
  const channelId = parts[3];

  const guild = interaction.guild;
  const member = interaction.member;
  if (!guild || !member) return false;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await interaction.update({ content: 'Voice channel not found.', components: [] }).catch(() => null);
    return true;
  }

  if (member.voice?.channelId !== channelId) {
    await interaction.update({ content: 'You must be in the target voice channel to do that.', components: [] }).catch(() => null);
    return true;
  }

  const { ownerId, ownerInChannel, isOwner } = await resolveOwnerContext(guild, member, channel);
  if (action !== 'claim' && !isOwner) {
    await interaction.update({ content: NOT_OWNER_MESSAGE, components: [] }).catch(() => null);
    return true;
  }

  const targetId = interaction.values?.[0];
  if (!targetId) {
    await interaction.update({ content: 'No user selected.', components: [] }).catch(() => null);
    return true;
  }

  const targetMember = await guild.members.fetch(targetId).catch(() => null);
  if (!targetMember) {
    await interaction.update({ content: 'User not found.', components: [] }).catch(() => null);
    return true;
  }

  if (!ensureBotPerms(guild, PermissionsBitField.Flags.ManageChannels)) {
    await interaction.update({ content: 'I need **Manage Channels** permission to do that.', components: [] }).catch(() => null);
    return true;
  }

  if (action === 'disconnect') {
    if (!ensureBotPerms(guild, PermissionsBitField.Flags.MoveMembers)) {
      await interaction.update({ content: 'I need **Move Members** permission to disconnect users.', components: [] }).catch(() => null);
      return true;
    }
    if (targetMember.voice?.channelId !== channelId) {
      await interaction.update({ content: 'That user is not in your voice channel.', components: [] }).catch(() => null);
      return true;
    }
    await targetMember.voice.disconnect().catch(() => null);
    await interaction.update({ content: `Disconnected <@${targetId}> from the voice channel.`, components: [] }).catch(() => null);
    return true;
  }

  if (action === 'block') {
    if (targetMember.voice?.channelId === channelId) {
      await targetMember.voice.disconnect().catch(() => null);
    }
    await channel.permissionOverwrites.edit(targetId, { Connect: false }, { reason: `Voice Panel: block by ${member.user.tag}` });
    await interaction.update({ content: `Blocked <@${targetId}> from joining this voice channel.`, components: [] }).catch(() => null);
    return true;
  }

  if (action === 'unblock') {
    await channel.permissionOverwrites.edit(targetId, { Connect: null }, { reason: `Voice Panel: unblock by ${member.user.tag}` });
    await interaction.update({ content: `Unblocked <@${targetId}> from this voice channel.`, components: [] }).catch(() => null);
    return true;
  }

  if (action === 'claim') {
    if (ownerInChannel) {
      await interaction.update({ content: NOT_OWNER_MESSAGE, components: [] }).catch(() => null);
      return true;
    }
    await setOwner(guild.id, channel.id, member.id);
    await interaction.update({ content: 'You are now the owner of this voice channel.', components: [] }).catch(() => null);
    return true;
  }

  return false;
};

const handleVoicePanelInteraction = async (client, interaction) => {
  if (!interaction) return false;
  if (interaction.isButton?.()) {
    if (!interaction.customId?.startsWith(`${PANEL_PREFIX}:`)) return false;
    return handleButton(interaction);
  }
  if (interaction.isUserSelectMenu?.()) {
    if (!interaction.customId?.startsWith(`${PANEL_PREFIX}:select:`)) return false;
    return handleSelect(interaction);
  }
  return false;
};

module.exports = {
  buildVoicePanelEmbed,
  buildVoicePanelComponents,
  handleVoicePanelInteraction,
};
