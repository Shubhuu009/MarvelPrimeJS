const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const { buildVoicePanelEmbed, buildVoicePanelComponents } = require('../../systems/voice/panel');
const { setOwner } = require('../../database/voice');

module.exports = {
  name: 'voicepanel',
  aliases: ['vcpanel', 'voicemaster'],
  description: 'Open the Voice Channel Control Panel',
  category: 'voice',
  cooldown: 3,
  slash: new SlashCommandBuilder()
    .setName('voicepanel')
    .setDescription('Open the Voice Channel Control Panel'),

  async execute({ message, interaction, isSlash }) {
    const ctx = isSlash ? interaction : message;
    const member = isSlash ? interaction.member : message.member;
    const guild = isSlash ? interaction.guild : message.guild;

    if (!member?.voice?.channel || member.voice.channel.type !== ChannelType.GuildVoice) {
      const content = 'You must be in a voice channel to open the control panel.';
      return isSlash
        ? ctx.reply({ content, ephemeral: true })
        : ctx.reply({ content });
    }

    const channel = member.voice.channel;

    const botMember = guild.members.me || guild.members.cache.get(ctx.client.user.id);
    if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      const content = 'I need **Manage Channels** permission to run this panel.';
      return isSlash
        ? ctx.reply({ content, ephemeral: true })
        : ctx.reply({ content });
    }

    await setOwner(guild.id, channel.id, member.id);

    const embed = buildVoicePanelEmbed(guild);
    const components = buildVoicePanelComponents();

    return isSlash
      ? ctx.reply({ embeds: [embed], components })
      : ctx.reply({ embeds: [embed], components });
  },
};
