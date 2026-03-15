const mongoose = require('mongoose');

const QuarantineSettingsSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  enabled: { type: Boolean, default: true },
  roleId: { type: String, default: '' },
  channelId: { type: String, default: '' },
}, { timestamps: true });

const QuarantineEntrySchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  moderatorId: { type: String, default: '' },
  reason: { type: String, default: '' },
  roles: { type: [String], default: [] },
  active: { type: Boolean, default: true, index: true },
  quarantinedAt: { type: Date, default: Date.now },
  releasedAt: { type: Date, default: null },
  releasedBy: { type: String, default: '' },
  releaseReason: { type: String, default: '' },
}, { timestamps: true });

QuarantineEntrySchema.index({ guildId: 1, userId: 1, active: 1 });

const QuarantineSettingsModel = mongoose.models.QuarantineSettings || mongoose.model('QuarantineSettings', QuarantineSettingsSchema);
const QuarantineEntryModel = mongoose.models.QuarantineEntry || mongoose.model('QuarantineEntry', QuarantineEntrySchema);

const getOrCreateSettings = async (guildId) => {
  let doc = await QuarantineSettingsModel.findOne({ guildId });
  if (!doc) doc = await QuarantineSettingsModel.create({ guildId });
  return doc;
};

const getActiveQuarantine = async (guildId, userId) => (
  QuarantineEntryModel.findOne({ guildId, userId, active: true })
);

const listActiveQuarantines = async (guildId) => (
  QuarantineEntryModel.find({ guildId, active: true })
);

module.exports = {
  QuarantineSettingsModel,
  QuarantineEntryModel,
  getOrCreateSettings,
  getActiveQuarantine,
  listActiveQuarantines,
};
