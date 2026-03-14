const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    winnersCount: { type: Number, default: 1 },
    endsAt: { type: Date, required: true },
    participants: { type: [String], default: [] }, // Array of User IDs
    guaranteedWinners: { type: [String], default: [] }, // Specific to this guild
    ended: { type: Boolean, default: false }
});

module.exports = mongoose.model('Giveaway', giveawaySchema);