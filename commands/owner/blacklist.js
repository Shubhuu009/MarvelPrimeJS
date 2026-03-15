
const {
  EmbedBuilder, SlashCommandBuilder, PermissionsBitField,
} = require('discord.js');
const BlacklistManager = require('../../systems/blacklist/blacklist');
const { E, MARVEL_RED, MARVEL_GREEN, MARVEL_BLUE, MARVEL_GOLD, MARVEL_PURPLE, footer } = require('../../ui/embeds/marvel');
const logger = require('../../utils/logger');

const OWNER_IDS = process.env.OWNER_IDS?.split(',').map(id => id.trim()) || [];

// ─── Slash builder ────────────────────────────────────────────────────────────
const slashBuilder = new SlashCommandBuilder()
  .setName('bl')
  .setDescription('[OWNER] Blacklist management')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  // user subcommand group
  .addSubcommandGroup(g => g.setName('user').setDescription('User blacklist')
    .addSubcommand(s => s.setName('add').setDescription('Blacklist a user')
      .addStringOption(o => o.setName('userid').setDescription('User ID or mention').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')))
    .addSubcommand(s => s.setName('remove').setDescription('Unblacklist a user')
      .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List blacklisted users'))
    .addSubcommand(s => s.setName('info').setDescription('Info on a blacklisted user')
      .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true))))
  // guild subcommand group
  .addSubcommandGroup(g => g.setName('guild').setDescription('Guild blacklist')
    .addSubcommand(s => s.setName('add').setDescription('Blacklist a guild')
      .addStringOption(o => o.setName('guildid').setDescription('Guild ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')))
    .addSubcommand(s => s.setName('remove').setDescription('Unblacklist a guild')
      .addStringOption(o => o.setName('guildid').setDescription('Guild ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List blacklisted guilds'))
    .addSubcommand(s => s.setName('info').setDescription('Info on a blacklisted guild')
      .addStringOption(o => o.setName('guildid').setDescription('Guild ID').setRequired(true))));

module.exports = {
  name: 'bl',
  description: '[OWNER] Blacklist a user or guild from using the bot',
  aliases: ['blacklist', 'block'],
  usage: '.bl <user|guild> <add|remove|list|info> [id] [reason]',
  ownerOnly: true,
  category: 'owner',

  slash: slashBuilder,

  async execute({ client, message, interaction, args, isSlash, isOwnerCommand }) {
    const author = isSlash ? interaction.user : message.author;
    const ctx    = isSlash ? interaction : message;

    // ── Owner check ───────────────────────────────────────────────────────
    if (!OWNER_IDS.includes(author.id)) {
      const embed = new EmbedBuilder()
        .setTitle('<:marvel_Cross:1417857962688512203> **Access Denied**')
        .setColor(MARVEL_RED)
        .setDescription(
          `${E.cross} This command is **owner-only**!\n` +
          `${E.arrow} Nice try though 😏`
        )
        .setFooter(footer(author))
        .setTimestamp();
      return _reply(ctx, isSlash, embed, true);
    }

    if (isSlash) await interaction.deferReply({ ephemeral: true });

    // ── Parse type + subcommand ───────────────────────────────────────────
    let type, sub, targetId, reason;

    if (isSlash) {
      type     = interaction.options.getSubcommandGroup();  // 'user' | 'guild'
      sub      = interaction.options.getSubcommand();       // 'add' | 'remove' | 'list' | 'info'
      targetId = interaction.options.getString('userid') || interaction.options.getString('guildid');
      reason   = interaction.options.getString('reason') || 'No reason provided';
      if (targetId) targetId = targetId.replace(/[<@!>]/g, '');
    } else {
      type     = args[0]?.toLowerCase();
      sub      = args[1]?.toLowerCase();
      targetId = args[2]?.replace(/[<@!>]/g, '');
      reason   = args.slice(3).join(' ') || 'No reason provided';

      if (!type || !['user', 'guild'].includes(type) || !sub || !['add', 'remove', 'list', 'info'].includes(sub)) {
        return _reply(ctx, isSlash, _usageEmbed(author));
      }
    }

    // ═════════════════════════════════════════════════════
    //  USER BLACKLIST
    // ═════════════════════════════════════════════════════
    if (type === 'user') {
      if (sub === 'add') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **user ID or mention**!', author));
        if (OWNER_IDS.includes(targetId)) return _reply(ctx, isSlash, _err("You can't blacklist a bot owner 🤦", author));

        const target = await client.users.fetch(targetId).catch(() => null);
        if (!target) return _reply(ctx, isSlash, _err(`Can't find user \`${targetId}\` 🌌`, author));

        if (BlacklistManager.isUserBlocked(targetId))
          return _reply(ctx, isSlash, _err(`\`${target.tag}\` is **already** blacklisted 📋`, author));

        await BlacklistManager.blockUser(targetId, author.id, reason, false, 0);

        // DM the user
        await target.send({
          embeds: [{
            title: '🚫 You Have Been Blacklisted',
            color: MARVEL_RED,
            thumbnail: { url: target.displayAvatarURL() },
            description:
              `${E.cross} You have been **blacklisted** from **Marvel Bot**\n` +
              `${E.reason} **Reason :** ${reason}\n` +
              `${E.moderator} **By :** \`${author.username}\`\n\n` +
              `*To appeal, contact the bot owner.*`,
            footer: { text: 'Marvel Development ⚡' },
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});

        const embed = new EmbedBuilder()
          .setTitle('🚫 **User Blacklisted**')
          .setColor(MARVEL_RED)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(
            `${E.success} Successfully blacklisted \`${target.tag}\`\n` +
            `${E.reason} **Reason :** ${reason}\n` +
            `${E.arrow} User has been notified via DM`
          )
          .addFields(
            { name: '🆔 User ID', value: `\`${target.id}\``, inline: true },
            { name: '📅 Date',    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'remove') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **user ID**!', author));
        if (!BlacklistManager.isUserBlocked(targetId))
          return _reply(ctx, isSlash, _err(`\`${targetId}\` is **not** blacklisted 🤷`, author));

        const target = await client.users.fetch(targetId).catch(() => null);
        await BlacklistManager.unblockUser(targetId);

        const embed = new EmbedBuilder()
          .setTitle('✅ **User Unblacklisted**')
          .setColor(MARVEL_GREEN)
          .setThumbnail(target?.displayAvatarURL() || null)
          .setDescription(
            `${E.success} \`${target?.tag || targetId}\` has been **removed** from the blacklist\n` +
            `${E.arrow} They can now use Marvel Bot again`
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'list') {
        const users = await BlacklistManager.listUsers(20);
        const embed = new EmbedBuilder()
          .setTitle('📋 **Blacklisted Users**')
          .setColor(MARVEL_PURPLE)
          .setDescription(
            users.length
              ? users.map((u, i) =>
                  `**${i + 1}.** \`${u.userId}\` ${u.autoBlocked ? '🤖' : '👮'}\n` +
                  `   ${E.reason} ${u.reason.slice(0, 60)}`
                ).join('\n\n')
              : '`No users blacklisted`'
          )
          .addFields({ name: '📊 Total', value: `\`${BlacklistManager.userCount}\``, inline: true })
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'info') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **user ID**!', author));
        const data = await BlacklistManager.getUserInfo(targetId);
        if (!data) return _reply(ctx, isSlash, _err(`\`${targetId}\` is not blacklisted`, author));

        const target = await client.users.fetch(targetId).catch(() => null);
        const embed = new EmbedBuilder()
          .setTitle('🔍 **Blacklist Info — User**')
          .setColor(MARVEL_GOLD)
          .setThumbnail(target?.displayAvatarURL() || null)
          .addFields(
            { name: '👤 User',         value: `\`${target?.tag || targetId}\``, inline: true },
            { name: '🆔 ID',           value: `\`${data.userId}\``, inline: true },
            { name: '🤖 Auto-blocked', value: data.autoBlocked ? 'Yes' : 'No', inline: true },
            { name: '📌 Reason',       value: data.reason, inline: false },
            { name: '👮 Banned By',    value: `\`${data.bannedBy}\``, inline: true },
            { name: '📅 Date',         value: `<t:${Math.floor(new Date(data.createdAt).getTime() / 1000)}:F>`, inline: true },
            ...(data.autoBlocked ? [{ name: '⚠️ Spam Count', value: `\`${data.spamCount}\``, inline: true }] : []),
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }
    }

    // ═════════════════════════════════════════════════════
    //  GUILD BLACKLIST
    // ═════════════════════════════════════════════════════
    if (type === 'guild') {
      if (sub === 'add') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **guild ID**!', author));

        const targetGuild = client.guilds.cache.get(targetId);
        const guildName = targetGuild?.name || 'Unknown';

        if (BlacklistManager.isGuildBlocked(targetId))
          return _reply(ctx, isSlash, _err(`Guild \`${guildName}\` is **already** blacklisted 📋`, author));

        await BlacklistManager.blockGuild(targetId, guildName, author.id, reason, false, 0);

        // Leave the guild if bot is in it
        if (targetGuild) {
          await targetGuild.leave().catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setTitle('🚫 **Guild Blacklisted**')
          .setColor(MARVEL_RED)
          .setDescription(
            `${E.success} Guild \`${guildName}\` blacklisted\n` +
            `${E.reason} **Reason :** ${reason}\n` +
            `${E.arrow} ${targetGuild ? 'Bot has left the guild' : 'Bot was not in this guild'}`
          )
          .addFields(
            { name: '🆔 Guild ID', value: `\`${targetId}\``, inline: true },
            { name: '📅 Date',     value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'remove') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **guild ID**!', author));
        if (!BlacklistManager.isGuildBlocked(targetId))
          return _reply(ctx, isSlash, _err(`Guild \`${targetId}\` is **not** blacklisted 🤷`, author));

        const data = await BlacklistManager.getGuildInfo(targetId);
        await BlacklistManager.unblockGuild(targetId);

        const embed = new EmbedBuilder()
          .setTitle('✅ **Guild Unblacklisted**')
          .setColor(MARVEL_GREEN)
          .setDescription(
            `${E.success} Guild \`${data?.guildName || targetId}\` removed from blacklist\n` +
            `${E.arrow} The server can now use Marvel Bot again`
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'list') {
        const guilds = await BlacklistManager.listGuilds(20);
        const embed = new EmbedBuilder()
          .setTitle('📋 **Blacklisted Guilds**')
          .setColor(MARVEL_PURPLE)
          .setDescription(
            guilds.length
              ? guilds.map((g, i) =>
                  `**${i + 1}.** \`${g.guildId}\` — **${g.guildName}** ${g.autoBlocked ? '🤖' : '👮'}\n` +
                  `   ${E.reason} ${g.reason.slice(0, 60)}`
                ).join('\n\n')
              : '`No guilds blacklisted`'
          )
          .addFields({ name: '📊 Total', value: `\`${BlacklistManager.guildCount}\``, inline: true })
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }

      if (sub === 'info') {
        if (!targetId) return _reply(ctx, isSlash, _err('Provide a **guild ID**!', author));
        const data = await BlacklistManager.getGuildInfo(targetId);
        if (!data) return _reply(ctx, isSlash, _err(`Guild \`${targetId}\` is not blacklisted`, author));

        const embed = new EmbedBuilder()
          .setTitle('🔍 **Blacklist Info — Guild**')
          .setColor(MARVEL_GOLD)
          .addFields(
            { name: '🏠 Guild',        value: `\`${data.guildName}\``, inline: true },
            { name: '🆔 ID',           value: `\`${data.guildId}\``, inline: true },
            { name: '🤖 Auto-blocked', value: data.autoBlocked ? 'Yes' : 'No', inline: true },
            { name: '📌 Reason',       value: data.reason, inline: false },
            { name: '👮 Banned By',    value: `\`${data.bannedBy}\``, inline: true },
            { name: '📅 Date',         value: `<t:${Math.floor(new Date(data.createdAt).getTime() / 1000)}:F>`, inline: true },
            ...(data.autoBlocked ? [{ name: '⚠️ Spam Count', value: `\`${data.spamCount}\``, inline: true }] : []),
          )
          .setFooter(footer(author))
          .setTimestamp();
        return _reply(ctx, isSlash, embed);
      }
    }

    return _reply(ctx, isSlash, _usageEmbed(author));
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _err(desc, actor) {
  return new EmbedBuilder()
    .setTitle('<:marvel_Cross:1417857962688512203> **Error**')
    .setColor(MARVEL_RED)
    .setDescription(`${E.cross} ${desc}`)
    .setFooter(footer(actor))
    .setTimestamp();
}

function _usageEmbed(actor) {
  return new EmbedBuilder()
    .setTitle('⚡ **Blacklist Command — Owner Only**')
    .setColor(MARVEL_PURPLE)
    .addFields(
      { name: '👤 User — Add',      value: '`.bl user add <@user|ID> [reason]`', inline: false },
      { name: '👤 User — Remove',   value: '`.bl user remove <@user|ID>`', inline: false },
      { name: '👤 User — List',     value: '`.bl user list`', inline: false },
      { name: '👤 User — Info',     value: '`.bl user info <@user|ID>`', inline: false },
      { name: '🏠 Guild — Add',     value: '`.bl guild add <guildID> [reason]`', inline: false },
      { name: '🏠 Guild — Remove',  value: '`.bl guild remove <guildID>`', inline: false },
      { name: '🏠 Guild — List',    value: '`.bl guild list`', inline: false },
      { name: '🏠 Guild — Info',    value: '`.bl guild info <guildID>`', inline: false },
    )
    .setFooter({ text: 'Marvel Development ⚡ | 🤖 = auto-blacklisted • 👮 = manual' })
    .setTimestamp();
}

function _reply(ctx, isSlash, embed, ephemeral = false) {
  if (isSlash) {
    if (ctx.deferred || ctx.replied) return ctx.editReply({ embeds: [embed] });
    return ctx.reply({ embeds: [embed], ephemeral: true });
  }
  return ctx.reply({ embeds: [embed] });
}
