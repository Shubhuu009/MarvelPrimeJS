const stamp = () => new Date().toISOString();

const log = (level, ...args) => {
  // eslint-disable-next-line no-console
  console[level](`[${stamp()}]`, ...args);
};

module.exports = {
  info: (...args) => log('log', '[INFO]', ...args),
  warn: (...args) => log('warn', '[WARN]', ...args),
  error: (...args) => log('error', '[ERROR]', ...args),
};
