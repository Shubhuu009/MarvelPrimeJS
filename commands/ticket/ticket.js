const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const {
  TicketModel,
  getOrCreateSettings,
  getOrCreateLogs,
  nextTicketId,
} = require('../../database/ticket');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;

const buildHelpEmbed = () => new EmbedBuilder()
  .setColor(infoColor())
  .setTitle('Ticket Commands')
  .setDescription('Use `/ticket <subcommand>` to manage tickets.')
  .addFields(
    { name: 'Create', value: '`/ticket create <issue>`' },
    { name: 'Close', value: '`/ticket close`' },
    { name: 'Reopen', value: '`/ticket reopen`' },
    { name: 'Delete', value: '`/ticket delete`' },
    { name: 'Add/Remove', value: '`/ticket add <@user>` / `/ticket remove <@user>`' },
    { name: 'List', value: '`/ticket list`' },
    { name: 'Category', value: '`/ticket category <open|closed> <category>`' },
    { name: 'Logs', value: '`/ticket logs <#channel>`' },
    { name: 'Auto-Response', value: '`/ticket autoresponse <message>`' },
    { name: 'Settings', value: '`/ticket settings`' },
  );

const setChannelPerms = async (channel, guild, ownerId, supportRoles, extraUsers = []) => {
  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: ownerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
  ];
  for (const roleId of supportRoles) {
    overwrites.push({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    });
  }
  for (const userId of extraUsers) {
    overwrites.push({
      id: userId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    });
  }
  await channel.permissionOverwrites.set(overwrites);
};

