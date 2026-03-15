const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const NoPrefix = require('../../database/schemas/NoPrefix');
const logger = require('../../utils/logger');
const { warn, MARVEL_GREEN, MARVEL_RED, footer, E } = require('../../ui/embeds/marvel');

const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

function parseUserId(raw) {
  if (!raw) return null;
  const match = String(raw).match(/<@!?(\d+)>/);
  return match ? match[1] : String(raw).trim();
}

function reply(ctx, isSlash, payload, ephemeral = true) {
  if (isSlash) return ctx.reply({ ...payload, ephemeral });
  return ctx.reply(payload);
}

module.exports = {
  name: 'noprefix',
  aliases: ['np'],
  category: 'owner',
  description: 'Manage users who can use commands without a prefix.',
  ownerOnly: true,
  slash: new SlashCommandBuilder()
    .setName('noprefix')
    .setDescription('Manage users who can use commands without a prefix')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(s => s.setName('add').setDescription('Add a user')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List no-prefix users')),

  async execute({ client, message, interaction, args, isSlash }) {
    const ctx = isSlash ? interaction : message;
    const author = isSlash ? interaction.user : message.author;

    if (!OWNER_IDS.includes(author.id)) {
      const embed = warn('Owner Only', 'This command is restricted to bot owners.', author);
      return reply(ctx, isSlash, { embeds: [embed] }, true);
    }

    const sub = isSlash ? interaction.options.getSubcommand() : args[0]?.toLowerCase();

    if (sub === 'list') {
      const users = await NoPrefix.find().lean();
      const embed = new EmbedBuilder()
        .setTitle('**No Prefix System**')
        .setColor(MARVEL_GREEN)
        .setFooter(footer(author))
        .setTimestamp();

      if (!users.length) {
        embed.setDescription(`${E.cross} **Status :** Empty\n**Reason :** No users found in database.`);
        return reply(ctx, isSlash, { embeds: [embed] }, true);
      }

      const list = users.map((u, i) => `\`${i + 1}.\` <@${u.userId}> (\`${u.userId}\`)`).join('\n');
      embed.setDescription(`**__Authorized Users__**\n${list}`);
      return reply(ctx, isSlash, { embeds: [embed] }, true);
    }

    const action = sub;
    const targetId = isSlash
      ? interaction.options.getUser('user')?.id
      : parseUserId(args[1]);

    if (!targetId) return;

    const targetUser = await client.users.fetch(targetId).catch(() => null);
    if (!targetUser) {
      const embed = warn('No Prefix Result', 'Invalid user ID.', author);
      return reply(ctx, isSlash, { embeds: [embed] }, true);
    }

    if (['add', 'a', '+'].includes(action)) {
      const exists = await NoPrefix.findOne({ userId: targetUser.id });
      if (exists) {
        const embed = warn('No Prefix Result', `**${targetUser.username}** is already in the list.`, author);
        return reply(ctx, isSlash, { embeds: [embed] }, true);
      }

      await NoPrefix.create({ userId: targetUser.id, addedBy: author.id });
      if (client.noPrefixUsers) client.noPrefixUsers.add(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('**No Prefix Update**')
        .setColor(MARVEL_GREEN)
        .setDescription(
          `${E.success} **Action :** Added\n` +
          `${E.moderator} **User :** <@${targetUser.id}>\n` +
          `${E.reason} **Status :** Permission Granted`
        )
        .setFooter(footer(author))
        .setTimestamp();
      return reply(ctx, isSlash, { embeds: [embed] }, true);
    }

    if (['remove', 'r', '-'].includes(action)) {
      const deleted = await NoPrefix.findOneAndDelete({ userId: targetUser.id });
      if (!deleted) {
        const embed = warn('No Prefix Result', `**${targetUser.username}** is not in the list.`, author);
        return reply(ctx, isSlash, { embeds: [embed] }, true);
      }

      if (client.noPrefixUsers) client.noPrefixUsers.delete(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('**No Prefix Update**')
        .setColor(MARVEL_RED)
        .setDescription(
          `${E.success} **Action :** Removed\n` +
          `${E.moderator} **User :** <@${targetUser.id}>\n` +
          `${E.reason} **Status :** Permission Revoked`
        )
        .setFooter(footer(author))
        .setTimestamp();
      return reply(ctx, isSlash, { embeds: [embed] }, true);
    }

    logger.warn(`[NoPrefix] Unknown subcommand: ${sub}`);
  },
};
