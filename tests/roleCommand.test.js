const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { resolveRole } = require('../commands/admin only/role');

test('role resolver accepts role IDs and matching multi-word names', () => {
  const supportRole = { id: '123456789012345678', name: 'general support' };
  const guild = { roles: { cache: new Collection([[supportRole.id, supportRole]]) } };

  assert.equal(resolveRole(guild, supportRole.id), supportRole);
  assert.equal(resolveRole(guild, 'General   Support'), supportRole);
});