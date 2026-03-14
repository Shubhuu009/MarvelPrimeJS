const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../../utils/permissions');
const Embeds = require('../../utils/embeds');

const BOT_NAME = 'Marvel';
const ROLE_NAME = 'Marvel Ultimate Protection';
const LOADING = '⏳';
const DONE = '✅';
const OFF = '❌';
const DEFAULT_COLOR = 0x2f3136;

const MODULES = [
  'Anti Ban',
  'Anti Unban',
  'Anti Kick',
  'Anti Bot',
  'Anti Channel Create',
  'Anti Channel Delete',
  'Anti Channel Update',
  'Anti Emoji/Sticker Create',
  'Anti Emoji/Sticker Delete',
  'Anti Emoji/Sticker Update',
  'Anti Everyone/Here Ping',
  'Anti Role Create',
  'Anti Role Delete',
  'Anti Role Update',
  'Anti Role Ping',
  'Anti Member Update',
  'Anti Integration',
  'Anti Server Update',
  'Anti Automod Rule Create',
  'Anti Automod Rule Update',
  'Anti Automod Rule Delete',
  'Anti Guild Event Create',
  'Anti Guild Event Update',
  'Anti Guild Event Delete',
  'Anti Webhook',
  'Anti Prune',
  'Auto Recovery',
];

const progressColor = () => Embeds?.COLORS?.warning || Embeds?.COLORS?.info || Embeds?.COLORS?.success || DEFAULT_COLOR;
const statusColor = (enabled) => enabled
  ? (Embeds?.COLORS?.success || DEFAULT_COLOR)
  : (Embeds?.COLORS?.error || DEFAULT_COLOR);

const buildProgressEmbed = (title, steps, statuses) => new EmbedBuilder()
  .setColor(progressColor())
  .setTitle(title)
  .setDescription(steps.map((step) => `${statuses[step.key]} ${step.text}`).join('\n'));

const buildModulesList = (enabled) => {
  const status = enabled ? DONE : OFF;
  return MODULES.map((label) => `${label}: ${status}`).join('\n');
};

const buildFinalEmbed = ({ guild, enabled, punishment }) => new EmbedBuilder()
  .setColor(statusColor(enabled))
  .setTitle(`${enabled ? DONE : OFF} ${BOT_NAME} Antinuke ${enabled ? 'Enabled' : 'Disabled'}`)
  .setDescription(
    `Security settings for **${guild.name}**.\n` +
    `Role: \`${ROLE_NAME}\` placed under ${BOT_NAME}.\n` +
    `Punishment: **${punishment || 'ban'}**`
  )
  .addFields({ name: 'Modules', value: buildModulesList(enabled) })
  .setTimestamp();

