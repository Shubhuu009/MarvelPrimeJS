const mongoose = require('mongoose');

const AutomodSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  antilink_enabled: { type: Boolean, default: false },
  antispam_enabled: { type: Boolean, default: false },
  antibadwords_enabled: { type: Boolean, default: false },
  antilink_rule_id: { type: String, default: '' },
  antispam_rule_id: { type: String, default: '' },
  antibadwords_rule_id: { type: String, default: '' },
  antilink_whitelist_roles: { type: [String], default: [] },
  antilink_whitelist_channels: { type: [String], default: [] },
  antibadwords_whitelist_roles: { type: [String], default: [] },
  antibadwords_whitelist_channels: { type: [String], default: [] },
  antibadwords_words: { type: [String], default: [] },
  antispam_whitelist_roles: { type: [String], default: [] },
  antispam_whitelist_channels: { type: [String], default: [] },
  antispam_max_messages: { type: Number, default: 5 },
  antispam_max_interval: { type: Number, default: 30 },
  antispam_max_mentions: { type: Number, default: 5 },
  antispam_max_emojis: { type: Number, default: 10 },
  antispam_max_caps: { type: Number, default: 50 },
  antispam_punishment: { type: String, default: 'mute' },
  antispam_punishment_duration: { type: Number, default: 10 },
}, { timestamps: true });

const AutomodModel = mongoose.models.AutomodSettings || mongoose.model('AutomodSettings', AutomodSchema);

const getOrCreate = async (guildId) => {
  let doc = await AutomodModel.findOne({ guildId });
  if (!doc) doc = await AutomodModel.create({ guildId });
  return doc;
};

module.exports = {
  AutomodModel,
  getOrCreate,
};
