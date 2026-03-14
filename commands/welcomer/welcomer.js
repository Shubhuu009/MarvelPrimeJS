const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const { getOrCreate } = require('../../database/welcomer');

const DEFAULT_COLOR = 0x2f3136;
const infoColor = () => Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;
const statusColor = (enabled) => enabled
  ? (Embeds?.COLORS?.success || DEFAULT_COLOR)
  : (Embeds?.COLORS?.error || DEFAULT_COLOR);

const variables = {
  '{user}': (member) => member?.user?.username || '',
  '{tag}': (member) => member?.user?.tag || '',
  '{guild}': (_, guild) => guild?.name || '',
  '{members}': (_, guild) => String(guild?.memberCount || ''),
  '{user.avatar}': (member) => member?.user?.displayAvatarURL({ dynamic: true }) || '',
  '{guild.icon}': (_, guild) => guild?.iconURL({ dynamic: true }) || '',
};

const applyVariables = (text, member, guild) => {
  if (!text) return '';
  return Object.keys(variables).reduce((acc, key) => {
    return acc.split(key).join(variables[key](member, guild));
  }, text);
};

const isImageInput = (value) => {
  if (!value) return true;
  const lower = value.toLowerCase();
  if (Object.keys(variables).includes(lower)) return true;
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return /\.(png|jpg|jpeg|gif|webp)$/i.test(lower);
  }
  return false;
};

