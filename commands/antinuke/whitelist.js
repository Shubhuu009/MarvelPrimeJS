const { SlashCommandBuilder } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

module.exports = {
  name: 'whitelist',
  description: 'Manage antinuke whitelist',
  aliases: ['wl'],
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage antinuke whitelist')
    .addSubcommand(s => s.setName('add').setDescription('Add user to whitelist').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove user from whitelist').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('View whitelist'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset whitelist')),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;
    const isOwner = executor.id === guild.ownerId || (process.env.OWNER_IDS || '').split(',').includes(executor.id);
    if (!isOwner) return isSlash ? interaction.reply({ embeds: [Embeds.error('No Permission', 'Only the server owner can manage the whitelist.')], ephemeral: true }) : message.reply({ embeds: [Embeds.error('No Permission', 'Only the server owner can manage the whitelist.')] });

    const sub = isSlash ? interaction.options.getSubcommand() : args[0];
    const settings = await getGuildSettings(client, guild.id);

    if (sub === 'add') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return isSlash ? interaction.reply({ embeds: [Embeds.error('Invalid User', 'Please mention a user.')], ephemeral: true }) : message.reply({ embeds: [Embeds.error('Invalid User', 'Please mention a user.')] });
      if (settings?.antinuke?.whitelist?.includes(user.id)) return isSlash ? interaction.reply({ embeds: [Embeds.warning('Already Whitelisted', `<@${user.id}> is already in the whitelist.`)], ephemeral: true }) : message.reply({ embeds: [Embeds.warning('Already Whitelisted', `<@${user.id}> is already in the whitelist.`)] });
      await updateGuildSettings(client, guild.id, { $push: { 'antinuke.whitelist': user.id } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Whitelisted', `<@${user.id}> added to antinuke whitelist.`)] }) : message.reply({ embeds: [Embeds.success('Whitelisted', `<@${user.id}> added to antinuke whitelist.`)] });
    }

    if (sub === 'remove') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return;
      await updateGuildSettings(client, guild.id, { $pull: { 'antinuke.whitelist': user.id } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Removed', `<@${user.id}> removed from whitelist.`)] }) : message.reply({ embeds: [Embeds.success('Removed', `<@${user.id}> removed from whitelist.`)] });
    }

    if (sub === 'list') {
      const list = settings?.antinuke?.whitelist || [];
      const embed = Embeds.info('Antinuke Whitelist', list.length === 0 ? 'No users whitelisted.' : list.map(id => `<@${id}>`).join('\n'));
      return isSlash ? interaction.reply({ embeds: [embed] }) : message.reply({ embeds: [embed] });
    }

    if (sub === 'reset') {
      await updateGuildSettings(client, guild.id, { $set: { 'antinuke.whitelist': [] } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Reset', 'Antinuke whitelist has been cleared.')] }) : message.reply({ embeds: [Embeds.success('Reset', 'Antinuke whitelist has been cleared.')] });
    }
  },
};
