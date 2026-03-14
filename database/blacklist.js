const mongoose = require('mongoose');

const BlacklistSchema = new mongoose.Schema({
  type: { type: String, enum: ['user', 'guild'], index: true },
  targetId: { type: String, index: true },
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  meta: { type: Object, default: {} },
}, { timestamps: true });

BlacklistSchema.index({ type: 1, targetId: 1 }, { unique: true });

const BlacklistModel = mongoose.models.Blacklist || mongoose.model('Blacklist', BlacklistSchema);

const isBlacklisted = async (type, targetId) => {
  const doc = await BlacklistModel.findOne({ type, targetId }).lean();
  return Boolean(doc);
};

const blacklist = async (type, targetId, reason, meta = {}) => {
  return BlacklistModel.findOneAndUpdate(
    { type, targetId },
    { $set: { reason, meta } },
    { upsert: true, new: true }
  );
};

const unblacklist = async (type, targetId) => {
  return BlacklistModel.deleteOne({ type, targetId });
};

module.exports = {
  BlacklistModel,
  isBlacklisted,
  blacklist,
  unblacklist,
};
