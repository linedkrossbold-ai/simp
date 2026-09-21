function isBotCommandAllowedWhileDisabled(command) {
  if (!command || typeof command !== 'object') {
    return false;
  }

  const commandName = String(command.name || '').toLowerCase();
  if (commandName === 'bot') {
    return true;
  }

  const aliases = Array.isArray(command.aliases) ? command.aliases.map((alias) => String(alias || '').toLowerCase()) : [];
  return aliases.includes('bot') || aliases.includes('botstatus') || aliases.includes('botcontrol') || aliases.includes('botstop');
}

function isCoinEconomyEnabled(configValue) {
  return String(configValue ?? 'true').trim() !== 'false';
}

function isCoinCommandAllowedWhileDisabled(command) {
  if (!command || typeof command !== 'object') {
    return true;
  }

  const commandNames = [String(command.name || '').toLowerCase()];
  if (Array.isArray(command.aliases)) {
    commandNames.push(...command.aliases.map((alias) => String(alias || '').toLowerCase()));
  }

  const allowedAlways = new Set(['bot', 'coin', 'command', 'help', 'cmdhelp', 'adminusage']);
  if (commandNames.some((name) => allowedAlways.has(name))) {
    return true;
  }

  const blockedEconomyCommands = new Set([
    'daily', 'dailystreak', 'dailybonus', 'streak', 'passive',
    'coin', 'coins', 'coinhelp', 'coinleaderboard', 'coinflip', 'paycoin', 'paycoins', 'pay',
    'roulette', 'shop', 'usecoin', 'opencrate', 'sail', 'fish', 'openbait'
  ]);

  return !commandNames.some((name) => blockedEconomyCommands.has(name));
}

module.exports = {
  isBotCommandAllowedWhileDisabled,
  isCoinEconomyEnabled,
  isCoinCommandAllowedWhileDisabled
};
