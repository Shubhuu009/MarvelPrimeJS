require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const mongoose = require('mongoose');
const { loadCommands, handleMessageCommand, handleInteractionCommand } = require('./utils/commandHandler');
const onMessageCreate = require('./events/messageCreate');
const onInteractionCreate = require('./events/interactionCreate');
const NoPrefix = require('./database/schemas/NoPrefix');
const BlacklistManager = require('./systems/blacklist/blacklist');
const { handleVoicePanelInteraction } = require('./systems/voice/panel');

const token = process.env.TOKEN;
if (!token) {
  // eslint-disable-next-line no-console
  console.error('Missing TOKEN in environment.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();
client.slashCommands = [];
client.noPrefixUsers = new Set();

const registerSlashCommands = async () => {
  if (String(process.env.REGISTER_SLASH || '').toLowerCase() !== 'true') return;
  const data = client.slashCommands.map((c) => (c.toJSON ? c.toJSON() : c));
  if (!data.length) return;

  const guildId = process.env.GUILD_ID;
  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(data);
    // eslint-disable-next-line no-console
    console.log(`Registered ${data.length} guild slash commands for ${guildId}.`);
  } else {
    await client.application.commands.set(data);
    // eslint-disable-next-line no-console
    console.log(`Registered ${data.length} global slash commands.`);
  }
};

const start = async () => {
  loadCommands(client);

  if (process.env.MONGO_URI) {
    mongoose.set('strictQuery', true);
    try {
      await mongoose.connect(process.env.MONGO_URI);
      // eslint-disable-next-line no-console
      console.log('MongoDB connected.');

      try {
        const list = await NoPrefix.find().lean();
        list.forEach((entry) => client.noPrefixUsers.add(entry.userId));
        // eslint-disable-next-line no-console
        console.log(`Loaded ${list.length} no-prefix users.`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load no-prefix users:', err);
      }

      try {
        await BlacklistManager.init();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize blacklist manager:', err);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MongoDB connection error:', err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('MONGO_URI not set. Database features will not work.');
  }

  client.on('messageCreate', async (message) => {
    const blocked = await onMessageCreate(client, message);
    if (blocked) return;
    await handleMessageCommand(client, message);
  });

  client.on('interactionCreate', async (interaction) => {
    const blocked = await onInteractionCreate(client, interaction);
    if (blocked) return;
    const handled = await handleVoicePanelInteraction(client, interaction);
    if (handled) return;
    await handleInteractionCommand(client, interaction);
  });

  client.once('ready', async () => {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user.tag}`);
    await registerSlashCommands().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to register slash commands:', err);
    });
  });

  await client.login(token);
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Startup error:', err);
  process.exit(1);
});
