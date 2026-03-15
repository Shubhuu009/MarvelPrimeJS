const mongoose = require('mongoose');

const NoPrefixSchema = new mongoose.Schema({
  userId: { type: String, index: true, unique: true },
  addedBy: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const NoPrefixModel = mongoose.models.NoPrefix || mongoose.model('NoPrefix', NoPrefixSchema);

module.exports = NoPrefixModel;
