const mongoose = require('mongoose');

const AutoReactSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  trigger: { type: String, index: true },
  emoji: { type: String, required: true },
  matchType: { type: String, default: 'contains' },
  caseSensitive: { type: Boolean, default: false },
}, { timestamps: true });

AutoReactSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

const AutoReactModel = mongoose.models.AutoReact || mongoose.model('AutoReact', AutoReactSchema);

const listReacts = (guildId) => AutoReactModel.find({ guildId }).lean();
const getReact = (guildId, trigger) => AutoReactModel.findOne({ guildId, trigger });
const upsertReact = (guildId, trigger, emoji, matchType = 'contains', caseSensitive = false) => (
  AutoReactModel.findOneAndUpdate(
    { guildId, trigger },
    { $set: { emoji, matchType, caseSensitive } },
    { upsert: true, new: true }
  )
);
const deleteReact = (guildId, trigger) => AutoReactModel.deleteOne({ guildId, trigger });

module.exports = {
  AutoReactModel,
  listReacts,
  getReact,
  upsertReact,
  deleteReact,
};
