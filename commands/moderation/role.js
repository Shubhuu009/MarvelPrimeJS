const {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require('discord.js');
const logger = require('../../services/logging');
const { result } = require('../../services/marvelEmbeds');

module.exports = {
    name: 'role',
    description: 'Advanced role management for members and groups.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    botPermissions: [PermissionFlagsBits.ManageRoles],
    argsCount: 2, // GLOBAL STRICT MODE: Ignores command if more than 2 args are provided

    // 1. Slash Command Registration
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Advanced role management for members and groups.')
        .addUserOption(opt => 
            opt.setName('member')
                .setDescription('The member to add/remove role from'))
        .addRoleOption(opt => 
            opt.setName('role')
                .setDescription('The role to add or remove'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(context, args) {
        const isSlash = context.isChatInputCommand?.();
        
        // INTERACTION SHIELD: Tell Discord we are processing
        if (isSlash) {
            try {
                await context.deferReply({ flags: MessageFlags.Ephemeral });
            } catch (error) {
                if (error.code === 10062) return;
                throw error;
            }
        }

        const subCommand = !isSlash ? args[0]?.toLowerCase() : null;

        // 2. Get parameters for slash command
        if (isSlash) {
            const targetMember = context.options.getMember('member');
            const role = context.options.getRole('role');
            
            if (targetMember && role) {
                return this.toggleRole(context, targetMember, role, true);
            }
            // If slash command without required options, show help
            return this.sendHelp(context);
        }

        // Message command handling
        const { message } = context;
        
        // Single Target Toggle: .role <@user> <@role>
        if (context.mentions.members.first() && !subCommand.match(/all|humans|bots|create|delete/)) {
            return this.toggleRole(context, context.mentions.members.first(), context.mentions.roles.first() || message.guild.roles.cache.get(args[1]), false);
        }

        switch (subCommand) {
            case 'create': return this.createRole(context, args);
            case 'delete': return this.deleteRole(context, args);
            case 'all':
            case 'humans':
            case 'bots':
                return this.handleMassAction(context, args);
            default:
                return this.sendHelp(context);
        }
    },

    // --- Single Role Toggle Logic ---
    async toggleRole(context, target, role, isSlash) {
        const author = isSlash ? context.user : context.author;
        
        if (!target || !role) return this.failure(context, "Target", "Please mention a valid user and role.", isSlash);

        if (this.checkHierarchy(context, role, isSlash)) return;

        const hasRole = target.roles.cache.has(role.id);
        try {
            if (hasRole) {
                await target.roles.remove(role, `Removed by ${author.tag}`);
            } else {
                await target.roles.add(role, `Added by ${author.tag}`);
            }

            // Log to Audit Log
            const auditLog = await context.guild.fetchAuditLogs({ type: 25, limit: 1 }).catch(() => null);

            const embed = new EmbedBuilder()
                .setTitle(`**Role ${hasRole ? 'Removed' : 'Added'}**`)
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Role ${hasRole ? 'Remove' : 'Add'}__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Successful Action**\n` +
                    `<:Marvel_arrow:1417857492238729289> Member: ${target}\n` +
                    `<:marvel_Time:1417874202433683608> Role: ${role}\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();
            return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
        } catch (err) {
            return this.failure(context, target.user.username, "I don't have permission to modify that role.", isSlash);
        }
    },

    // --- Mass Action Handler (all/humans/bots) ---
    async handleMassAction(context, args) {
        const group = args[0].toLowerCase();
        const action = args[1]?.toLowerCase(); // add or remove
        const role = context.mentions.roles.first() || context.guild.roles.cache.get(args[2]);

        if (!['add', 'remove'].includes(action) || !role) {
            return this.failure(context, "Mass Action", `Usage: \`.role ${group} <add/remove> <@role>\``, false);
        }

        if (this.checkHierarchy(context, role, false)) return;

        let members = await context.guild.members.fetch();
        if (group === 'humans') members = members.filter(m => !m.user.bot);
        else if (group === 'bots') members = members.filter(m => m.user.bot);

        const targetMembers = action === 'add'
            ? members.filter(m => !m.roles.cache.has(role.id))
            : members.filter(m => m.roles.cache.has(role.id));

        if (targetMembers.size === 0) return this.failure(context, group, `No ${group} found to ${action} this role for! 🤷`, false);

        // --- Confirmation View ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle("⚠️ Confirmation Required")
            .setDescription(`You are about to **${action}** the ${role} role for **${targetMembers.size}** ${group}.\nAre you sure?`)
            .setColor(0xFFA500);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const msg = await context.reply({ embeds: [confirmEmbed], components: [row] });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === context.author.id,
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'cancel') {
                await interaction.update({ ...result(interaction.user, 'Role Action Result', 'Mass Role', 'Operation cancelled.', false, 'Cancelled by moderator.'), components: [] });
                return collector.stop();
            }

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('**Role Action Result**')
                        .setColor(0x0099ff)
                        .setDescription(`**__Action : Mass Role ${action === 'add' ? 'Add' : 'Remove'}__**\n⚙️ Working... ${action === 'add' ? 'Adding' : 'Removing'} role for members.`)
                        .setFooter({ text: 'Marvel Development ⚡', iconURL: context.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp()
                ],
                components: []
            });

            let count = 0;
            for (const [id, member] of targetMembers) {
                try {
                    if (action === 'add') await member.roles.add(role);
                    else await member.roles.remove(role);
                    count++;
                    await new Promise(r => setTimeout(r, 500)); // Rate limit protection
                } catch (e) { continue; }
            }

            const successEmbed = new EmbedBuilder()
                .setTitle(`**Mass Role Result**`)
                .setColor(0x00f53d)
                .setDescription(
                    `**__Action : Mass Role ${action === 'add' ? 'Add' : 'Remove'}__**\n` +
                    `<:Marvel_Successfully:1417856966352568472> **Update Complete**\n` +
                    `<:Marvel_arrow:1417857492238729289> ${action === 'add' ? 'Added' : 'Removed'} ${role} for **${count}** members.\n` +
                    `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${context.author.username}\``
                )
                .setFooter({ text: "Marvel Development ⚡", iconURL: context.author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();
            await interaction.editReply({ content: null, embeds: [successEmbed] });
            collector.stop();
        });
    },

    // --- Helpers ---
    checkHierarchy(context, role, isSlash) {
        const member = isSlash ? context.member : context.member;
        const author = isSlash ? context.user : context.author;
        
        if (role.position >= member.roles.highest.position && author.id !== context.guild.ownerId) {
            this.failure(context, role.name, "You can't manage a role higher than your own! 🤔", isSlash);
            return true;
        }
        if (role.position >= context.guild.members.me.roles.highest.position) {
            this.failure(context, role.name, "That role is higher than mine! 💪", isSlash);
            return true;
        }
        return false;
    },

    failure(context, target, reason, isSlash) {
        const author = isSlash ? context.user : context.author;
        const embed = new EmbedBuilder()
            .setTitle("**Role Action Result**")
            .setColor(0xFF0000)
            .setDescription(
                `**__Action : Role__**\n` +
                `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                `<:marvel_Cross:1417857962688512203> **Unsuccessful Action**\n` +
                `<:Marvel_arrow:1417857492238729289> \`${target}\`\n` +
                `<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}`
            )
            .setFooter({ text: "Marvel Development ⚡", iconURL: author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
        return isSlash ? context.editReply({ embeds: [embed] }) : context.reply({ embeds: [embed] });
    },

    sendHelp(context) {
        const isSlash = context.isChatInputCommand?.();
        const p = process.env.DEFAULT_PREFIX || ".";
        const embed = new EmbedBuilder()
            .setTitle("⚙️ Role Command Usage")
            .setColor(0x0099ff)
            .setDescription(
                `\`\`\`\n${p}role @user @role (Toggle)\n${p}role all <add/remove> @role\n${p}role humans <add/remove> @role\n${p}role bots <add/remove> @role\n${p}role create <name>\n${p}role delete @role\n\`\`\``
            );
        if (!isSlash) {
            return context.reply({ embeds: [embed] });
        }

        if (context.deferred || context.replied) {
            return context.editReply({ embeds: [embed] });
        }

        return context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