const buildWelcomeEmbed = (guild, settings) => {
  const type = settings.welcome_message && settings.welcome_embed
    ? 'Message & Embed'
    : settings.welcome_message
      ? 'Message'
      : settings.welcome_embed
        ? 'Embed'
        : 'Not Set';

  return new EmbedBuilder()
    .setColor(statusColor(settings.welcome))
    .setTitle('Welcome Settings')
    .setDescription('Configure the welcome message for your server.')
    .addFields(
      { name: 'Status', value: settings.welcome ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Channel', value: settings.welcome_channel ? `<#${settings.welcome_channel}>` : '`No channel set`', inline: true },
      { name: 'Welcome Type', value: `\`${type}\``, inline: true },
      { name: 'Message', value: settings.welcome_message_content ? `\`\`\`\n${settings.welcome_message_content}\n\`\`\`` : '`No message set`', inline: false },
      { name: 'Embed Title', value: `\`${settings.welcome_embed_title || 'No title set'}\``, inline: true },
      { name: 'Embed Description', value: settings.welcome_embed_description ? `\`\`\`\n${settings.welcome_embed_description}\n\`\`\`` : '`No description set`', inline: false },
      { name: 'Embed Thumbnail', value: settings.welcome_embed_thumbnail || '`No thumbnail set`', inline: true },
      { name: 'Embed Image', value: settings.welcome_embed_image || '`No image set`', inline: true },
      { name: 'Embed Footer', value: settings.welcome_embed_footer || '`No footer set`', inline: true },
      { name: 'Embed Author', value: settings.welcome_embed_author || '`No author set`', inline: true },
      { name: 'Embed Color', value: settings.welcome_embed_color || '`No color set`', inline: true },
    )
    .setFooter({ text: `Server: ${guild.name}` });
};

const buildAutoroleEmbed = (guild, settings) => new EmbedBuilder()
  .setColor(statusColor(settings.autorole))
  .setTitle('Autorole Settings')
  .setDescription('Configure autoroles for new members.')
  .addFields(
    { name: 'Status', value: settings.autorole ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Limit', value: settings.autoroles_limit ? String(settings.autoroles_limit) : 'Unlimited', inline: true },
    { name: 'Roles', value: settings.autoroles?.length ? settings.autoroles.map((id) => `<@&${id}>`).join(', ') : 'No roles set', inline: false },
  )
  .setFooter({ text: `Server: ${guild.name}` });

const buildAutonickEmbed = (guild, settings) => new EmbedBuilder()
  .setColor(statusColor(settings.autonick))
  .setTitle('Autonick Settings')
  .setDescription('Configure the autonick format for new members.')
  .addFields(
    { name: 'Status', value: settings.autonick ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Format', value: settings.autonick_format ? `\`${settings.autonick_format}\`` : '`No format set`', inline: true },
    { name: 'Variables', value: '`{user}` `{tag}` `{guild}` `{members}`', inline: false },
  )
  .setFooter({ text: `Server: ${guild.name}` });

const buildGreetEmbed = (guild, settings) => new EmbedBuilder()
  .setColor(statusColor(settings.greet))
  .setTitle('Greet Settings')
  .setDescription('Configure greet channels and message.')
  .addFields(
    { name: 'Status', value: settings.greet ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Channels', value: settings.greet_channels?.length ? settings.greet_channels.map((id) => `<#${id}>`).join(', ') : '`No channel set`', inline: true },
    { name: 'Delete After', value: settings.greet_delete_after ? `${settings.greet_delete_after} sec` : 'No delete set', inline: true },
    { name: 'Message', value: settings.greet_message ? `\`${settings.greet_message}\`` : '`No message set`', inline: false },
  )
  .setFooter({ text: `Server: ${guild.name}` });

const buildWelcomeView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('welcomer:welcome:toggle')
    .setLabel(settings.welcome ? 'Click To Disable' : 'Click To Enable')
    .setStyle(settings.welcome ? ButtonStyle.Secondary : ButtonStyle.Success);
  const preview = new ButtonBuilder()
    .setCustomId('welcomer:welcome:preview')
    .setLabel('Show Preview')
    .setStyle(ButtonStyle.Primary);
  const editMessage = new ButtonBuilder()
    .setCustomId('welcomer:welcome:edit_message')
    .setLabel('Edit Message')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!settings.welcome_message);
  const editEmbed = new ButtonBuilder()
    .setCustomId('welcomer:welcome:edit_embed')
    .setLabel('Edit Embed')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!settings.welcome_embed);
  const editMedia = new ButtonBuilder()
    .setCustomId('welcomer:welcome:edit_media')
    .setLabel('Embed Media')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!settings.welcome_embed);
  const editAuthor = new ButtonBuilder()
    .setCustomId('welcomer:welcome:edit_author')
    .setLabel('Embed Author')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!settings.welcome_embed);
  const cancel = new ButtonBuilder()
    .setCustomId('welcomer:welcome:cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('welcomer:welcome:type')
    .setPlaceholder('Select welcome type')
    .addOptions(
      { label: 'Message & Embed', value: 'message_and_embed', default: settings.welcome_message && settings.welcome_embed },
      { label: 'Message', value: 'message', default: settings.welcome_message && !settings.welcome_embed },
      { label: 'Embed', value: 'embed', default: settings.welcome_embed && !settings.welcome_message },
    );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('welcomer:welcome:channel')
    .setPlaceholder('Select the welcome channel')
    .setMinValues(1)
    .setMaxValues(1)
    .setChannelTypes(ChannelType.GuildText);
  if (settings.welcome_channel && guild.channels.cache.get(settings.welcome_channel)) {
    channelSelect.setDefaultChannels([settings.welcome_channel]);
  }

  const row1 = new ActionRowBuilder().addComponents(toggle, preview);
  const row2 = new ActionRowBuilder().addComponents(typeSelect);
  const row3 = new ActionRowBuilder().addComponents(channelSelect);
  const row4 = new ActionRowBuilder().addComponents(editMessage, editEmbed, editMedia, editAuthor);
  const row5 = new ActionRowBuilder().addComponents(cancel);

  if (disabled) {
    [row1, row2, row3, row4, row5].forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
  }
  return [row1, row2, row3, row4, row5];
};

const buildAutoroleView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('welcomer:autorole:toggle')
    .setLabel(settings.autorole ? 'Click To Disable' : 'Click To Enable')
    .setStyle(settings.autorole ? ButtonStyle.Secondary : ButtonStyle.Success);
  const limit = new ButtonBuilder()
    .setCustomId('welcomer:autorole:limit')
    .setLabel('Set Limit')
    .setStyle(ButtonStyle.Primary);
  const cancel = new ButtonBuilder()
    .setCustomId('welcomer:autorole:cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const roles = new RoleSelectMenuBuilder()
    .setCustomId('welcomer:autorole:roles')
    .setPlaceholder('Select autoroles')
    .setMinValues(1)
    .setMaxValues(settings.autoroles_limit > 0 ? Math.min(25, settings.autoroles_limit) : 25);
  const roleDefaults = (settings.autoroles || [])
    .map((id) => guild.roles.cache.get(id))
    .filter(Boolean);
  if (roleDefaults.length) roles.setDefaultRoles(roleDefaults);

  const row1 = new ActionRowBuilder().addComponents(toggle, limit);
  const row2 = new ActionRowBuilder().addComponents(roles);
  const row3 = new ActionRowBuilder().addComponents(cancel);

  if (disabled) {
    [row1, row2, row3].forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
  }
  return [row1, row2, row3];
};

