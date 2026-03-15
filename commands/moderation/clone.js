const {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const Welcomer = require('../../models/Welcomer');
const logger = require('../../services/logging');
const parseVars = require('../../services/variableParser');

const COLOR_MAP = {
    red: 0xe74c3c,
    green: 0x2ecc71,
    blue: 0x3498db,
    yellow: 0xf1c40f,
    purple: 0x9b59b6,
    pink: 0xff69b4,
    orange: 0xe67e22,
    black: 0x2f3136,
    white: 0xffffff,
    gray: 0x95a5a6,
    grey: 0x95a5a6,
    cyan: 0x1abc9c
};

function normalizeColor(value) {
    if (!value) return '#95a5a6';
    const lower = String(value).toLowerCase().trim();
    if (COLOR_MAP[lower]) return lower;
    if (/^#?[0-9a-f]{6}$/i.test(lower)) {
        return lower.startsWith('#') ? lower : `#${lower}`;
    }
    return '#95a5a6';
}

function resolveColor(value) {
    const lower = String(value || '').toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    if (/^#?[0-9a-f]{6}$/i.test(lower)) {
        return parseInt(lower.replace('#', ''), 16);
    }
    return 0x95a5a6;
}

function parseBooleanMode(value) {
    switch (String(value || '').toLowerCase()) {
        case 'both':
        case 'message_and_embed':
            return { welcome_message: true, welcome_embed: true };
        case 'message':
        case 'msg':
            return { welcome_message: true, welcome_embed: false };
        case 'embed':
        case 'emb':
            return { welcome_message: false, welcome_embed: true };
        default:
            return null;
    }
}

function cleanValue(value) {
    return String(value || '').replace(/\\n/g, '\n');
}

function getRawValueFromPrefixMessage(context, prefix, tokensToSkip) {
    if (!context?.content || typeof context.content !== 'string') return '';

    const withoutPrefix = context.content.startsWith(prefix)
        ? context.content.slice(prefix.length)
        : context.content;

    let remaining = withoutPrefix.trimStart();
    for (let index = 0; index < tokensToSkip; index += 1) {
        const tokenMatch = remaining.match(/^\S+/);
        if (!tokenMatch) return '';
        remaining = remaining.slice(tokenMatch[0].length);
        if (index < tokensToSkip - 1) {
            const whitespaceMatch = remaining.match(/^\s+/);
            if (!whitespaceMatch) return '';
            remaining = remaining.slice(whitespaceMatch[0].length);
        }
    }

    return cleanValue(remaining.trimStart());
}

function resolveRoleFromInput(context, raw) {
    if (!raw) return null;
    const normalized = String(raw).replace(/[<@&>]/g, '');
    return context.guild.roles.cache.get(normalized) || null;
}

function safeParsedText(value, member, guild, fallback = '') {
    const parsed = parseVars(typeof value === 'string' ? value : '', member, guild);
    return typeof parsed === 'string' ? parsed : fallback;
}

function isValidUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function buildWelcomePreview(data, member) {
    const content = data.welcome_message
        ? safeParsedText(data.welcome_message_content, member, member.guild)
        : null;

    let embed = null;
    if (data.welcome_embed) {
        const title = safeParsedText(data.welcome_embed_title || '🎉 Welcome!', member, member.guild, '🎉 Welcome!');
        const description = safeParsedText(data.welcome_embed_description || '', member, member.guild, '');

        embed = new EmbedBuilder()
            .setTitle(title.slice(0, 256) || '🎉 Welcome!')
            .setColor(resolveColor(data.welcome_embed_color));

        if (description) {
            embed.setDescription(description.slice(0, 4096));
        }

        const thumbnail = safeParsedText(data.welcome_embed_thumbnail || '', member, member.guild);
        const image = safeParsedText(data.welcome_embed_image || '', member, member.guild);
        const footerText = safeParsedText(data.welcome_embed_footer || '', member, member.guild);
        const footerIcon = safeParsedText(data.welcome_embed_footer_icon || '', member, member.guild);
        const authorName = safeParsedText(data.welcome_embed_author || '', member, member.guild);
        const authorIcon = safeParsedText(data.welcome_embed_author_icon || '', member, member.guild);
        const authorUrl = safeParsedText(data.welcome_embed_author_url || '', member, member.guild);

        if (isValidUrl(thumbnail)) embed.setThumbnail(thumbnail);
        if (isValidUrl(image)) embed.setImage(image);
        if (footerText || footerIcon) {
            const footer = { text: footerText || member.guild.name };
            if (isValidUrl(footerIcon)) footer.iconURL = footerIcon;
            embed.setFooter(footer);
        }
        if (authorName || authorIcon || authorUrl) {
            const author = { name: authorName || member.guild.name };
            if (isValidUrl(authorIcon)) author.iconURL = authorIcon;
            if (isValidUrl(authorUrl)) author.url = authorUrl;
            embed.setAuthor(author);
        }
    }

    return { content, embed };
}

function buildVariablesEmbed() {
    return new EmbedBuilder()
        .setTitle('**Welcomer Variables**')
        .setColor(0x95a5a6)
        .setDescription(parseVars.supportedVariables.map(variable => `\`${variable}\``).join(', '))
        .setFooter({ text: 'Use these in welcome message, embed fields, greet message, and autonick format.' })
        .setTimestamp();
}

function helpEmbed(prefix) {
    return new EmbedBuilder()
        .setTitle('**Welcomer Command Center**')
        .setColor(0x95a5a6)
        .setDescription(
            [
                `\`${prefix}welcomer welcome settings\``,
                `\`${prefix}welcomer welcome toggle\``,
                `\`${prefix}welcomer welcome channel #channel\``,
                `\`${prefix}welcomer welcome type <message|embed|both>\``,
                `\`${prefix}welcomer welcome message <content>\``,
                `\`${prefix}welcomer welcome embed <field> <value>\``,
                `\`${prefix}welcomer welcome preview\``,
                `\`${prefix}welcomer welcome variables\``,
                `\`${prefix}welcomer autonick settings|toggle|format\``,
                `\`${prefix}welcomer greet settings|toggle|channels|message|deleteafter\``
            ].join('\n')
        )
        .setFooter({ text: 'Marvel Development ⚡' })
        .setTimestamp();
}

function buildSettingsEmbed(data, guild) {
    const welcomeType = data.welcome_message && data.welcome_embed
        ? 'Message & Embed'
        : data.welcome_message
            ? 'Message'
            : data.welcome_embed
                ? 'Embed'
                : 'Disabled';

    return new EmbedBuilder()
        .setTitle('**Welcomer Result**')
        .setColor(0x95a5a6)
        .setDescription(
            `**__Action : Settings__**\n` +
            `<:Marvel_arrow:1417857492238729289> **Guild :** \`${guild.name}\`\n` +
            `<:Marvel_Successfully:1417856966352568472> **Configuration Loaded**`
        )
        .addFields(
            {
                name: 'Welcome',
                value: [
                    `Status: ${data.welcome ? 'Enabled' : 'Disabled'}`,
                    `Channel: ${data.welcome_channel ? `<#${data.welcome_channel}>` : '`Not set`'}`,
                    `Type: \`${welcomeType}\``,
                    `Message: ${data.welcome_message_content ? 'Configured' : 'Not set'}`
                ].join('\n'),
                inline: false
            },
            {
                name: 'Welcome Embed',
                value: [
                    `Title: \`${data.welcome_embed_title || 'Not set'}\``,
                    `Description: ${data.welcome_embed_description ? 'Configured' : 'Not set'}`,
                    `Color: \`${data.welcome_embed_color || '#95a5a6'}\``
                ].join('\n'),
                inline: false
            },
            {
                name: 'Autonick',
                value: [
                    `Status: ${data.autonick ? 'Enabled' : 'Disabled'}`,
                    `Format: \`${data.autonick_format || 'Not set'}\``
                ].join('\n'),
                inline: false
            },
            {
                name: 'Greet',
                value: [
                    `Status: ${data.greet ? 'Enabled' : 'Disabled'}`,
                    `Channels: ${data.greet_channels.length ? data.greet_channels.map(id => `<#${id}>`).join(', ') : 'None'}`,
                    `Delete After: \`${data.greet_delete_after || 0}s\``,
                    `Message: \`${data.greet_message || 'Not set'}\``
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Marvel Development ⚡ | Variables: {user}, {user.tag}, {user.mention}, {guild}, {member.count}, {guild.icon}' })
        .setTimestamp();
}

async function getConfig(guildId) {
    let data = await Welcomer.findOne({ guildId });
    if (!data) data = await Welcomer.create({ guildId });
    return data;
}

function respond(context, payload) {
    if (context.isChatInputCommand?.()) {
        if (context.replied || context.deferred) {
            return context.followUp(payload);
        }
        return context.reply(payload);
    }
    return context.reply(payload);
}

function marvelEmbed(author, action, success, details, reason = null) {
    const embed = new EmbedBuilder()
        .setTitle('**Welcomer Result**')
        .setColor(success ? 0x00f53d : 0xff0000)
        .setDescription(
            `**__Action : ${action}__**\n` +
            `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
            `${success ? '<:Marvel_Successfully:1417856966352568472> **Successful Update**' : '<:marvel_Cross:1417857962688512203> **Unsuccessful Update**'}\n` +
            `<:Marvel_arrow:1417857492238729289> ${details}` +
            (reason ? `\n<:Marvel_Reason:1417815247905095761> **Reason :** ${reason}` : '')
        )
        .setFooter({ text: 'Marvel Development ⚡', iconURL: author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

    return { embeds: [embed] };
}

module.exports = {
    name: 'welcomer',
    aliases: ['welcome'],
    description: 'Configure welcome, autorole, autonick, and greet systems.',
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('welcomer')
        .setDescription('Configure welcome, autorole, autonick, and greet systems')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommandGroup(group =>
            group
                .setName('welcome')
                .setDescription('Welcome settings')
                .addSubcommand(sub => sub.setName('settings').setDescription('Show welcome settings'))
                .addSubcommand(sub => sub.setName('toggle').setDescription('Enable or disable welcome'))
                .addSubcommand(sub => sub
                    .setName('channel')
                    .setDescription('Set the welcome channel')
                    .addChannelOption(option =>
                        option.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
                .addSubcommand(sub => sub
                    .setName('type')
                    .setDescription('Set welcome output type')
                    .addStringOption(option =>
                        option.setName('mode').setDescription('message, embed, or both').setRequired(true)
                            .addChoices(
                                { name: 'Message', value: 'message' },
                                { name: 'Embed', value: 'embed' },
                                { name: 'Both', value: 'both' }
                            )))
                .addSubcommand(sub => sub
                    .setName('message')
                    .setDescription('Set welcome message content')
                    .addStringOption(option => option.setName('content').setDescription('Welcome message').setRequired(true)))
                .addSubcommand(sub => sub
                    .setName('embed')
                    .setDescription('Set a welcome embed field')
                    .addStringOption(option =>
                        option.setName('field').setDescription('Embed field').setRequired(true)
                            .addChoices(
                                { name: 'Title', value: 'title' },
                                { name: 'Description', value: 'description' },
                                { name: 'Color', value: 'color' },
                                { name: 'Thumbnail', value: 'thumbnail' },
                                { name: 'Image', value: 'image' },
                                { name: 'Footer Text', value: 'footer' },
                                { name: 'Footer Icon', value: 'footer_icon' },
                                { name: 'Author Name', value: 'author' },
                                { name: 'Author Icon', value: 'author_icon' },
                                { name: 'Author URL', value: 'author_url' }
                            ))
                    .addStringOption(option => option.setName('value').setDescription('New value').setRequired(true)))
                .addSubcommand(sub => sub.setName('preview').setDescription('Preview the current welcome message'))
                .addSubcommand(sub => sub.setName('variables').setDescription('Show supported welcome variables')))
        .addSubcommandGroup(group =>
            group
                .setName('autonick')
                .setDescription('Autonick settings')
                .addSubcommand(sub => sub.setName('settings').setDescription('Show autonick settings'))
                .addSubcommand(sub => sub.setName('toggle').setDescription('Enable or disable autonick'))
                .addSubcommand(sub => sub
                    .setName('format')
                    .setDescription('Set the autonick format')
                    .addStringOption(option => option.setName('value').setDescription('Nickname format').setRequired(true))))
        .addSubcommandGroup(group =>
            group
                .setName('greet')
                .setDescription('Greet settings')
                .addSubcommand(sub => sub.setName('settings').setDescription('Show greet settings'))
                .addSubcommand(sub => sub.setName('toggle').setDescription('Enable or disable greet'))
                .addSubcommand(sub => sub
                    .setName('channels')
                    .setDescription('Set greet channels')
                    .addStringOption(option => option.setName('channel_ids').setDescription('Channel mentions or IDs, space separated').setRequired(true)))
                .addSubcommand(sub => sub
                    .setName('message')
                    .setDescription('Set greet message')
                    .addStringOption(option => option.setName('content').setDescription('Greet message').setRequired(true)))
                .addSubcommand(sub => sub
                    .setName('deleteafter')
                    .setDescription('Set greet auto-delete seconds')
                    .addIntegerOption(option => option.setName('seconds').setDescription('0 to 60').setRequired(true)))),

    async execute(context, args = []) {
        const isSlash = context.isChatInputCommand?.();
        const { guild, member, client } = context;
        const prefix = client.prefix || '.';
        const author = isSlash ? context.user : context.author;

        if (!guild) {
            return respond(context, marvelEmbed(author, 'Welcomer', false, 'Server-only command.', 'This command only works in servers.'));
        }

        const user = author;
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !client.ownerIds.includes(user.id)) {
            return respond(context, marvelEmbed(author, 'Permission Check', false, '`Manage Server` permission required.', 'You need `Manage Server` to use this command.'));
        }

        try {
            const data = await getConfig(guild.id);

            let section;
            let action;

            if (isSlash) {
                section = context.options.getSubcommandGroup();
                action = context.options.getSubcommand();
            } else {
                section = args[0]?.toLowerCase();
                action = args[1]?.toLowerCase();
            }

            if (!section) {
                return respond(context, { embeds: [helpEmbed(prefix)] });
            }

            if (section === 'welcome') {
                if (!action || action === 'settings') {
                    return respond(context, { embeds: [buildSettingsEmbed(data, guild)] });
                }

                if (action === 'toggle') {
                    data.welcome = !data.welcome;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Welcome Toggle', true, `Welcome is now \`${data.welcome ? 'enabled' : 'disabled'}\`.`));
                }

                if (action === 'channel') {
                    const channel = isSlash ? context.options.getChannel('channel') : context.mentions.channels.first();
                    if (!channel) return respond(context, marvelEmbed(author, 'Welcome Channel', false, `Usage: \`${prefix}welcomer welcome channel #channel\``, 'No valid channel provided.'));
                    data.welcome_channel = channel.id;
                    data.channelId = channel.id;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Welcome Channel', true, `Welcome channel set to <#${channel.id}>.`));
                }

                if (action === 'type') {
                    const mode = isSlash ? context.options.getString('mode') : args[2];
                    const parsed = parseBooleanMode(mode);
                    if (!parsed) return respond(context, marvelEmbed(author, 'Welcome Type', false, '`message`, `embed`, or `both`', 'Invalid mode provided.'));
                    data.welcome_message = parsed.welcome_message;
                    data.welcome_embed = parsed.welcome_embed;
                    data.type = data.welcome_embed && !data.welcome_message ? 'embed' : 'simple';
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Welcome Type', true, `Welcome type updated to \`${mode}\`.`));
                }

                if (action === 'message') {
                    const content = isSlash
                        ? cleanValue(context.options.getString('content'))
                        : getRawValueFromPrefixMessage(context, prefix, 3);
                    data.welcome_message_content = content;
                    data.content = content;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Welcome Message', true, 'Welcome message updated.'));
                }

                if (action === 'embed') {
                    const field = isSlash ? context.options.getString('field') : args[2]?.toLowerCase();
                    const value = isSlash
                        ? cleanValue(context.options.getString('value'))
                        : getRawValueFromPrefixMessage(context, prefix, 4);
                    if (!field) {
                        return respond(context, marvelEmbed(author, 'Welcome Embed', false, `Usage: \`${prefix}welcomer welcome embed <field> <value>\``, 'Missing embed field.'));
                    }

                    switch (field) {
                        case 'title':
                            data.welcome_embed_title = value;
                            data.embedData.title = value;
                            break;
                        case 'description':
                            data.welcome_embed_description = value;
                            data.embedData.description = value;
                            break;
                        case 'color':
                            data.welcome_embed_color = normalizeColor(value);
                            data.embedData.color = normalizeColor(value);
                            break;
                        case 'thumbnail':
                            data.welcome_embed_thumbnail = value;
                            data.embedData.thumbnail = value;
                            break;
                        case 'image':
                            data.welcome_embed_image = value;
                            data.embedData.image = value;
                            break;
                        case 'footer':
                            data.welcome_embed_footer = value;
                            data.embedData.footerText = value;
                            break;
                        case 'footer_icon':
                            data.welcome_embed_footer_icon = value;
                            data.embedData.footerIcon = value;
                            break;
                        case 'author':
                            data.welcome_embed_author = value;
                            data.embedData.authorName = value;
                            break;
                        case 'author_icon':
                            data.welcome_embed_author_icon = value;
                            data.embedData.authorIcon = value;
                            break;
                        case 'author_url':
                            data.welcome_embed_author_url = value;
                            break;
                        default:
                            return respond(context, marvelEmbed(author, 'Welcome Embed', false, 'Valid fields: `title`, `description`, `color`, `thumbnail`, `image`, `footer`, `footer_icon`, `author`, `author_icon`, `author_url`', 'Unknown embed field.'));
                    }

                    await data.save();
                    return respond(context, marvelEmbed(author, 'Welcome Embed', true, `Welcome embed field \`${field}\` updated.`));
                }

                if (action === 'preview') {
                    const preview = buildWelcomePreview(data, member);
                    const embeds = [];
                    const status = new EmbedBuilder()
                        .setTitle('**Welcomer Result**')
                        .setColor(0x00f53d)
                        .setDescription(
                            `**__Action : Welcome Preview__**\n` +
                            `<:Marvel_moderator:1417818626769027184> **Moderator :** \`${author.username}\`\n` +
                            `<:Marvel_Successfully:1417856966352568472> **Preview Generated**\n` +
                            `<:Marvel_arrow:1417857492238729289> ${preview.content ? 'Message content included in this embed.' : 'Embed-only preview generated.'}` +
                            (preview.content ? `\n\n**Preview Message**\n\`\`\`${preview.content.slice(0, 1000)}\`\`\`` : '')
                        )
                        .setFooter({ text: 'Marvel Development ⚡', iconURL: author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp();
                    embeds.push(status);
                    if (preview.embed) embeds.push(preview.embed);
                    return respond(context, { embeds });
                }

                if (action === 'variables') {
                    return respond(context, { embeds: [buildVariablesEmbed()] });
                }
            }

            if (section === 'autonick') {
                if (!action || action === 'settings') {
                    return respond(context, { embeds: [buildSettingsEmbed(data, guild)] });
                }

                if (action === 'toggle') {
                    data.autonick = !data.autonick;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Autonick Toggle', true, `Autonick is now \`${data.autonick ? 'enabled' : 'disabled'}\`.`));
                }

                if (action === 'format') {
                    const value = isSlash
                        ? cleanValue(context.options.getString('value'))
                        : getRawValueFromPrefixMessage(context, prefix, 3);
                    data.autonick_format = value;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Autonick Format', true, `Autonick format updated to \`${value || 'empty'}\`.`));
                }
            }

            if (section === 'greet') {
                if (!action || action === 'settings') {
                    return respond(context, { embeds: [buildSettingsEmbed(data, guild)] });
                }

                if (action === 'toggle') {
                    data.greet = !data.greet;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Greet Toggle', true, `Greet is now \`${data.greet ? 'enabled' : 'disabled'}\`.`));
                }

                if (action === 'channels') {
                    let channelIds;
                    if (isSlash) {
                        channelIds = context.options.getString('channel_ids')
                            .split(/\s+/)
                            .map(token => token.replace(/[<#>]/g, ''))
                            .filter(Boolean);
                    } else {
                        channelIds = (context.mentions.channels.map(channel => channel.id).length
                            ? context.mentions.channels.map(channel => channel.id)
                            : args.slice(2).map(token => token.replace(/[<#>]/g, '')))
                            .filter(Boolean);
                    }

                    const valid = channelIds.filter(id => guild.channels.cache.has(id));
                    if (!valid.length) return respond(context, marvelEmbed(author, 'Greet Channels', false, 'Provide at least one valid text channel.', 'No valid channels provided.'));
                    data.greet_channels = valid;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Greet Channels', true, `Greet channels updated: ${valid.map(id => `<#${id}>`).join(', ')}`));
                }

                if (action === 'message') {
                    const value = isSlash
                        ? cleanValue(context.options.getString('content'))
                        : getRawValueFromPrefixMessage(context, prefix, 3);
                    data.greet_message = value;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Greet Message', true, 'Greet message updated.'));
                }

                if (action === 'deleteafter') {
                    const seconds = isSlash ? context.options.getInteger('seconds') : Number(args[2]);
                    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 60) {
                        return respond(context, marvelEmbed(author, 'Greet Delete After', false, '`0` to `60` seconds', 'Delete-after must be between 0 and 60 seconds.'));
                    }
                    data.greet_delete_after = seconds;
                    await data.save();
                    return respond(context, marvelEmbed(author, 'Greet Delete After', true, `Greet delete-after set to \`${seconds}s\`.`));
                }
            }

            return respond(context, { embeds: [helpEmbed(prefix)] });
        } catch (error) {
            logger.error(`Welcomer Command Error: ${error.stack || error.message}`);
            return respond(context, marvelEmbed(author, 'Welcomer', false, 'Configuration update failed.', 'Internal error.'));
        }
    }
};
