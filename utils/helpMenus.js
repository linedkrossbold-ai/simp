const DEFAULT_PREFIX = '~';

function getPrefix(message) {
  return message?.client?.prefix || process.env.PREFIX || DEFAULT_PREFIX;
}

async function replyToTarget(target, payload) {
  if (!target || typeof target.reply !== 'function') {
    throw new Error('Unsupported reply target.');
  }

  return target.reply(payload);
}

function dedupeCommands(commands) {
  const seen = new Set();
  return commands.filter((command) => {
    if (!command || !command.name || seen.has(command.name)) {
      return false;
    }
    seen.add(command.name);
    return true;
  });
}

function formatCommand(prefix, command) {
  const usage = command.usage ? `\nUsage: ${command.usage.replaceAll('!', prefix)}` : '';
  return `\`${prefix}${command.name}\` - ${command.description || 'No description provided.'}${usage}`;
}

function getCommandDetails(command, prefix = '~') {
  const normalizedPrefix = prefix || '~';
  const usage = command?.usage ? command.usage.replaceAll('!', normalizedPrefix) : `${normalizedPrefix}${command?.name || 'command'}`;
  const requirements = [];

  if (command?.ownerOnly) {
    requirements.push('Owner-only');
  }

  if (command?.requiredPermissions?.length) {
    requirements.push(`Requires: ${command.requiredPermissions.join(', ')}`);
  }

  return {
    name: command?.name || 'unknown',
    description: command?.description || 'No description provided.',
    usage,
    aliases: Array.isArray(command?.aliases) ? command.aliases : [],
    requirements
  };
}

function buildCommandList(commands, prefix) {
  const normalized = dedupeCommands(commands);
  if (!normalized.length) {
    return 'No commands found.';
  }

  return normalized.map((command) => formatCommand(prefix, command)).join('\n');
}

function chunkCommandList(commands, prefix, maxLength = 950) {
  const normalized = dedupeCommands(commands);
  if (!normalized.length) {
    return ['No commands found.'];
  }

  const chunks = [];
  let currentChunk = '';

  for (const command of normalized) {
    const line = formatCommand(prefix, command);
    const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;

    if (currentChunk && nextChunk.length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function getCommandsByNames(client, names) {
  if (!client?.commands) return [];
  return names.map((name) => client.commands.get(name)).filter(Boolean);
}

function getOwnerCommands(client) {
  if (!client?.commands) return [];
  return dedupeCommands([...client.commands.values()].filter((command) => command.ownerOnly));
}

const ADMIN_COMMAND_NAMES = [
  'admin', 'antinuke', 'backup', 'ban', 'banall', 'bot', 'copy', 'give', 'givebounty', 'givecontainers', 'kick', 'lockdown', 'paste', 'purge', 'restore',
  'setnick', 'setprefix', 'softban', 'timeout', 'mute', 'unban', 'unmute', 'warn', 'warnings', 'noprefix'
];

const KINGFLEX_MODERATION_EXCLUSIONS = new Set([
  'ban', 'kick', 'mute', 'purge', 'softban', 'timeout', 'setnick', 'warn', 'warnings', 'unmute'
]);

const CMDHELP_HIDDEN_COMMANDS = new Set([
  'snapshot', 'serverlist', 'reset', 'restore', 'revokeaccess', 'paste', 'nuke', 'mikuset', 'leaveserver',
  'massban', 'lockdown', 'lockchannel', 'grantaccess', 'givecontainers', 'givecoin', 'copy', 'banall',
  'backup', 'antinuke', 'adminusage'
]);

const SERVER_MANAGING_COMMANDS = new Set([
  'absolve', 'hazard', 'lockchannel', 'lockdown', 'mikuset', 'mute', 'role', 'unmute', 'nuke', 'reset',
  'copy', 'restore', 'backup', 'paste', 'ticket'
]);

function isCmdhelpVisibleCommand(command) {
  return Boolean(command?.name) && !CMDHELP_HIDDEN_COMMANDS.has(command.name);
}

function getHelpCategory(command, fallback = 'General') {
  if (SERVER_MANAGING_COMMANDS.has(command?.name)) {
    return 'Server Managing';
  }

  return command?.category || fallback;
}

function isKingflexCommand(command) {
  return Boolean(command?.ownerOnly) && !KINGFLEX_MODERATION_EXCLUSIONS.has(command.name);
}

function getAdminCommands(client) {
  if (!client?.commands) return [];
  return dedupeCommands([...client.commands.values()].filter((command) => ADMIN_COMMAND_NAMES.includes(command.name)));
}

function getNonAdminOwnerCommands(client) {
  if (!client?.commands) return [];
  return dedupeCommands([...client.commands.values()].filter((command) => isKingflexCommand(command) && !ADMIN_COMMAND_NAMES.includes(command.name)));
}

module.exports = {
  getPrefix,
  replyToTarget,
  buildCommandList,
  chunkCommandList,
  getCommandDetails,
  getCommandsByNames,
  getOwnerCommands,
  getAdminCommands,
  getNonAdminOwnerCommands,
  isKingflexCommand,
  isCmdhelpVisibleCommand,
  getHelpCategory,
  dedupeCommands
};