const buildAutonickView = (settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('welcomer:autonick:toggle')
    .setLabel(settings.autonick ? 'Click To Disable' : 'Click To Enable')
    .setStyle(settings.autonick ? ButtonStyle.Secondary : ButtonStyle.Success);
  const format = new ButtonBuilder()
    .setCustomId('welcomer:autonick:format')
    .setLabel('Set Format')
    .setStyle(ButtonStyle.Primary);
  const cancel = new ButtonBuilder()
    .setCustomId('welcomer:autonick:cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(toggle, format);
  const row2 = new ActionRowBuilder().addComponents(cancel);

  if (disabled) {
    [row1, row2].forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
  }
  return [row1, row2];
};

const buildGreetView = (guild, settings, disabled = false) => {
  const toggle = new ButtonBuilder()
    .setCustomId('welcomer:greet:toggle')
    .setLabel(settings.greet ? 'Click To Disable' : 'Click To Enable')
    .setStyle(settings.greet ? ButtonStyle.Secondary : ButtonStyle.Success);
  const message = new ButtonBuilder()
    .setCustomId('welcomer:greet:message')
    .setLabel('Set Message')
    .setStyle(ButtonStyle.Primary);
  const deleteAfter = new ButtonBuilder()
    .setCustomId('welcomer:greet:delete_after')
    .setLabel('Set Delete After')
    .setStyle(ButtonStyle.Primary);
  const cancel = new ButtonBuilder()
    .setCustomId('welcomer:greet:cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const channels = new ChannelSelectMenuBuilder()
    .setCustomId('welcomer:greet:channels')
    .setPlaceholder('Select greet channels')
    .setMinValues(1)
    .setMaxValues(5)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  const channelDefaults = (settings.greet_channels || [])
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean)
    .map((c) => c.id);
  if (channelDefaults.length) channels.setDefaultChannels(channelDefaults);

  const row1 = new ActionRowBuilder().addComponents(toggle, message, deleteAfter);
  const row2 = new ActionRowBuilder().addComponents(channels);
  const row3 = new ActionRowBuilder().addComponents(cancel);

  if (disabled) {
    [row1, row2, row3].forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
  }
  return [row1, row2, row3];
};

const openPanel = async ({ type, interaction, executor, guild, settings }) => {
  const build = {
    welcome: {
      embed: () => buildWelcomeEmbed(guild, settings),
      view: (disabled) => buildWelcomeView(guild, settings, disabled),
    },
    autorole: {
      embed: () => buildAutoroleEmbed(guild, settings),
      view: (disabled) => buildAutoroleView(guild, settings, disabled),
    },
    autonick: {
      embed: () => buildAutonickEmbed(guild, settings),
      view: (disabled) => buildAutonickView(settings, disabled),
    },
    greet: {
      embed: () => buildGreetEmbed(guild, settings),
      view: (disabled) => buildGreetView(guild, settings, disabled),
    },
  }[type];

  await interaction.reply({ embeds: [build.embed()], components: build.view(false) });
  const panelMessage = await interaction.fetchReply();
  const collector = panelMessage.createMessageComponentCollector({ time: 120000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== executor.id) {
      return i.reply({ embeds: [Embeds.error('Not Allowed', 'Only the command user can interact here.')], ephemeral: true });
    }

    if (i.customId === 'welcomer:welcome:toggle') {
      await i.deferUpdate();
      settings.welcome = !settings.welcome;
      await settings.save();
    }
    if (i.customId === 'welcomer:welcome:type') {
      await i.deferUpdate();
      const value = i.values[0];
      settings.welcome_message = value === 'message' || value === 'message_and_embed';
      settings.welcome_embed = value === 'embed' || value === 'message_and_embed';
      await settings.save();
    }
    if (i.customId === 'welcomer:welcome:channel') {
      await i.deferUpdate();
      settings.welcome_channel = i.values[0];
      await settings.save();
    }
    if (i.customId === 'welcomer:welcome:preview') {
      await i.deferUpdate();
      if (!settings.welcome_message && !settings.welcome_embed) {
        return i.followUp({ embeds: [Embeds.error('Preview', 'Set message or embed first.')], ephemeral: true });
      }
      const content = settings.welcome_message
        ? applyVariables(settings.welcome_message_content, executor, guild)
        : null;
      let embed = null;
      if (settings.welcome_embed) {
        const colorHex = (settings.welcome_embed_color || '').replace('#', '');
        const colorValue = colorHex && /^[0-9a-f]{6}$/i.test(colorHex)
          ? parseInt(colorHex, 16)
          : DEFAULT_COLOR;
        embed = new EmbedBuilder()
          .setTitle(applyVariables(settings.welcome_embed_title, executor, guild))
          .setDescription(applyVariables(settings.welcome_embed_description, executor, guild))
          .setColor(colorValue);
        if (settings.welcome_embed_thumbnail) embed.setThumbnail(applyVariables(settings.welcome_embed_thumbnail, executor, guild));
        if (settings.welcome_embed_image) embed.setImage(applyVariables(settings.welcome_embed_image, executor, guild));
        if (settings.welcome_embed_footer) {
          embed.setFooter({
            text: applyVariables(settings.welcome_embed_footer, executor, guild),
            iconURL: applyVariables(settings.welcome_embed_footer_icon, executor, guild),
          });
        }
        if (settings.welcome_embed_author) {
          embed.setAuthor({
            name: applyVariables(settings.welcome_embed_author, executor, guild),
            iconURL: applyVariables(settings.welcome_embed_author_icon, executor, guild),
            url: applyVariables(settings.welcome_embed_author_url, executor, guild),
          });
        }
      }
      return i.followUp({ content, embeds: embed ? [embed] : [], ephemeral: true });
    }
    if (i.customId === 'welcomer:welcome:edit_message') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:welcome:edit_message_modal')
        .setTitle('Edit Welcome Message');
      const input = new TextInputBuilder()
        .setCustomId('welcome_message')
        .setLabel('Message')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(settings.welcome_message_content || '');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:welcome:edit_message_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        settings.welcome_message_content = modalSubmit.fields.getTextInputValue('welcome_message');
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:welcome:edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:welcome:edit_embed_modal')
        .setTitle('Edit Welcome Embed');
      const title = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_title || '');
      const desc = new TextInputBuilder()
        .setCustomId('embed_desc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(settings.welcome_embed_description || '');
      const color = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel('Color (hex like #00ff99)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_color || '');
      modal.addComponents(
        new ActionRowBuilder().addComponents(title),
        new ActionRowBuilder().addComponents(desc),
        new ActionRowBuilder().addComponents(color),
      );
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:welcome:edit_embed_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        settings.welcome_embed_title = modalSubmit.fields.getTextInputValue('embed_title');
        settings.welcome_embed_description = modalSubmit.fields.getTextInputValue('embed_desc');
        settings.welcome_embed_color = modalSubmit.fields.getTextInputValue('embed_color');
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:welcome:edit_media') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:welcome:edit_media_modal')
        .setTitle('Edit Embed Media');
      const thumb = new TextInputBuilder()
        .setCustomId('embed_thumbnail')
        .setLabel('Thumbnail URL or variable')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_thumbnail || '');
      const image = new TextInputBuilder()
        .setCustomId('embed_image')
        .setLabel('Image URL or variable')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_image || '');
      const footer = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_footer || '');
      const footerIcon = new TextInputBuilder()
        .setCustomId('embed_footer_icon')
        .setLabel('Footer Icon URL or variable')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_footer_icon || '');
      modal.addComponents(
        new ActionRowBuilder().addComponents(thumb),
        new ActionRowBuilder().addComponents(image),
        new ActionRowBuilder().addComponents(footer),
        new ActionRowBuilder().addComponents(footerIcon),
      );
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:welcome:edit_media_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        const thumbnail = modalSubmit.fields.getTextInputValue('embed_thumbnail');
        const img = modalSubmit.fields.getTextInputValue('embed_image');
        const footerText = modalSubmit.fields.getTextInputValue('embed_footer');
        const footerIconUrl = modalSubmit.fields.getTextInputValue('embed_footer_icon');
        if (!isImageInput(thumbnail) || !isImageInput(img) || !isImageInput(footerIconUrl)) {
          await modalSubmit.reply({ embeds: [Embeds.error('Invalid URL', 'Use an image URL or a supported variable.')], ephemeral: true });
        } else {
          settings.welcome_embed_thumbnail = thumbnail;
          settings.welcome_embed_image = img;
          settings.welcome_embed_footer = footerText;
          settings.welcome_embed_footer_icon = footerIconUrl;
          await settings.save();
          await modalSubmit.deferUpdate();
        }
      }
    }
    if (i.customId === 'welcomer:welcome:edit_author') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:welcome:edit_author_modal')
        .setTitle('Edit Embed Author');
      const author = new TextInputBuilder()
        .setCustomId('embed_author')
        .setLabel('Author Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_author || '');
      const authorIcon = new TextInputBuilder()
        .setCustomId('embed_author_icon')
        .setLabel('Author Icon URL or variable')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_author_icon || '');
      const authorUrl = new TextInputBuilder()
        .setCustomId('embed_author_url')
        .setLabel('Author URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.welcome_embed_author_url || '');
      modal.addComponents(
        new ActionRowBuilder().addComponents(author),
        new ActionRowBuilder().addComponents(authorIcon),
        new ActionRowBuilder().addComponents(authorUrl),
      );
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:welcome:edit_author_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        const authorName = modalSubmit.fields.getTextInputValue('embed_author');
        const authorIconUrl = modalSubmit.fields.getTextInputValue('embed_author_icon');
        const authorLink = modalSubmit.fields.getTextInputValue('embed_author_url');
        if (!isImageInput(authorIconUrl)) {
          await modalSubmit.reply({ embeds: [Embeds.error('Invalid URL', 'Use an image URL or a supported variable.')], ephemeral: true });
        } else {
          settings.welcome_embed_author = authorName;
          settings.welcome_embed_author_icon = authorIconUrl;
          settings.welcome_embed_author_url = authorLink;
          await settings.save();
          await modalSubmit.deferUpdate();
        }
      }
    }
    if (i.customId === 'welcomer:welcome:cancel') {
      await i.deferUpdate();
      collector.stop();
    }

    if (i.customId === 'welcomer:autorole:toggle') {
      await i.deferUpdate();
      settings.autorole = !settings.autorole;
      await settings.save();
    }
    if (i.customId === 'welcomer:autorole:roles') {
      await i.deferUpdate();
      settings.autoroles = i.values;
      await settings.save();
    }
    if (i.customId === 'welcomer:autorole:limit') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:autorole:limit_modal')
        .setTitle('Set Autorole Limit');
      const input = new TextInputBuilder()
        .setCustomId('autorole_limit')
        .setLabel('Limit (0 = unlimited)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(settings.autoroles_limit || 0));
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:autorole:limit_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        const value = Number(modalSubmit.fields.getTextInputValue('autorole_limit'));
        settings.autoroles_limit = Number.isFinite(value) && value >= 0 ? value : 0;
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:autorole:cancel') {
      await i.deferUpdate();
      collector.stop();
    }

    if (i.customId === 'welcomer:autonick:toggle') {
      await i.deferUpdate();
      settings.autonick = !settings.autonick;
      await settings.save();
    }
    if (i.customId === 'welcomer:autonick:format') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:autonick:format_modal')
        .setTitle('Set Autonick Format');
      const input = new TextInputBuilder()
        .setCustomId('autonick_format')
        .setLabel('Format')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(settings.autonick_format || '');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:autonick:format_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        settings.autonick_format = modalSubmit.fields.getTextInputValue('autonick_format');
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:autonick:cancel') {
      await i.deferUpdate();
      collector.stop();
    }

    if (i.customId === 'welcomer:greet:toggle') {
      await i.deferUpdate();
      settings.greet = !settings.greet;
      await settings.save();
    }
    if (i.customId === 'welcomer:greet:channels') {
      await i.deferUpdate();
      settings.greet_channels = i.values;
      await settings.save();
    }
    if (i.customId === 'welcomer:greet:message') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:greet:message_modal')
        .setTitle('Set Greet Message');
      const input = new TextInputBuilder()
        .setCustomId('greet_message')
        .setLabel('Message')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(settings.greet_message || '');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:greet:message_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        settings.greet_message = modalSubmit.fields.getTextInputValue('greet_message');
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:greet:delete_after') {
      const modal = new ModalBuilder()
        .setCustomId('welcomer:greet:delete_after_modal')
        .setTitle('Set Delete After');
      const input = new TextInputBuilder()
        .setCustomId('greet_delete_after')
        .setLabel('Seconds (0 to disable)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(settings.greet_delete_after || 0));
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      const modalSubmit = await i.awaitModalSubmit({
        time: 60000,
        filter: (m) => m.customId === 'welcomer:greet:delete_after_modal' && m.user.id === executor.id,
      }).catch(() => null);
      if (modalSubmit) {
        const value = Number(modalSubmit.fields.getTextInputValue('greet_delete_after'));
        settings.greet_delete_after = Number.isFinite(value) && value >= 0 ? value : 0;
        await settings.save();
        await modalSubmit.deferUpdate();
      }
    }
    if (i.customId === 'welcomer:greet:cancel') {
      await i.deferUpdate();
      collector.stop();
    }

    await panelMessage.edit({ embeds: [build.embed()], components: build.view(false) });
  });

  collector.on('end', async () => {
    await panelMessage.edit({ embeds: [build.embed()], components: build.view(true) });
  });
};

