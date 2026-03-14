const mongoose = require('mongoose');

const WelcomerSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  welcome: { type: Boolean, default: false },
  welcome_channel: { type: String, default: '' },
  welcome_message: { type: Boolean, default: false },
  welcome_message_content: { type: String, default: '' },
  welcome_embed: { type: Boolean, default: false },
  welcome_embed_title: { type: String, default: '' },
  welcome_embed_description: { type: String, default: '' },
  welcome_embed_thumbnail: { type: String, default: '' },
  welcome_embed_image: { type: String, default: '' },
  welcome_embed_footer: { type: String, default: '' },
  welcome_embed_footer_icon: { type: String, default: '' },
  welcome_embed_color: { type: String, default: '' },
  welcome_embed_author: { type: String, default: '' },
  welcome_embed_author_icon: { type: String, default: '' },
  welcome_embed_author_url: { type: String, default: '' },
  autorole: { type: Boolean, default: false },
  autoroles_limit: { type: Number, default: 0 },
  autoroles: { type: [String], default: [] },
  autonick: { type: Boolean, default: false },
  autonick_format: { type: String, default: '' },
  greet: { type: Boolean, default: false },
  greet_channels: { type: [String], default: [] },
  greet_delete_after: { type: Number, default: 0 },
  greet_message: { type: String, default: '' },
}, { timestamps: true });

const WelcomerModel = mongoose.models.WelcomerSettings || mongoose.model('WelcomerSettings', WelcomerSchema);

const getOrCreate = async (guildId) => {
  let doc = await WelcomerModel.findOne({ guildId });
  if (!doc) doc = await WelcomerModel.create({ guildId });
  return doc;
};

module.exports = {
  WelcomerModel,
  getOrCreate,
};
