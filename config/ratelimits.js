const asInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  prefix: process.env.PREFIX || process.env.BOT_PREFIX || '.',
  userMessageLimit: asInt(process.env.RL_USER_MSG_LIMIT, 20),
  userMessageWindowMs: asInt(process.env.RL_USER_MSG_WINDOW_MS, 10000),
  guildMessageLimit: asInt(process.env.RL_GUILD_MSG_LIMIT, 300),
  guildMessageWindowMs: asInt(process.env.RL_GUILD_MSG_WINDOW_MS, 10000),
  userCommandLimit: asInt(process.env.RL_USER_CMD_LIMIT, 8),
  userCommandWindowMs: asInt(process.env.RL_USER_CMD_WINDOW_MS, 10000),
  guildCommandLimit: asInt(process.env.RL_GUILD_CMD_LIMIT, 120),
  guildCommandWindowMs: asInt(process.env.RL_GUILD_CMD_WINDOW_MS, 10000),
  userInteractionLimit: asInt(process.env.RL_USER_INTERACTION_LIMIT, 10),
  userInteractionWindowMs: asInt(process.env.RL_USER_INTERACTION_WINDOW_MS, 10000),
  autoBlacklistUserStrikes: asInt(process.env.RL_USER_STRIKES, 3),
  autoBlacklistGuildStrikes: asInt(process.env.RL_GUILD_STRIKES, 3),
};
