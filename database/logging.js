const mongoose = require('mongoose');

const HookSchema = new mongoose.Schema({
  id: { type: String, default: '' },
  token: { type: String, default: '' },
  channelId: { type: String, default: '' },
}, { _id: false });

const LoggingSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  enabled: { type: Boolean, default: true },
  categoryId: { type: String, default: '' },
  channels: { type: Object, default: {} },
  webhooks: {
    type: Object,
    default: {},
  },
  webhookName: { type: String, default: '' },
  webhookAvatar: { type: String, default: '' },
}, { timestamps: true });

const LoggingModel = mongoose.models.LoggingSettings || mongoose.model('LoggingSettings', LoggingSchema);

const getOrCreateSettings = async (guildId) => {
  let doc = await LoggingModel.findOne({ guildId });
  if (!doc) doc = await LoggingModel.create({ guildId });
  return doc;
};

module.exports = {
  HookSchema,
  LoggingModel,
  getOrCreateSettings,
};
