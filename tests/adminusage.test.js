const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUsageEntry } = require('../commands/admin only/adminusage');
const setnickCommand = require('../commands/admin only/setnick');

test('formatUsageEntry includes command, timestamp, and actor', () => {
  const line = formatUsageEntry({
    commandName: 'ban',
    timestamp: '2026-07-06 12:34:56',
    userLabel: 'Test User'
  });

  assert.equal(line, '• `ban` — 2026-07-06 12:34:56 — Used by Test User');
});

test('setnick is permission-based instead of owner-only', () => {
  assert.equal(setnickCommand.ownerOnly, undefined);
  assert.ok(setnickCommand.requiredPermissions.length > 0);
});
