const mongoose = require('mongoose');

const AutoResponseSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  trigger: { type: String, index: true },
  response: { type: String, default: '' },
}, { timestamps: true });

AutoResponseSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

const AutoResponseModel = mongoose.models.AutoResponse || mongoose.model('AutoResponse', AutoResponseSchema);

const listResponses = (guildId) => AutoResponseModel.find({ guildId }).lean();
const getResponse = (guildId, trigger) => AutoResponseModel.findOne({ guildId, trigger });
const upsertResponse = (guildId, trigger, response) => (
  AutoResponseModel.findOneAndUpdate(
    { guildId, trigger },
    { $set: { response } },
    { upsert: true, new: true }
  )
);
const deleteResponse = (guildId, trigger) => AutoResponseModel.deleteOne({ guildId, trigger });

module.exports = {
  AutoResponseModel,
  listResponses,
  getResponse,
  upsertResponse,
  deleteResponse,
};
