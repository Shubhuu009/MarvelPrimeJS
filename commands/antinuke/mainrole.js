const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

const MAX_MAINROLES = 5;
const DEFAULT_COLOR = 0x2f3136;

const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;

const buildHelpEmbed = (client, guild, executor) => {
  const avatar = executor?.displayAvatarURL
    ? executor.displayAvatarURL({ dynamic: true })
    : executor?.user?.displayAvatarURL?.({ dynamic: true });
  return new EmbedBuilder()
    .setColor(infoColor())
    .setTitle('Marvel Main Role')
    .setDescription(`Configure main roles used by antinuke. Max ${MAX_MAINROLES} roles.`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setAuthor({ name: executor?.user?.tag || executor?.tag || 'Main Role', iconURL: avatar })
    .addFields(
      { name: '/mainrole add <role>', value: 'Add a role to the mainrole configuration.' },
      { name: '/mainrole remove <role>', value: 'Remove a role from the mainrole configuration.' },
      { name: '/mainrole list', value: 'Show the current mainrole configuration.' },
      { name: '/mainrole reset', value: 'Clear all configured main roles.' },
    )
    .setFooter({
      text: 'Note: Anti Role Ping requires main roles to be configured.',
      iconURL: client.user.displayAvatarURL(),
    });
};

const getMainroles = (settings) => settings?.antinuke?.mainrole || [];

const formatRoleList = (guild, roleIds) => {
  if (roleIds.length === 0) return 'No main roles are configured for this server.';
  const lines = roleIds
    .map((id) => guild.roles.cache.get(id))
    .filter(Boolean)
    .map((role) => `${role.name} (${role.id})`)
    .join('\n');
  return lines || 'No main roles are configured for this server.';
};

const findMatchingRoles = (guild, query) => {
  const ROLE_MENTION = /<?@?&?(\d{17,20})>?/;
  if (!guild || !query || typeof query !== 'string') return [];

  const patternMatch = query.match(ROLE_MENTION);
  if (patternMatch) {
    const id = patternMatch[1];
    const role = guild.roles.cache.find((r) => r.id === id);
    if (role) return [role];
  }

  const exact = [];
  const startsWith = [];
  const includes = [];
  guild.roles.cache.forEach((role) => {
    const lowerName = role.name.toLowerCase();
    if (role.name === query) exact.push(role);
    if (lowerName.startsWith(query.toLowerCase())) startsWith.push(role);
    if (lowerName.includes(query.toLowerCase())) includes.push(role);
  });
  if (exact.length > 0) return exact;
  if (startsWith.length > 0) return startsWith;
  if (includes.length > 0) return includes;
  return [];
};

module.exports = {
  name: 'mainrole',
  description: 'Configure antinuke main roles',
  aliases: ['mr'],
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('mainrole')
    .setDescription('Manage antinuke main roles')
    .addSubcommand(s => s.setName('add').setDescription('Add a main role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a main role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List configured main roles'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset configured main roles')),

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
      return reply(Embeds.error('No Permission', 'Only the server owner or extra owners can manage main roles.'), true);
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    if (!sub) return reply(buildHelpEmbed(client, guild, executor));

    if (sub === 'list') {
      const roles = getMainroles(guildSettings);
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Main Roles')
        .setDescription(formatRoleList(guild, roles))
        .setFooter({ text: `Total: ${roles.length}/${MAX_MAINROLES}`, iconURL: client.user.displayAvatarURL() });
      return reply(embed);
    }

    if (sub === 'reset') {
      await updateGuildSettings(client, guild.id, { $set: { 'antinuke.mainrole': [] } });
      return reply(Embeds.success('Main Roles Reset', 'All main roles have been cleared.'));
    }

    const botMember = guild.members.me || guild.members.cache.get(client.user.id);
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return reply(Embeds.error('Missing Permission', 'I need Manage Roles to configure main roles.'), true);
    }

    const role = isSlash
      ? interaction.options.getRole('role')
      : findMatchingRoles(guild, args.slice(1).join(' '))[0];

    if (!role) {
      return reply(Embeds.error('Role Not Found', 'Please provide a valid role.'), true);
    }

    if (role.managed) {
      return reply(Embeds.error('Invalid Role', 'That role is managed by an integration.'), true);
    }

    if (role.id === guild.id) {
      return reply(Embeds.error('Invalid Role', 'The everyone role cannot be used as a main role.'), true);
    }

    if (role.position >= botMember.roles.highest.position) {
      return reply(Embeds.error('Role Too High', 'That role is higher or equal to my highest role.'), true);
    }

    const current = getMainroles(guildSettings);

    if (sub === 'add') {
      if (current.includes(role.id)) {
        return reply(Embeds.warning('Already Added', 'That role is already in the mainrole configuration.'), true);
      }
      if (current.length >= MAX_MAINROLES) {
        return reply(Embeds.error('Limit Reached', `You can only set ${MAX_MAINROLES} main roles.`), true);
      }
      await updateGuildSettings(client, guild.id, { $addToSet: { 'antinuke.mainrole': role.id } });
      return reply(Embeds.success('Main Role Added', `Added **${role.name}** to main roles.`));
    }

    if (sub === 'remove') {
      if (!current.includes(role.id)) {
        return reply(Embeds.error('Not Found', 'That role is not in the mainrole configuration.'), true);
      }
      await updateGuildSettings(client, guild.id, { $pull: { 'antinuke.mainrole': role.id } });
      return reply(Embeds.success('Main Role Removed', `Removed **${role.name}** from main roles.`));
    }

    return reply(buildHelpEmbed(client, guild, executor));
  },
};