module.exports = {
  name: 'welcomer',
  description: 'Configure the welcomer for your server',
  aliases: ['welcomers'],
  category: 'welcomer',
  cooldown: 6,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('welcomer')
    .setDescription('Configure welcomer')
    .addSubcommand(s => s.setName('welcome').setDescription('Configure welcome settings'))
    .addSubcommand(s => s.setName('autorole').setDescription('Configure autorole settings'))
    .addSubcommand(s => s.setName('autonick').setDescription('Configure autonick settings'))
    .addSubcommand(s => s.setName('greet').setDescription('Configure greet settings'))
    .addSubcommand(s => s.setName('status').setDescription('View welcomer status')),

  async execute({ message, interaction, args, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;

    const reply = (payload) => (
      isSlash
        ? interaction.reply(payload)
        : message.reply(payload)
    );

    if (!executor.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return reply({ embeds: [Embeds.error('No Permission', 'Manage Server permission required.')], ephemeral: true });
    }

    const settings = await getOrCreate(guild.id);
    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();

    if (!sub || !isSlash) {
      const help = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Welcomer Commands')
        .setDescription('Use slash commands to open a panel.')
        .addFields(
          { name: 'Welcome', value: '`/welcomer welcome`' },
          { name: 'Autorole', value: '`/welcomer autorole`' },
          { name: 'Autonick', value: '`/welcomer autonick`' },
          { name: 'Greet', value: '`/welcomer greet`' },
          { name: 'Status', value: '`/welcomer status`' },
        );
      return reply({ embeds: [help], ephemeral: true });
    }

    if (sub === 'status') {
      const embed = new EmbedBuilder()
        .setColor(infoColor())
        .setTitle('Welcomer Status')
        .addFields(
          { name: 'Welcome', value: settings.welcome ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Autorole', value: settings.autorole ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Autonick', value: settings.autonick ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Greet', value: settings.greet ? '✅ Enabled' : '❌ Disabled', inline: true },
        )
        .setFooter({ text: `Server: ${guild.name}` });
      return reply({ embeds: [embed] });
    }

    if (sub === 'welcome') return openPanel({ type: 'welcome', interaction, executor, guild, settings });
    if (sub === 'autorole') return openPanel({ type: 'autorole', interaction, executor, guild, settings });
    if (sub === 'autonick') return openPanel({ type: 'autonick', interaction, executor, guild, settings });
    if (sub === 'greet') return openPanel({ type: 'greet', interaction, executor, guild, settings });

    return reply({ embeds: [Embeds.error('Invalid', 'Unknown subcommand.')] });
  },
};
