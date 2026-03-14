const config = require('../config/ratelimits');
const { blacklist } = require('../database/blacklist');

const now = () => Date.now();

const makeBucket = (limit, windowMs) => ({
  limit,
  windowMs,
  count: 0,
  start: now(),
});

const touch = (bucket) => {
  const time = now();
  if (time - bucket.start >= bucket.windowMs) {
    bucket.start = time;
    bucket.count = 0;
  }
  bucket.count += 1;
  return bucket.count > bucket.limit;
};

const maps = {
  userMsg: new Map(),
  guildMsg: new Map(),
  userCmd: new Map(),
  guildCmd: new Map(),
  userInteraction: new Map(),
  userStrikes: new Map(),
  guildStrikes: new Map(),
};

const addStrike = async (type, id, reason, meta) => {
  const strikeMap = type === 'guild' ? maps.guildStrikes : maps.userStrikes;
  const limit = type === 'guild' ? config.autoBlacklistGuildStrikes : config.autoBlacklistUserStrikes;
  const current = (strikeMap.get(id) || 0) + 1;
  strikeMap.set(id, current);
  if (current >= limit) {
    await blacklist(type, id, reason, meta);
  }
};

const checkRate = async ({ type, id, limit, windowMs, bucketMap, strikeType, reason, meta }) => {
  const key = String(id);
  let bucket = bucketMap.get(key);
  if (!bucket) {
    bucket = makeBucket(limit, windowMs);
    bucketMap.set(key, bucket);
  }
  const blocked = touch(bucket);
  if (blocked) {
    await addStrike(strikeType, key, reason, meta);
  }
  return blocked;
};

const isCommandMessage = (content) => content?.startsWith(config.prefix);

const handleMessageRate = async (message) => {
  const { guild, author, content } = message;
  const meta = { channelId: message.channel?.id };

  const guildBlocked = await checkRate({
    type: 'guildMsg',
    id: guild.id,
    limit: config.guildMessageLimit,
    windowMs: config.guildMessageWindowMs,
    bucketMap: maps.guildMsg,
    strikeType: 'guild',
    reason: 'Auto-blacklisted due to message spam',
    meta,
  });
  if (guildBlocked) return true;

  const userBlocked = await checkRate({
    type: 'userMsg',
    id: author.id,
    limit: config.userMessageLimit,
    windowMs: config.userMessageWindowMs,
    bucketMap: maps.userMsg,
    strikeType: 'user',
    reason: 'Auto-blacklisted due to message spam',
    meta,
  });
  if (userBlocked) return true;

  if (isCommandMessage(content)) {
    const guildCmdBlocked = await checkRate({
      type: 'guildCmd',
      id: guild.id,
      limit: config.guildCommandLimit,
      windowMs: config.guildCommandWindowMs,
      bucketMap: maps.guildCmd,
      strikeType: 'guild',
      reason: 'Auto-blacklisted due to command spam',
      meta,
    });
    if (guildCmdBlocked) return true;

    const userCmdBlocked = await checkRate({
      type: 'userCmd',
      id: author.id,
      limit: config.userCommandLimit,
      windowMs: config.userCommandWindowMs,
      bucketMap: maps.userCmd,
      strikeType: 'user',
      reason: 'Auto-blacklisted due to command spam',
      meta,
    });
    if (userCmdBlocked) return true;
  }

  return false;
};

const handleInteractionRate = async (interaction) => {
  const { guildId, user } = interaction;
  if (!guildId || !user) return false;
  const blocked = await checkRate({
    type: 'userInteraction',
    id: user.id,
    limit: config.userInteractionLimit,
    windowMs: config.userInteractionWindowMs,
    bucketMap: maps.userInteraction,
    strikeType: 'user',
    reason: 'Auto-blacklisted due to interaction spam',
    meta: { guildId },
  });
  return blocked;
};

module.exports = {
  handleMessageRate,
  handleInteractionRate,
  isCommandMessage,
};
