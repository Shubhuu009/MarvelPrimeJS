const { SlashCommandBuilder } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

module.exports = {
  name: 'extraowner',
  description: 'Manage extra owners',
  aliases: ['eo'],
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('extraowner')
    .setDescription('Manage extra owners for antinuke')
    .addSubcommand(s => s.setName('add').setDescription('Add extra owner').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove extra owner').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List extra owners'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset extra owners')),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;
    if (executor.id !== guild.ownerId && !(process.env.OWNER_IDS || '').split(',').includes(executor.id)) {
      return isSlash ? interaction.reply({ embeds: [Embeds.error('No Permission', 'Only the server owner can manage extra owners.')], ephemeral: true }) : message.reply({ embeds: [Embeds.error('No Permission', 'Only the server owner can manage extra owners.')] });
    }
    const sub = isSlash ? interaction.options.getSubcommand() : args[0];
    const settings = await getGuildSettings(client, guild.id);

    if (sub === 'add') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return;
      await updateGuildSettings(client, guild.id, { $addToSet: { 'antinuke.extraOwners': user.id } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Extra Owner Added', `<@${user.id}> is now an extra owner.`)] }) : message.reply({ embeds: [Embeds.success('Extra Owner Added', `<@${user.id}> is now an extra owner.`)] });
    }
    if (sub === 'remove') {
      const user = isSlash ? interaction.options.getUser('user') : message.mentions.users.first();
      if (!user) return;
      await updateGuildSettings(client, guild.id, { $pull: { 'antinuke.extraOwners': user.id } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Removed', `<@${user.id}> removed from extra owners.`)] }) : message.reply({ embeds: [Embeds.success('Removed', `<@${user.id}> removed from extra owners.`)] });
    }
    if (sub === 'list') {
      const list = settings?.antinuke?.extraOwners || [];
      return isSlash ? interaction.reply({ embeds: [Embeds.info('Extra Owners', list.length === 0 ? 'None.' : list.map(id => `<@${id}>`).join('\n'))] }) : message.reply({ embeds: [Embeds.info('Extra Owners', list.length === 0 ? 'None.' : list.map(id => `<@${id}>`).join('\n'))] });
    }
    if (sub === 'reset') {
      await updateGuildSettings(client, guild.id, { $set: { 'antinuke.extraOwners': [] } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Reset', 'Extra owners cleared.')] }) : message.reply({ embeds: [Embeds.success('Reset', 'Extra owners cleared.')] });
    }
  },
};
