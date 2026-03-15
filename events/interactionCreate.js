const { isBlacklisted } = require('../database/blacklist');
const { handleInteractionRate } = require('../utils/ratelimit');

module.exports = async (client, interaction) => {
  if (!interaction?.guildId) return true;
  if (await isBlacklisted('guild', interaction.guildId)) return true;
  if (await isBlacklisted('user', interaction.user?.id)) return true;
  if (await handleInteractionRate(interaction)) return true;
  return false;
};
