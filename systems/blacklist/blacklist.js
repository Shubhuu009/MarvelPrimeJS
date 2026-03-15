const { BlacklistModel } = require('../../database/blacklist');

const mapUser = (doc) => ({
  userId: doc.targetId,
  reason: doc.reason || 'No reason provided',
  bannedBy: doc.meta?.bannedBy || doc.meta?.moderatorId || 'Unknown',
  autoBlocked: Boolean(doc.meta?.autoBlocked),
  spamCount: doc.meta?.spamCount || 0,
  createdAt: doc.createdAt || doc.updatedAt,
});

const mapGuild = (doc) => ({
  guildId: doc.targetId,
  guildName: doc.meta?.guildName || 'Unknown',
  reason: doc.reason || 'No reason provided',
  bannedBy: doc.meta?.bannedBy || doc.meta?.moderatorId || 'Unknown',
  autoBlocked: Boolean(doc.meta?.autoBlocked),
  spamCount: doc.meta?.spamCount || 0,
  createdAt: doc.createdAt || doc.updatedAt,
});

class BlacklistManager {
  static userSet = new Set();

  static guildSet = new Set();

  static userCount = 0;

  static guildCount = 0;

  static initialized = false;

  static async init() {
    const all = await BlacklistModel.find().lean();
    this.userSet = new Set(all.filter((d) => d.type === 'user').map((d) => d.targetId));
    this.guildSet = new Set(all.filter((d) => d.type === 'guild').map((d) => d.targetId));
    this.userCount = this.userSet.size;
    this.guildCount = this.guildSet.size;
    this.initialized = true;
  }

  static isUserBlocked(userId) {
    return this.userSet.has(userId);
  }

  static isGuildBlocked(guildId) {
    return this.guildSet.has(guildId);
  }

  static async refreshCounts() {
    this.userCount = await BlacklistModel.countDocuments({ type: 'user' });
    this.guildCount = await BlacklistModel.countDocuments({ type: 'guild' });
  }

  static async blockUser(userId, bannedBy, reason, autoBlocked = false, spamCount = 0) {
    await BlacklistModel.findOneAndUpdate(
      { type: 'user', targetId: userId },
      {
        $set: {
          reason,
          meta: {
            bannedBy,
            autoBlocked,
            spamCount,
          },
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
    this.userSet.add(userId);
    await this.refreshCounts();
  }

  static async unblockUser(userId) {
    await BlacklistModel.deleteOne({ type: 'user', targetId: userId });
    this.userSet.delete(userId);
    await this.refreshCounts();
  }

  static async blockGuild(guildId, guildName, bannedBy, reason, autoBlocked = false, spamCount = 0) {
    await BlacklistModel.findOneAndUpdate(
      { type: 'guild', targetId: guildId },
      {
        $set: {
          reason,
          meta: {
            guildName,
            bannedBy,
            autoBlocked,
            spamCount,
          },
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
    this.guildSet.add(guildId);
    await this.refreshCounts();
  }

  static async unblockGuild(guildId) {
    await BlacklistModel.deleteOne({ type: 'guild', targetId: guildId });
    this.guildSet.delete(guildId);
    await this.refreshCounts();
  }

  static async listUsers(limit = 20) {
    const docs = await BlacklistModel.find({ type: 'user' }).sort({ createdAt: -1 }).limit(limit).lean();
    await this.refreshCounts();
    return docs.map(mapUser);
  }

  static async listGuilds(limit = 20) {
    const docs = await BlacklistModel.find({ type: 'guild' }).sort({ createdAt: -1 }).limit(limit).lean();
    await this.refreshCounts();
    return docs.map(mapGuild);
  }

  static async getUserInfo(userId) {
    const doc = await BlacklistModel.findOne({ type: 'user', targetId: userId }).lean();
    if (!doc) return null;
    return mapUser(doc);
  }

  static async getGuildInfo(guildId) {
    const doc = await BlacklistModel.findOne({ type: 'guild', targetId: guildId }).lean();
    if (!doc) return null;
    return mapGuild(doc);
  }
}

module.exports = BlacklistManager;
