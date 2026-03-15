const {
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const {
  QuarantineEntryModel,
  getOrCreateSettings,
  getActiveQuarantine,
} = require('../../database/quarantine');

const ROLE_NAME = 'quarantine';
const CHANNEL_NAME = 'quarantine-chat';

class QuarantineSystem {
  constructor(client) {
    this.client = client;
  }

  async ensureSetup(guild, reason = 'Quarantine setup') {
    const settings = await getOrCreateSettings(guild.id);

    let role = settings.roleId ? guild.roles.cache.get(settings.roleId) : null;
    if (!role) {
      role = guild.roles.cache.find((r) => r.name.toLowerCase() === ROLE_NAME);
    }

    if (!role) {
      const botMember = guild.members.me || guild.members.cache.get(this.client.user.id);
      if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
        throw new Error('I need **Manage Roles** permission to create the quarantine role.');
      }
      role = await guild.roles.create({
        name: ROLE_NAME,
        permissions: 0n,
        reason,
      });
    }

    let channel = settings.channelId ? guild.channels.cache.get(settings.channelId) : null;
    if (!channel) {
      channel = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAME
      );
    }

    if (!channel) {
      const botMember = guild.members.me || guild.members.cache.get(this.client.user.id);
      if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
        throw new Error('I need **Manage Channels** permission to create the quarantine channel.');
      }
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        reason,
      });
    }

    settings.enabled = true;
    settings.roleId = role.id;
    settings.channelId = channel.id;
    await settings.save();

    await this.applyChannelPerms(channel, guild, role);

    return { settings, role, channel };
  }

  async applyChannelPerms(channel, guild, role) {
    if (!channel || !guild || !role) return;
    await channel.permissionOverwrites.set([
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: role.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ]);
  }

  async quarantine(guild, target, moderator, reason) {
    if (!guild || !target) return { success: false, reason: 'Invalid guild or member.' };

    const botMember = guild.members.me || guild.members.cache.get(this.client.user.id);
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return { success: false, reason: 'I need **Manage Roles** permission.' };
    }

    const existing = await getActiveQuarantine(guild.id, target.id);
    if (existing) return { success: false, reason: 'Member is already quarantined.' };

    let role;
    let channel;
    try {
      const setup = await this.ensureSetup(guild, `Quarantine setup for ${target.user?.tag || target.id}`);
      role = setup.role;
      channel = setup.channel;
    } catch (err) {
      return { success: false, reason: err.message || 'Failed to setup quarantine.' };
    }

    if (role.position >= botMember.roles.highest.position) {
      return { success: false, reason: 'Quarantine role is higher than my highest role.' };
    }
    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return { success: false, reason: 'Target has roles higher than or equal to mine.' };
    }

    const removableRoles = target.roles.cache
      .filter((r) => r.id !== guild.id)
      .filter((r) => r.id !== role.id)
      .filter((r) => !r.managed)
      .filter((r) => r.position < botMember.roles.highest.position)
      .map((r) => r.id);

    const entry = await QuarantineEntryModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator?.id || '',
      reason: reason || 'No reason',
      roles: removableRoles,
      active: true,
      quarantinedAt: new Date(),
    });

    try {
      if (removableRoles.length) {
        await target.roles.remove(removableRoles, 'Quarantine');
      }
      if (!target.roles.cache.has(role.id)) {
        await target.roles.add(role, 'Quarantine');
      }
    } catch (err) {
      try {
        if (removableRoles.length) {
          await target.roles.add(removableRoles, 'Revert quarantine (failed)');
        }
        if (target.roles.cache.has(role.id)) {
          await target.roles.remove(role, 'Revert quarantine (failed)');
        }
      } catch {
        // ignore rollback errors
      }
      await QuarantineEntryModel.deleteOne({ _id: entry._id });
      return { success: false, reason: 'Failed to update member roles.' };
    }

    return {
      success: true,
      roles: removableRoles,
      channelId: channel?.id || '',
      roleId: role.id,
    };
  }

  async unquarantine(guild, target, moderator, reason) {
    if (!guild || !target) return { success: false, reason: 'Invalid guild or member.' };

    const botMember = guild.members.me || guild.members.cache.get(this.client.user.id);
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return { success: false, reason: 'I need **Manage Roles** permission.' };
    }

    const entry = await getActiveQuarantine(guild.id, target.id);
    if (!entry) return { success: false, reason: 'Member is not quarantined.' };

    const settings = await getOrCreateSettings(guild.id);
    const role = settings.roleId
      ? guild.roles.cache.get(settings.roleId)
      : guild.roles.cache.find((r) => r.name.toLowerCase() === ROLE_NAME);

    const rolesToAdd = (entry.roles || [])
      .map((id) => guild.roles.cache.get(id))
      .filter(Boolean)
      .filter((r) => !r.managed)
      .filter((r) => r.position < botMember.roles.highest.position);

    try {
      if (rolesToAdd.length) {
        await target.roles.add(rolesToAdd, 'Restore roles after quarantine');
      }
      if (role && target.roles.cache.has(role.id)) {
        await target.roles.remove(role, 'Quarantine removed');
      }
    } catch (err) {
      return { success: false, reason: 'Failed to restore member roles.' };
    }

    entry.active = false;
    entry.releasedAt = new Date();
    entry.releasedBy = moderator?.id || '';
    entry.releaseReason = reason || 'Released';
    await entry.save();

    return { success: true, restoredRoles: rolesToAdd.length };
  }
}

module.exports = QuarantineSystem;
