const { isBlacklisted } = require('../database/blacklist');
const { handleInteractionRate } = require('../utils/ratelimit');

module.exports = async (client, interaction) => {
  if (!interaction?.guildId) return;
  if (await isBlacklisted('guild', interaction.guildId)) return;
  if (await isBlacklisted('user', interaction.user?.id)) return;
  await handleInteractionRate(interaction);
};
