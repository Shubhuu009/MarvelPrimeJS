const mongoose = require('mongoose');

const VoiceOwnerSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: { type: String, index: true },
  ownerId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

VoiceOwnerSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

const VoiceOwnerModel = mongoose.models.VoiceOwner || mongoose.model('VoiceOwner', VoiceOwnerSchema);

const getOwner = (guildId, channelId) => VoiceOwnerModel.findOne({ guildId, channelId });
const setOwner = (guildId, channelId, ownerId) => (
  VoiceOwnerModel.findOneAndUpdate(
    { guildId, channelId },
    { $set: { ownerId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true }
  )
);
const clearOwner = (guildId, channelId) => VoiceOwnerModel.deleteOne({ guildId, channelId });

module.exports = {
  VoiceOwnerModel,
  getOwner,
  setOwner,
  clearOwner,
};