module.exports = {
  name: 'ticket',
  description: 'Manage tickets',
  aliases: ['tickets'],
  category: 'ticket',
  cooldown: 2,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage tickets')
    .addSubcommand(s => s.setName('create').setDescription('Create a ticket')
      .addStringOption(o => o.setName('issue').setDescription('Issue/description').setRequired(false)))
    .addSubcommand(s => s.setName('close').setDescription('Close the current ticket'))
    .addSubcommand(s => s.setName('reopen').setDescription('Reopen the current ticket'))
    .addSubcommand(s => s.setName('delete').setDescription('Delete the current ticket'))
    .addSubcommand(s => s.setName('add').setDescription('Add a participant')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a participant')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List open tickets'))
    .addSubcommand(s => s.setName('category').setDescription('Set ticket categories')
      .addStringOption(o => o.setName('type').setDescription('open or closed').setRequired(true).addChoices(
        { name: 'Open', value: 'open' },
        { name: 'Closed', value: 'closed' },
      ))
      .addChannelOption(o => o.setName('category').setDescription('Category channel').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(s => s.setName('logs').setDescription('Set ticket logs channel')
      .addChannelOption(o => o.setName('channel').setDescription('Logs channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName('autoresponse').setDescription('Set ticket auto-response')
      .addStringOption(o => o.setName('message').setDescription('Auto-response message').setRequired(true)))
    .addSubcommand(s => s.setName('settings').setDescription('View ticket settings')),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;

    const reply = (payload) => (
      isSlash
        ? interaction.reply(payload)
        : message.reply(payload)
    );

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    if (!sub) return reply({ embeds: [buildHelpEmbed()] });

    const settings = await getOrCreateSettings(guild.id);
    const logs = await getOrCreateLogs(guild.id);

    if (sub === 'settings') {
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Ticket Settings')
        .addFields(
          { name: 'Enabled', value: settings.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Open Category', value: settings.openCategoryId ? `<#${settings.openCategoryId}>` : '`Not Set`', inline: true },
          { name: 'Closed Category', value: settings.closedCategoryId ? `<#${settings.closedCategoryId}>` : '`Not Set`', inline: true },
          { name: 'Support Roles', value: settings.supportRoles?.length ? settings.supportRoles.map((id) => `<@&${id}>`).join(', ') : '`Not Set`', inline: false },
          { name: 'Ticket Limit', value: String(settings.ticketLimit || 1), inline: true },
          { name: 'Logs Channel', value: logs.logsChannelId ? `<#${logs.logsChannelId}>` : '`Not Set`', inline: true },
          { name: 'Auto-Response', value: settings.autoResponseMessage || '`Not Set`', inline: false },
        );
      return reply({ embeds: [embed] });
    }

    if (sub === 'create') {
      const issue = isSlash ? interaction.options.getString('issue') : args.slice(1).join(' ');
      const openCount = await TicketModel.countDocuments({ guildId: guild.id, ownerId: executor.id, closed: false });
      if (settings.ticketLimit && openCount >= settings.ticketLimit) {
        return reply({ embeds: [Embeds.error('Limit Reached', 'You have reached the ticket limit.')] });
      }
      const id = await nextTicketId(guild.id);
      const channel = await guild.channels.create({
        name: `ticket-${id}`,
        type: ChannelType.GuildText,
        parent: settings.openCategoryId || null,
        reason: `Ticket created by ${executor.user.tag}`,
      });
      await setChannelPerms(channel, guild, executor.id, settings.supportRoles || []);
      await TicketModel.create({
        guildId: guild.id,
        ticketId: id,
        channelId: channel.id,
        ownerId: executor.id,
      });
      if (settings.autoResponseMessage) {
        await channel.send({ content: settings.autoResponseMessage });
      }
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Ticket Created')
        .setDescription(`Ticket ${id} created: ${channel}.`)
        .addFields({ name: 'Issue', value: issue || 'No description provided.' });
      return reply({ embeds: [embed] });
    }

    const ticket = await TicketModel.findOne({ guildId: guild.id, channelId: (isSlash ? interaction.channelId : message.channel.id) });
    if (['close', 'reopen', 'delete', 'add', 'remove'].includes(sub) && !ticket) {
      return reply({ embeds: [Embeds.error('Not a Ticket', 'This channel is not a ticket.')] });
    }

    if (sub === 'close') {
      if (ticket.closed) return reply({ embeds: [Embeds.error('Already Closed', 'This ticket is already closed.')] });
      ticket.closed = true;
      ticket.closedAt = new Date();
      await ticket.save();
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel && settings.closedCategoryId) {
        await channel.setParent(settings.closedCategoryId).catch(() => null);
      }
      return reply({ embeds: [Embeds.success('Ticket Closed', 'Ticket has been closed.')] });
    }

    if (sub === 'reopen') {
      if (!ticket.closed) return reply({ embeds: [Embeds.error('Not Closed', 'This ticket is not closed.')] });
      ticket.closed = false;
      ticket.closedAt = null;
      await ticket.save();
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel && settings.openCategoryId) {
        await channel.setParent(settings.openCategoryId).catch(() => null);
      }
      return reply({ embeds: [Embeds.success('Ticket Reopened', 'Ticket has been reopened.')] });
    }

    if (sub === 'delete') {
      const channel = guild.channels.cache.get(ticket.channelId);
      await TicketModel.deleteOne({ _id: ticket._id });
      if (channel) await channel.delete('Ticket deleted').catch(() => null);
      return reply({ embeds: [Embeds.success('Ticket Deleted', 'Ticket has been deleted.')] });
    }

    if (sub === 'add') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return reply({ embeds: [Embeds.error('Invalid User', 'Please provide a user.')] });
      if (!ticket.participants.includes(user.id)) ticket.participants.push(user.id);
      await ticket.save();
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel) await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      return reply({ embeds: [Embeds.success('User Added', `${user} added to ticket.`)] });
    }

    if (sub === 'remove') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return reply({ embeds: [Embeds.error('Invalid User', 'Please provide a user.')] });
      ticket.participants = ticket.participants.filter((id) => id !== user.id);
      await ticket.save();
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel) await channel.permissionOverwrites.delete(user.id).catch(() => null);
      return reply({ embeds: [Embeds.success('User Removed', `${user} removed from ticket.`)] });
    }

    if (sub === 'list') {
      const open = await TicketModel.find({ guildId: guild.id, closed: false }).lean();
      if (!open.length) return reply({ embeds: [Embeds.error('Tickets', 'No open tickets.')] });
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Open Tickets')
        .setDescription(open.map((t) => `#${t.ticketId} - <#${t.channelId}> - <@${t.ownerId}>`).join('\n'));
      return reply({ embeds: [embed] });
    }

    if (sub === 'category') {
      if (!executor.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return reply({ embeds: [Embeds.error('No Permission', 'Administrator permission required.')], ephemeral: true });
      }
      const type = isSlash ? interaction.options.getString('type') : args[1];
      const category = isSlash ? interaction.options.getChannel('category') : message.mentions.channels.first();
      if (!category || category.type !== ChannelType.GuildCategory) {
        return reply({ embeds: [Embeds.error('Invalid Category', 'Please provide a category channel.')] });
      }
      if (type === 'open') settings.openCategoryId = category.id;
      if (type === 'closed') settings.closedCategoryId = category.id;
      await settings.save();
      return reply({ embeds: [Embeds.success('Category Updated', `Set ${type} category to ${category}.`)] });
    }

    if (sub === 'logs') {
      const channel = isSlash ? interaction.options.getChannel('channel') : message.mentions.channels.first();
      if (!channel || channel.type !== ChannelType.GuildText) {
        return reply({ embeds: [Embeds.error('Invalid Channel', 'Please provide a text channel.')] });
      }
      logs.logsChannelId = channel.id;
      await logs.save();
      return reply({ embeds: [Embeds.success('Logs Channel', `Logs channel set to ${channel}.`)] });
    }

    if (sub === 'autoresponse') {
      const msg = isSlash ? interaction.options.getString('message') : args.slice(1).join(' ');
      settings.autoResponseMessage = msg;
      await settings.save();
      return reply({ embeds: [Embeds.success('Auto-Response Set', 'Auto-response has been updated.')] });
    }

    return reply({ embeds: [Embeds.error('Invalid', 'Unknown subcommand.')] });
  },
};
