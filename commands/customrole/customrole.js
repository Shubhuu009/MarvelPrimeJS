const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const Embeds = require('../../utils/embeds');
const {
  getRole,
  getRoles,
  upsertRole,
  deleteRole,
  getPermission,
  setPermission,
  clearPermission,
} = require('../../database/customrole');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;

const SUB_LIMITS = {
  free: 5,
  silver_guild_preminum: 10,
  golden_guild_premium: 15,
  diamond_guild_premium: 20,
};

module.exports = {
  name: 'customrole',
  description: 'Manage custom role commands',
  aliases: ['customroles', 'cr'],
  category: 'customrole',
  cooldown: 2,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('customrole')
    .setDescription('Manage custom role commands')
    .addSubcommand(s => s.setName('add').setDescription('Add a custom role command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a custom role command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true)))
    .addSubcommand(s => s.setName('update').setDescription('Update a custom role command')
      .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List custom roles'))
    .addSubcommand(s => s.setName('setreqrole').setDescription('Set required role for custom role commands')
      .addRoleOption(o => o.setName('role').setDescription('Required role').setRequired(true)))
    .addSubcommand(s => s.setName('reqrole').setDescription('Show required role for custom role commands'))
    .addSubcommand(s => s.setName('clearreqrole').setDescription('Clear required role')),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;

    const reply = (payload) => (
      isSlash
        ? interaction.reply(payload)
        : message.reply(payload)
    );

    if (!executor.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return reply({ embeds: [Embeds.error('No Permission', 'Administrator permission required.')], ephemeral: true });
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    if (!sub) {
      const help = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Custom Role Commands')
        .setDescription('Use `/customrole <add|remove|update|list|setreqrole|reqrole|clearreqrole>`');
      return reply({ embeds: [help] });
    }

    if (sub === 'list') {
      const roles = await getRoles(guild.id);
      if (!roles.length) {
        return reply({ embeds: [Embeds.error('Custom Roles', 'No custom roles have been setup.')] });
      }
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Custom Roles')
        .setDescription(roles.map((r) => `\`${r.name}\` - <@&${r.roleId}>`).join('\n'));
      return reply({ embeds: [embed] });
    }

    if (sub === 'reqrole') {
      const perm = await getPermission(guild.id);
      if (!perm?.requiredRoleId) {
        return reply({ embeds: [Embeds.error('Required Role', 'No required role has been set.')] });
      }
      const role = guild.roles.cache.get(perm.requiredRoleId);
      if (!role) {
        await clearPermission(guild.id);
        return reply({ embeds: [Embeds.error('Required Role', 'Required role no longer exists.')] });
      }
      return reply({ embeds: [Embeds.success('Required Role', `Required role is ${role}.`)] });
    }

    if (sub === 'setreqrole') {
      const role = isSlash ? interaction.options.getRole('role') : message.mentions.roles.first();
      if (!role) return reply({ embeds: [Embeds.error('Invalid Role', 'Please provide a valid role.')], ephemeral: true });
      await setPermission(guild.id, role.id);
      return reply({ embeds: [Embeds.success('Required Role Set', `Required role set to ${role}.`)] });
    }

    if (sub === 'clearreqrole') {
      await clearPermission(guild.id);
      return reply({ embeds: [Embeds.success('Required Role Cleared', 'Required role has been cleared.')] });
    }

    const name = (isSlash ? interaction.options.getString('name') : args[1])?.toLowerCase();
    if (!name) return reply({ embeds: [Embeds.error('Invalid', 'Please provide a command name.')], ephemeral: true });

    if (sub === 'add' || sub === 'update') {
      const role = isSlash ? interaction.options.getRole('role') : message.mentions.roles.first();
      if (!role) return reply({ embeds: [Embeds.error('Invalid Role', 'Please provide a valid role.')], ephemeral: true });
      if (role.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return reply({ embeds: [Embeds.error('Invalid Role', 'Roles with Administrator cannot be used.')] });
      }

      const existing = await getRole(guild.id, name);
      if (sub === 'add' && existing) {
        return reply({ embeds: [Embeds.error('Exists', `Custom role \`${name}\` already exists.`)] });
      }

      const all = await getRoles(guild.id);
      const subscription = 'free';
      const limit = SUB_LIMITS[subscription] || 5;
      if (sub === 'add' && all.length >= limit) {
        return reply({ embeds: [Embeds.error('Limit Reached', `Limit of ${limit} custom roles reached.`)] });
      }

      await upsertRole(guild.id, name, role.id);
      return reply({ embeds: [Embeds.success('Custom Role Saved', `\`${name}\` is now set to ${role}.`)] });
    }

    if (sub === 'remove') {
      const existing = await getRole(guild.id, name);
      if (!existing) {
        return reply({ embeds: [Embeds.error('Not Found', `Custom role \`${name}\` does not exist.`)] });
      }
      await deleteRole(guild.id, name);
      return reply({ embeds: [Embeds.success('Removed', `Custom role \`${name}\` has been removed.`)] });
    }

    return reply({ embeds: [Embeds.error('Invalid', 'Unknown subcommand.')] });
  },
};
