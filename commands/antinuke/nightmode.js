const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

const BOT_NAME = 'Marvel';
const DEFAULT_COLOR = 0x2f3136;

const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;
const statusColor = (enabled) => enabled
  ? (Embeds?.COLORS?.success || DEFAULT_COLOR)
  : (Embeds?.COLORS?.error || DEFAULT_COLOR);

const buildHelpEmbed = (client, guild, executor) => {
  const avatar = executor?.displayAvatarURL
    ? executor.displayAvatarURL({ dynamic: true })
    : executor?.user?.displayAvatarURL?.({ dynamic: true });
  return new EmbedBuilder()
    .setColor(infoColor())
    .setTitle('Marvel Nightmode')
    .setDescription(
      'Nightmode temporarily removes ADMINISTRATOR from manageable roles and stores original permissions for a clean restore.'
    )
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setAuthor({ name: executor?.user?.tag || executor?.tag || 'Nightmode', iconURL: avatar })
    .addFields(
      { name: '/nightmode enable', value: 'Disable ADMINISTRATOR on manageable roles.' },
      { name: '/nightmode disable', value: 'Restore original permissions for those roles.' },
      { name: '/nightmode status', value: 'View current nightmode status.' }
    )
    .setFooter({ text: `Protected by ${BOT_NAME}`, iconURL: client.user.displayAvatarURL() });
};

const getNightmodeState = (settings) => settings?.antinuke?.nightmode || { enabled: false, roles: [] };

const serializePermissions = (permissions) => permissions?.bitfield?.toString() || '0';
const deserializePermissions = (bitfield) => new PermissionsBitField(BigInt(bitfield || 0));

module.exports = {
  name: 'nightmode',
  description: 'Toggle nightmode to remove and restore ADMINISTRATOR on roles',
  aliases: [],
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('nightmode')
    .setDescription('Manage nightmode')
    .addSubcommand(s => s.setName('enable').setDescription('Enable nightmode'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable nightmode'))
    .addSubcommand(s => s.setName('status').setDescription('Nightmode status')),

  async execute({ client, message, interaction, args, settings, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;
    const guildSettings = settings || await getGuildSettings(client, guild.id);

    const isOwner = executor.id === guild.ownerId || (process.env.OWNER_IDS || '').split(',').includes(executor.id);
    const isExtraOwner = guildSettings?.antinuke?.extraOwners?.includes(executor.id);

    const reply = (embed, ephemeral = false) => (
      isSlash
        ? interaction.reply({ embeds: [embed], ephemeral })
        : message.reply({ embeds: [embed] })
    );

    if (!isOwner && !isExtraOwner) {
      return reply(Embeds.error('No Permission', 'Only the server owner or extra owners can manage nightmode.'), true);
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    if (!sub) return reply(buildHelpEmbed(client, guild, executor));

    if (sub === 'status') {
      const state = getNightmodeState(guildSettings);
      const embed = new EmbedBuilder()
        .setColor(statusColor(state.enabled))
        .setTitle('Nightmode Status')
        .addFields(
          { name: 'Status', value: state.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Stored Roles', value: String(state.roles?.length || 0), inline: true },
        )
        .setFooter({ text: `Protected by ${BOT_NAME}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
      return reply(embed);
    }

    const botMember = guild.members.me || guild.members.cache.get(client.user.id);
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return reply(Embeds.error('Missing Permission', 'I need Manage Roles to run nightmode.'), true);
    }

    if (sub === 'enable') {
      const botHighestRole = botMember.roles.highest;
      const manageableRoles = guild.roles.cache.filter((role) =>
        role.name !== '@everyone' &&
        role.permissions.has(PermissionsBitField.Flags.Administrator) &&
        role.comparePositionTo(botHighestRole) < 0
      );

      if (manageableRoles.size === 0) {
        return reply(Embeds.info('Nightmode', 'No manageable roles with ADMINISTRATOR found.'));
      }

      const roleData = [];
      for (const role of manageableRoles.values()) {
        roleData.push({ id: role.id, perms: serializePermissions(role.permissions) });
      }

      await updateGuildSettings(client, guild.id, {
        $set: { 'antinuke.nightmode.enabled': true, 'antinuke.nightmode.roles': roleData },
      });

      for (const role of manageableRoles.values()) {
        const newPerms = new PermissionsBitField(role.permissions).remove(PermissionsBitField.Flags.Administrator);
        await role.setPermissions(newPerms, `${BOT_NAME} nightmode enabled`);
      }

      const embed = new EmbedBuilder()
        .setColor(statusColor(true))
        .setTitle('Nightmode Enabled')
        .setDescription(`ADMINISTRATOR removed from ${manageableRoles.size} role(s).`)
        .setFooter({ text: `Protected by ${BOT_NAME}`, iconURL: client.user.displayAvatarURL() });
      return reply(embed);
    }

    if (sub === 'disable') {
      const state = getNightmodeState(guildSettings);
      const stored = state.roles || [];

      for (const item of stored) {
        const role = guild.roles.cache.get(item.id);
        if (!role) continue;
        const restored = deserializePermissions(item.perms);
        await role.setPermissions(restored, `${BOT_NAME} nightmode disabled`);
      }

      await updateGuildSettings(client, guild.id, {
        $set: { 'antinuke.nightmode.enabled': false, 'antinuke.nightmode.roles': [] },
      });

      const embed = new EmbedBuilder()
        .setColor(statusColor(false))
        .setTitle('Nightmode Disabled')
        .setDescription(`Restored permissions for ${stored.length} role(s).`)
        .setFooter({ text: `Protected by ${BOT_NAME}`, iconURL: client.user.displayAvatarURL() });
      return reply(embed);
    }

    return reply(buildHelpEmbed(client, guild, executor));
  },
};
