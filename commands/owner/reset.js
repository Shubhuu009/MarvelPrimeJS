const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const Embeds = require('../../utils/embeds');
const BlacklistManager = require('../../systems/blacklist/blacklist');
const { AutomodModel } = require('../../database/automod');
const { WelcomerModel } = require('../../database/welcomer');
const { TicketSettingsModel, TicketLogModel } = require('../../database/ticket');
const { GuildSettingsModel } = require('../../utils/permissions');

const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
const COOLDOWN_MS = 120 * 1000;
const guildCooldowns = new Map();

const onCooldown = (guildId) => {
  const now = Date.now();
  const last = guildCooldowns.get(guildId) || 0;
  if (now - last < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
  guildCooldowns.set(guildId, now);
  return 0;
};

const listModulesEmbed = (prefix = '.') => new EmbedBuilder()
  .setColor(Embeds?.COLORS?.info || 0x3b82f6)
  .setTitle('Reset Modules')
  .setDescription('Here are the modules you can reset.')
  .addFields(
    { name: 'All', value: `\`${prefix}reset all\`` },
    { name: 'AutoMod', value: '`automod`' },
    { name: 'AntiNuke', value: '`antinuke`' },
    { name: 'Welcomer', value: '`welcomer`' },
    { name: 'Ticket', value: '`ticket`' },
  );

const confirmRow = (disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('reset:all:yes')
    .setLabel('Yes')
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled),
  new ButtonBuilder()
    .setCustomId('reset:all:no')
    .setLabel('No')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled),
);

const runResetAll = async (guildId) => {
  await Promise.allSettled([
    AutomodModel.deleteOne({ guildId }),
    WelcomerModel.deleteOne({ guildId }),
    TicketSettingsModel.deleteOne({ guildId }),
    TicketLogModel.deleteOne({ guildId }),
    GuildSettingsModel.deleteOne({ guildId }),
  ]);
};

module.exports = {
  name: 'reset',
  description: 'Reset module settings',
  category: 'owner',
  ownerOnly: true,
  cooldown: 3,
  slash: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset module settings')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(s => s.setName('list').setDescription('Show resettable modules'))
    .addSubcommand(s => s.setName('all').setDescription('Reset all module settings')),

  async execute({ message, interaction, isSlash, args }) {
    const ctx = isSlash ? interaction : message;
    const author = isSlash ? interaction.user : message.author;
    const guild = isSlash ? interaction.guild : message.guild;

    if (!guild) return;

    if (BlacklistManager.isGuildBlocked(guild.id) || BlacklistManager.isUserBlocked(author.id)) {
      return;
    }

    if (!OWNER_IDS.includes(author.id)) {
      const embed = Embeds.error('No Permission', 'This command is owner-only.');
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const left = onCooldown(guild.id);
    if (left > 0) {
      const embed = Embeds.warning('Cooldown', `Please wait **${left}s** before using this command again.`);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();
    const prefix = process.env.PREFIX || '.';

    if (!sub || sub === 'list') {
      const embed = listModulesEmbed(prefix);
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    if (sub !== 'all') {
      const embed = Embeds.error('Invalid', 'Use `reset all` to reset everything.');
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(Embeds?.COLORS?.warning || 0xf59e0b)
      .setTitle('Reset All Modules')
      .setDescription(
        'Are you sure you want to reset **all** module settings?\n' +
        'This will reset AutoMod, AntiNuke, Welcomer, and Ticket settings.'
      )
      .setFooter({ text: `Requested by ${author.tag}` });

    const sent = await (isSlash
      ? ctx.reply({ embeds: [confirmEmbed], components: [confirmRow(false)], ephemeral: true, fetchReply: true })
      : ctx.reply({ embeds: [confirmEmbed], components: [confirmRow(false)] }));

    const collector = sent.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== author.id) {
        return i.reply({ content: 'You are not allowed to use this interaction.', ephemeral: true });
      }
      if (i.customId === 'reset:all:no') {
        await i.update({ embeds: [Embeds.error('Reset Cancelled', 'No changes were made.')], components: [] });
        collector.stop('cancelled');
        return;
      }
      if (i.customId === 'reset:all:yes') {
        await i.update({ embeds: [Embeds.info('Resetting', 'Resetting all module settings...')], components: [] });
        await runResetAll(guild.id);
        await i.followUp({ embeds: [Embeds.success('Reset Complete', 'All module settings have been reset.')], ephemeral: true });
        collector.stop('done');
      }
    });

    collector.on('end', async () => {
      if (!sent.editable) return;
      await sent.edit({ components: [confirmRow(true)] }).catch(() => null);
    });
  },
};
