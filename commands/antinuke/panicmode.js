const { SlashCommandBuilder } = require('discord.js');
const { updateGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

module.exports = {
  name: 'panicmode',
  description: 'Toggle panic mode — ban all non-whitelisted actions',
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('panicmode')
    .setDescription('Toggle panic mode')
    .addSubcommand(s => s.setName('enable').setDescription('Enable panic mode'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable panic mode')),

  async execute({ client, message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;
    if (executor.id !== guild.ownerId && !(process.env.OWNER_IDS || '').split(',').includes(executor.id)) {
      return isSlash ? interaction.reply({ embeds: [Embeds.error('No Permission', 'Server owner only.')], ephemeral: true }) : message.reply({ embeds: [Embeds.error('No Permission', 'Server owner only.')] });
    }
    const sub = isSlash ? interaction.options.getSubcommand() : args[0];
    const enabled = sub === 'enable';
    await updateGuildSettings(client, guild.id, { $set: { 'antinuke.panicmode.enabled': enabled } });
    const embed = enabled
      ? Embeds.error('🚨 PANIC MODE ENABLED', 'All non-whitelisted destructive actions will be instantly punished!')
      : Embeds.success('Panic Mode Disabled', 'Panic mode has been deactivated.');
    isSlash ? await interaction.reply({ embeds: [embed] }) : await message.reply({ embeds: [embed] });
  },
};
