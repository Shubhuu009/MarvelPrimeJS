const { PermissionsBitField, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { listActiveQuarantines } = require('../../database/quarantine');
const QuarantineSystem = require('../../systems/quarantine/quarantine');
const Embeds = require('../../utils/embeds');

module.exports = {
  name: 'quarantine', description: 'Quarantine a member (removes all roles)',
  aliases: ['jail'], category: 'moderation', cooldown: 5,
  slash: new SlashCommandBuilder().setName('quarantine').setDescription('Quarantine system')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addSubcommand(s => s.setName('setup').setDescription('Create quarantine role and channel'))
    .addSubcommand(s => s.setName('add').setDescription('Quarantine a member').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')))
    .addSubcommand(s => s.setName('remove').setDescription('Release quarantine').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List quarantined members')),

  async execute({ client, message, interaction, args, isSlash }) {
    isSlash = isSlash || !!interaction;
    const guild  = isSlash ? interaction.guild  : message.guild;
    const member = isSlash ? interaction.member : message.member;
    const ctx    = isSlash ? interaction : message;

    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return isSlash ? ctx.reply({ embeds: [Embeds.error('No Permission', 'You need **Moderate Members**.')], ephemeral: true }) : ctx.reply({ embeds: [Embeds.error('No Permission', 'You need **Moderate Members**.')] });

    const sub = isSlash ? interaction.options.getSubcommand() : args[0];
    const qs  = new QuarantineSystem(client);

    if (sub === 'setup') {
      if (isSlash) await interaction.deferReply();
      if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles) || !member.permissions.has(PermissionsBitField.Flags.ManageChannels))
        return _re(ctx, isSlash, Embeds.error('No Permission', 'You need **Manage Roles** and **Manage Channels**.'));
      const botMember = guild.members.me || guild.members.cache.get(client.user.id);
      if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageRoles) || !botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels))
        return _re(ctx, isSlash, Embeds.error('Missing Permission', 'I need **Manage Roles** and **Manage Channels**.'));
      const result = await qs.ensureSetup(guild, `Quarantine setup by ${member.user?.tag || member.id}`);
      return _re(ctx, isSlash, Embeds.success('Quarantine Setup', `Role: <@&${result.role.id}>\nChannel: <#${result.channel.id}>`));
    }

    if (sub === 'add') {
      if (isSlash) await interaction.deferReply();
      const target = isSlash ? interaction.options.getMember('user') : await guild.members.fetch(args[1]?.replace(/[<@!>]/g,'')).catch(()=>null);
      const reason = isSlash ? (interaction.options.getString('reason')||'No reason') : (args.slice(2).join(' ')||'No reason');
      if (!target) return _re(ctx, isSlash, Embeds.error('Not Found', 'Member not found.'));
      const result = await qs.quarantine(guild, target, member, reason);
      if (!result.success) return _re(ctx, isSlash, Embeds.error('Error', result.reason));
      return _re(ctx, isSlash, Embeds.success('🔒 Quarantined', `<@${target.id}> quarantined.\n**Reason:** ${reason}\n**Roles saved:** ${result.roles?.length||0}`));
    }
    if (sub === 'remove') {
      if (isSlash) await interaction.deferReply();
      const target = isSlash ? interaction.options.getMember('user') : await guild.members.fetch(args[1]?.replace(/[<@!>]/g,'')).catch(()=>null);
      if (!target) return _re(ctx, isSlash, Embeds.error('Not Found', 'Member not found.'));
      const result = await qs.unquarantine(guild, target, member, 'Released');
      if (!result.success) return _re(ctx, isSlash, Embeds.error('Error', result.reason));
      return _re(ctx, isSlash, Embeds.success('🔓 Released', `<@${target.id}> released.\n**Roles restored:** ${result.restoredRoles}`));
    }
    if (sub === 'list') {
      const active = await listActiveQuarantines(guild.id);
      const color = Embeds?.COLORS?.warning || Embeds?.COLORS?.info || 0x2f3136;
      const embed = new EmbedBuilder().setColor(color).setTitle('🔒 Quarantined Members')
        .setDescription(active.length ? active.map(q => `<@${q.userId}> — ${q.reason}`).join('\n') : 'No quarantined members.')
        .setFooter({ text: `Total: ${active.length}` }).setTimestamp();
      return isSlash ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }
  },
};

function _re(ctx, isSlash, embed) { if (isSlash) { if (ctx.deferred||ctx.replied) return ctx.editReply({ embeds: [embed] }); return ctx.reply({ embeds: [embed] }); } return ctx.reply({ embeds: [embed] }); }
