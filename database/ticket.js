const mongoose = require('mongoose');

const TicketSettingsSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  enabled: { type: Boolean, default: true },
  supportRoles: { type: [String], default: [] },
  ticketLimit: { type: Number, default: 1 },
  openCategoryId: { type: String, default: '' },
  closedCategoryId: { type: String, default: '' },
  panelChannelId: { type: String, default: '' },
  panelMessageId: { type: String, default: '' },
  autoResponseMessage: { type: String, default: '' },
}, { timestamps: true });

const TicketLogSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  logsChannelId: { type: String, default: '' },
}, { timestamps: true });

const TicketSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  ticketId: { type: Number, index: true },
  channelId: { type: String, index: true },
  ownerId: { type: String, index: true },
  participants: { type: [String], default: [] },
  closed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

TicketSchema.index({ guildId: 1, ticketId: 1 }, { unique: true });

const TicketSettingsModel = mongoose.models.TicketSettings || mongoose.model('TicketSettings', TicketSettingsSchema);
const TicketLogModel = mongoose.models.TicketLog || mongoose.model('TicketLog', TicketLogSchema);
const TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

const getOrCreateSettings = async (guildId) => {
  let doc = await TicketSettingsModel.findOne({ guildId });
  if (!doc) doc = await TicketSettingsModel.create({ guildId });
  return doc;
};

const getOrCreateLogs = async (guildId) => {
  let doc = await TicketLogModel.findOne({ guildId });
  if (!doc) doc = await TicketLogModel.create({ guildId });
  return doc;
};

const nextTicketId = async (guildId) => {
  const last = await TicketModel.findOne({ guildId }).sort({ ticketId: -1 }).lean();
  return last ? last.ticketId + 1 : 1;
};

module.exports = {
  TicketSettingsModel,
  TicketLogModel,
  TicketModel,
  getOrCreateSettings,
  getOrCreateLogs,
  nextTicketId,
};
