const mongoose = require('mongoose');

const GuildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  antinuke: {
    enabled: { type: Boolean, default: false },
    punishment: { type: String, default: 'ban' },
    whitelist: { type: [String], default: [] },
    extraOwners: { type: [String], default: [] },
    panicmode: {
      enabled: { type: Boolean, default: false },
    },
    nightmode: {
      enabled: { type: Boolean, default: false },
      roles: { type: Array, default: [] },
    },
    mainrole: { type: [String], default: [] },
  },
}, { timestamps: true });

const GuildSettingsModel = mongoose.models.GuildSettings || mongoose.model('GuildSettings', GuildSettingsSchema);

const getGuildSettings = async (client, guildId) => {
  let doc = await GuildSettingsModel.findOne({ guildId });
  if (!doc) doc = await GuildSettingsModel.create({ guildId });
  return doc;
};

const updateGuildSettings = async (client, guildId, update) => {
  return GuildSettingsModel.findOneAndUpdate(
    { guildId },
    update,
    { upsert: true, new: true }
  );
};

const hasPermission = (member, permission) => {
  if (!member) return false;
  return member.permissions.has(permission);
};

module.exports = {
  GuildSettingsModel,
  getGuildSettings,
  updateGuildSettings,
  hasPermission,
};