module.exports = {
  name: 'antinuke',
  description: 'Configure the antinuke system',
  aliases: ['an'],
  category: 'antinuke',
  cooldown: 3,
  slash: true,
  slashData: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Antinuke configuration')
    .addSubcommand(s => s.setName('enable').setDescription('Enable antinuke'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable antinuke'))
    .addSubcommand(s => s.setName('status').setDescription('View antinuke status'))
    .addSubcommand(s => s.setName('punishment').setDescription('Set punishment').addStringOption(o => o.setName('type').setDescription('Punishment type').setRequired(true).addChoices(
      { name: 'Ban', value: 'ban' }, { name: 'Kick', value: 'kick' },
      { name: 'Remove Roles', value: 'removeRoles' }, { name: 'Quarantine', value: 'quarantine' }
    ))),

  async execute({ client, message, interaction, args, settings, isSlash }) {
    const guild = isSlash ? interaction.guild : message.guild;
    const executor = isSlash ? interaction.member : message.member;
    const guildSettings = settings || await getGuildSettings(client, guild.id);

    const isOwner = executor.id === guild.ownerId || (process.env.OWNER_IDS || '').split(',').includes(executor.id);
    const isExtraOwner = guildSettings?.antinuke?.extraOwners?.includes(executor.id);

    if (!isOwner && !isExtraOwner) {
      const embed = Embeds.error('No Permission', 'Only the server owner or extra owners can manage antinuke.');
      return isSlash ? interaction.reply({ embeds: [embed], ephemeral: true }) : message.reply({ embeds: [embed] });
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    let progressMessage = null;
    let replied = false;
    const sendProgress = async (embed) => {
      const payload = { embeds: [embed] };
      if (isSlash) {
        if (!replied) {
          await interaction.reply(payload);
          replied = true;
        } else {
          await interaction.editReply(payload);
        }
        return;
      }
      if (!progressMessage) {
        progressMessage = await message.channel.send(payload);
      } else {
        await progressMessage.edit(payload);
      }
    };
    const sendError = async (embed) => {
      if (isSlash) {
        if (replied) return interaction.editReply({ embeds: [embed] });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (progressMessage) return progressMessage.edit({ embeds: [embed] });
      return message.reply({ embeds: [embed] });
    };

    if (sub === 'enable') {
      const botMember = guild.members.me || guild.members.cache.get(client.user.id);
      if (!botMember) {
        const embed = Embeds.error('Setup Failed', `${BOT_NAME} could not find its own member record in this guild.`);
        await sendError(embed);
        return;
      }
      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        const embed = Embeds.error('Missing Permission', `${BOT_NAME} needs **Manage Roles** to create and position the protection role.`);
        await sendError(embed);
        return;
      }

      const steps = [
        { key: 'role', text: `Creating role \`${ROLE_NAME}\`` },
        { key: 'position', text: `Placing role just under ${BOT_NAME}` },
        { key: 'enable', text: 'Setting up antinuke safeguards' },
        { key: 'protect', text: 'Protecting your server' },
      ];
      const statuses = Object.fromEntries(steps.map((step) => [step.key, LOADING]));

      try {
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Setup`, steps, statuses));

        let role = guild.roles.cache.find((r) => r.name === ROLE_NAME);
        if (!role) {
          if (guild.roles.cache.size >= 250) {
            const embed = Embeds.error('Role Limit Reached', 'This server already has 250 roles. Please delete a role and try again.');
            await sendError(embed);
            return;
          }
          role = await guild.roles.create({
            name: ROLE_NAME,
            color: '#07ff00',
            permissions: [PermissionsBitField.Flags.Administrator],
            reason: `${BOT_NAME} antinuke setup`,
          });
        }
        statuses.role = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Setup`, steps, statuses));

        const targetPosition = Math.max(1, botMember.roles.highest.position - 1);
        if (targetPosition < botMember.roles.highest.position && role.position !== targetPosition) {
          await role.setPosition(targetPosition, { reason: `${BOT_NAME} antinuke setup` });
        }
        statuses.position = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Setup`, steps, statuses));

        await updateGuildSettings(client, guild.id, { $set: { 'antinuke.enabled': true } });
        statuses.enable = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Setup`, steps, statuses));

        if (!botMember.roles.cache.has(role.id)) {
          await botMember.roles.add(role, { reason: `${BOT_NAME} antinuke setup` });
        }
        statuses.protect = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Setup`, steps, statuses));

        const finalEmbed = buildFinalEmbed({
          guild,
          enabled: true,
          punishment: guildSettings?.antinuke?.punishment || 'ban',
        });
        await sendProgress(finalEmbed);
        return;
      } catch (err) {
        const embed = Embeds.error('Setup Failed', `${BOT_NAME} couldn’t finish setup. ${err?.message || 'Please try again.'}`);
        await sendError(embed);
        return;
      }
    }

    if (sub === 'disable') {
      const steps = [
        { key: 'disable', text: 'Disabling antinuke safeguards' },
        { key: 'clear', text: 'Clearing active protection status' },
        { key: 'update', text: 'Updating security modules' },
        { key: 'standdown', text: 'Standing down protection' },
      ];
      const statuses = Object.fromEntries(steps.map((step) => [step.key, LOADING]));

      try {
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Shutdown`, steps, statuses));

        await updateGuildSettings(client, guild.id, { $set: { 'antinuke.enabled': false } });
        statuses.disable = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Shutdown`, steps, statuses));

        statuses.clear = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Shutdown`, steps, statuses));

        statuses.update = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Shutdown`, steps, statuses));

        statuses.standdown = DONE;
        await sendProgress(buildProgressEmbed(`${BOT_NAME} Antinuke Shutdown`, steps, statuses));

        const finalEmbed = buildFinalEmbed({
          guild,
          enabled: false,
          punishment: guildSettings?.antinuke?.punishment || 'ban',
        });
        await sendProgress(finalEmbed);
        return;
      } catch (err) {
        const embed = Embeds.error('Disable Failed', `${BOT_NAME} couldn’t finish disabling. ${err?.message || 'Please try again.'}`);
        await sendError(embed);
        return;
      }
    }

    if (sub === 'punishment') {
      const type = isSlash ? interaction.options.getString('type') : args[1];
      if (!['ban','kick','removeRoles','quarantine'].includes(type)) {
        return isSlash ? interaction.reply({ embeds: [Embeds.error('Invalid', 'Use: ban, kick, removeRoles, quarantine')], ephemeral: true }) : message.reply({ embeds: [Embeds.error('Invalid', 'Use: ban, kick, removeRoles, quarantine')] });
      }
      await updateGuildSettings(client, guild.id, { $set: { 'antinuke.punishment': type } });
      return isSlash ? interaction.reply({ embeds: [Embeds.success('Punishment Updated', `Antinuke punishment set to **${type}**.`)] })
        : message.reply({ embeds: [Embeds.success('Punishment Updated', `Antinuke punishment set to **${type}**.`)] });
    }

    // Status
    const an = guildSettings?.antinuke;
    const embed = new EmbedBuilder()
      .setColor(an?.enabled ? Embeds.COLORS.success : Embeds.COLORS.error)
      .setTitle('🛡️ Antinuke Status')
      .addFields(
        { name: 'Status', value: an?.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Punishment', value: an?.punishment || 'ban', inline: true },
        { name: 'Whitelist', value: (an?.whitelist?.length || 0) + ' users', inline: true },
        { name: 'Extra Owners', value: (an?.extraOwners?.length || 0) + ' users', inline: true },
        { name: 'Panic Mode', value: an?.panicmode?.enabled ? '✅ Active' : '❌ Off', inline: true },
        { name: 'Night Mode', value: an?.nightmode ? '✅ Active' : '❌ Off', inline: true },
      )
      .setTimestamp();
    return isSlash ? interaction.reply({ embeds: [embed] }) : message.reply({ embeds: [embed] });
  },
};
