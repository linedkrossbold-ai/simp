const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const sayCommand = require('../commands/admin only/say');

test('say command supports content and target channel arguments', () => {
  assert.equal(sayCommand.name, 'say');
  assert.equal(sayCommand.usage, '~say <content> in #channel');
  assert.deepEqual(sayCommand.requiredPermissions, [PermissionFlagsBits.ManageMessages]);
  assert.deepEqual(sayCommand.data.toJSON().options.map((option) => option.name), ['content', 'channel']);
});

test('say command sends the requested content to the selected channel', async () => {
  const sent = [];
  const replies = [];
  const channel = {
    id: '123456789012345678',
    type: 0,
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    send: async (payload) => sent.push(payload)
  };
  const message = {
    guild: { members: { me: {} }, channels: { cache: new Map([[channel.id, channel]]) } },
    mentions: { channels: { first: () => channel } },
    reply: async (payload) => replies.push(payload)
  };

  await sayCommand.execute(message, ['Hello', 'there', 'in', `<#${channel.id}>`]);
  assert.deepEqual(sent, [{ content: 'Hello there' }]);
  assert.equal(replies.length, 1);
});