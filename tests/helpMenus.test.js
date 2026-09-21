const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { getCommandDetails, getAdminCommands, isKingflexCommand, isCmdhelpVisibleCommand, getHelpCategory } = require('../utils/helpMenus');
const { getProtectedGuildIds, validateBotSafetyConfig } = require('../utils/safety');
const { isBotCommandAllowedWhileDisabled, isCoinEconomyEnabled, isCoinCommandAllowedWhileDisabled } = require('../utils/commandAccess');
const { isTrueOwner, getTrueOwnerId, isTrustedUser, getTrustedUserIds } = require('../utils/owner');
const banCommand = require('../commands/admin only/ban');
const kickCommand = require('../commands/admin only/kick');
const banallCommand = require('../commands/admin only/banall');
const grantAccessCommand = require('../commands/admin only/grantaccess');
const revokeAccessCommand = require('../commands/admin only/revokeaccess');
const { deleteMessagesInBatches, sendResponse } = require('../commands/admin only/purge');
const { deleteAllMessages } = require('../commands/admin only/nuke');
const balanceCommand = require('../commands/onepiece fun/coins');
const coinToggleCommand = require('../commands/admin only/coin');

test('getCommandDetails surfaces usage and requirements for a command', () => {
  const details = getCommandDetails({
    name: 'ban',
    description: 'Ban a member',
    usage: '~ban @user',
    ownerOnly: true,
    aliases: ['b']
  }, '~');

  assert.equal(details.name, 'ban');
  assert.equal(details.usage, '~ban @user');
  assert.ok(details.requirements.includes('Owner-only'));
  assert.ok(details.aliases.includes('b'));
});

test('getAdminCommands includes banall', () => {
  const client = {
    commands: new Map([
      ['banall', { name: 'banall', ownerOnly: true }],
      ['ping', { name: 'ping' }]
    ])
  };

  assert.deepEqual(getAdminCommands(client).map((command) => command.name), ['banall']);
});

test('KingFlex excludes standard moderation commands', () => {
  const excluded = ['ban', 'kick', 'mute', 'purge', 'softban', 'timeout', 'setnick', 'warn', 'warnings', 'unmute'];
  for (const name of excluded) {
    assert.equal(isKingflexCommand({ name, ownerOnly: true }), false);
  }
  assert.equal(isKingflexCommand({ name: 'banall', ownerOnly: true }), true);
});

test('cmdhelp hides power and owner-management commands', () => {
  const hidden = ['snapshot', 'serverlist', 'reset', 'restore', 'revokeaccess', 'paste', 'nuke', 'mikuset', 'leaveserver', 'massban', 'lockdown', 'lockchannel', 'grantaccess', 'givecontainers', 'givecoin', 'copy', 'banall', 'backup', 'antinuke', 'adminusage'];
  for (const name of hidden) {
    assert.equal(isCmdhelpVisibleCommand({ name }), false);
  }
  assert.equal(isCmdhelpVisibleCommand({ name: 'ping' }), true);
});

test('mikuset uses the current Discord role color option', () => {
  const mikusetSource = require('fs').readFileSync(require('path').join(__dirname, '..', 'commands', 'admin only', 'mikuset.js'), 'utf8');
  assert.equal(mikusetSource.includes('color:'), false);
  assert.equal(mikusetSource.includes('primaryColor:'), true);
});

test('server management commands use the Server Managing module', () => {
  assert.equal(getHelpCategory({ name: 'role', category: 'Moderation' }), 'Server Managing');
  assert.equal(getHelpCategory({ name: 'lockchannel', category: 'Moderation' }), 'Server Managing');
  assert.equal(getHelpCategory({ name: 'ticket', category: 'General' }), 'Server Managing');
  assert.equal(getHelpCategory({ name: 'ping', category: 'General' }), 'General');
});

test('moderation commands declare their own required permission bits', () => {
  assert.deepEqual(banCommand.requiredPermissions, [PermissionFlagsBits.BanMembers]);
  assert.deepEqual(kickCommand.requiredPermissions, [PermissionFlagsBits.KickMembers]);
  assert.deepEqual(banallCommand.requiredPermissions, [PermissionFlagsBits.BanMembers]);
  assert.deepEqual(grantAccessCommand.requiredPermissions, [PermissionFlagsBits.ManageGuild]);
  assert.deepEqual(revokeAccessCommand.requiredPermissions, [PermissionFlagsBits.ManageGuild]);
});

test('protected guild config and safety validation are enforced', () => {
  assert.deepEqual(getProtectedGuildIds({ PROTECTED_GUILD_ID: '123456789012345678,987654321098765432' }), ['123456789012345678', '987654321098765432']);
  assert.deepEqual(getProtectedGuildIds({ PROTECTED_GUILD_IDS: '1502005946698825789,1510642739476168934' }), ['1502005946698825789', '1510642739476168934']);
  assert.equal(validateBotSafetyConfig({ DISCORD_TOKEN: 'token', OWNER_IDS: '101,202', PROTECTED_GUILD_ID: '123456789012345678' }).ok, true);
  assert.equal(validateBotSafetyConfig({ DISCORD_TOKEN: 'token', OWNER_IDS: '101,202' }).ok, false);
});

test('banall usage requires a reason and confirmation phrase', () => {
  assert.equal(banallCommand.usage, '~banall <guild-id> <reason> confirm');
});

test('raidwho is not registered as a command alias schema', () => {
  const schemas = require('../utils/slashCommandSchemas');
  assert.equal(Object.prototype.hasOwnProperty.call(schemas, 'raidwho'), false);
});

test('coin toggle command exists for admin control', () => {
  const coinCommand = require('../commands/admin only/coin');
  assert.equal(coinCommand.name, 'coin');
  assert.ok(Array.isArray(coinCommand.aliases));
});

test('coin balance and coin toggle do not share the same alias namespace', () => {
  assert.ok(!balanceCommand.aliases.includes('coin'));
  assert.ok(!coinToggleCommand.aliases.includes('coins'));
  assert.ok(!coinToggleCommand.aliases.includes('balance'));
});

test('purge falls back to individual deletions when bulk delete hits the 14-day limit', async () => {
  const messageA = { deletable: true, delete: async () => {} };
  const messageB = { deletable: true, delete: async () => {} };

  const channel = {
    bulkDelete: async () => {
      throw new Error('You can only bulk delete messages that are under 14 days old.');
    },
    messages: {
      fetch: async () => new Map([[1, messageA], [2, messageB]])
    }
  };

  const deleted = await deleteMessagesInBatches(channel, 2);
  assert.equal(deleted, 2);
});

test('purge sends the result to the channel when its command message was deleted', async () => {
  const sent = [];
  const message = {
    reply: async () => {
      const error = new Error('Unknown message');
      error.code = 10008;
      throw error;
    },
    channel: {
      send: async (payload) => {
        sent.push(payload);
        return payload;
      }
    }
  };

  await sendResponse(message, { content: 'Deleted **26** messages.' });
  assert.deepEqual(sent, [{ content: 'Deleted **26** messages.', ephemeral: undefined, allowedMentions: undefined }]);
});

test('nuke falls back to individual deletions when bulk delete hits the 14-day limit', async () => {
  const messageA = { id: '1', createdTimestamp: Date.now(), deletable: true, delete: async () => {} };
  const messageB = { id: '2', createdTimestamp: Date.now(), deletable: true, delete: async () => {} };

  const collection = {
    size: 2,
    filter: (predicate) => {
      const result = [];
      for (const value of [messageA, messageB]) {
        if (predicate(value)) result.push(value);
      }
      return { size: result.length, values: () => result.values(), last: () => result[result.length - 1] };
    },
    values: () => [messageA, messageB].values(),
    last: () => messageB
  };

  const channel = {
    bulkDelete: async () => {
      throw new Error('You can only bulk delete messages that are under 14 days old.');
    },
    messages: {
      fetch: async () => collection,
      last: () => messageB
    }
  };

  const deleted = await deleteAllMessages(channel);
  assert.equal(deleted, 2);
});

test('command toggle command exists for all command control', () => {
  const commandToggle = require('../commands/admin only/command');
  assert.equal(commandToggle.name, 'command');
  assert.ok(Array.isArray(commandToggle.aliases));
});

test('bot command remains usable while global bot shutdown is active', () => {
  assert.equal(isBotCommandAllowedWhileDisabled({ name: 'bot', aliases: ['botcontrol'] }), true);
  assert.equal(isBotCommandAllowedWhileDisabled({ name: 'ping', aliases: ['p'] }), false);
  assert.equal(isBotCommandAllowedWhileDisabled({ name: 'ban', aliases: ['b'] }), false);
});

test('coin economy is disabled for coin commands while the coin controller stays available', () => {
  assert.equal(isCoinEconomyEnabled('true'), true);
  assert.equal(isCoinEconomyEnabled('false'), false);
  assert.equal(isCoinCommandAllowedWhileDisabled({ name: 'coin', aliases: ['coins', 'coincontrol'] }), true);
  assert.equal(isCoinCommandAllowedWhileDisabled({ name: 'daily', aliases: ['d'] }), false);
  assert.equal(isCoinCommandAllowedWhileDisabled({ name: 'coinflip', aliases: ['cf'] }), false);
  assert.equal(isCoinCommandAllowedWhileDisabled({ name: 'ping', aliases: ['p'] }), true);
});

test('only the configured true owner can authorize privileged commands', () => {
  process.env.TRUE_OWNER_ID = '1203862285874110486';
  process.env.OWNER_IDS = '1203862285874110486,999999999999999999';
  process.env.TRUSTED_USER_IDS = '1364628748695240847';
  assert.equal(getTrueOwnerId(), '1203862285874110486');
  assert.equal(isTrueOwner('1203862285874110486'), true);
  assert.equal(isTrueOwner('999999999999999999'), false);
  assert.equal(isTrustedUser('1364628748695240847'), true);
  assert.equal(getTrustedUserIds().includes('1364628748695240847'), true);
});

test('two-item owner list defaults to first owner and second trusted user', () => {
  delete process.env.TRUE_OWNER_ID;
  delete process.env.TRUSTED_USER_IDS;
  delete process.env.TRUSTED_USER_ID;
  process.env.OWNER_IDS = '1203862285874110486,1364628748695240847';

  assert.equal(getTrueOwnerId(), '1203862285874110486');
  assert.equal(isTrueOwner('1203862285874110486'), true);
  assert.equal(isTrueOwner('1364628748695240847'), false);
  assert.equal(isTrustedUser('1364628748695240847'), true);
  assert.deepEqual(getTrustedUserIds(), ['1364628748695240847']);
});
