const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const ticketCommand = require('../utils/ticket');
const {
  getTicketOwnerId,
  isTicketChannel,
  canCloseTicket,
  findOpenTicket,
  normalizeTicketName,
  TICKET_SUPPORT_ROLE_NAME,
  findTicketSupportRole,
  buildTicketPanel,
  TICKET_PANEL_SELECT_ID,
  TICKET_TYPES,
  scheduleTicketClosure,
  cancelTicketClosure,
  hasPendingTicketClosure
} = require('../utils/ticketSystem');
const cancelCommand = require('../commands/cancel');

function makeMember(id, permissions = []) {
  return {
    id,
    roles: { cache: new Map() },
    permissions: {
      has: (permission) => permissions.includes(permission)
    }
  };
}

function makeSupportMember(id) {
  return { ...makeMember(id), roles: { cache: new Map([['support', { name: 'general support' }]]) } };
}

test('ticket command has a slash-compatible command definition', () => {
  assert.equal(ticketCommand.name, 'ticket');
  assert.ok(Array.isArray(ticketCommand.aliases));
  assert.ok(ticketCommand.aliases.includes('tr'));
  assert.equal(ticketCommand.usage, '~ticket <create|setup|status|close|rename <name>>');
  assert.deepEqual(ticketCommand.data.toJSON().options.map((option) => option.name), ['create', 'setup', 'status', 'close', 'rename']);
  assert.equal(ticketCommand.data.toJSON().options[1].options[0].name, 'channel');
});

test('ticket ownership is read from the channel topic', () => {
  const channel = { topic: 'ticket-owner:123456789012345678:1710000000000' };
  assert.equal(getTicketOwnerId(channel), '123456789012345678');
  assert.equal(isTicketChannel(channel), true);
  assert.equal(getTicketOwnerId({ topic: 'general support' }), null);
  assert.equal(isTicketChannel({ topic: 'general support' }), false);
});

test('only general support members can close a ticket', () => {
  const channel = { topic: 'ticket-owner:123456789012345678:1710000000000' };
  assert.equal(canCloseTicket(makeSupportMember('123456789012345678'), channel), true);
  assert.equal(canCloseTicket(makeMember('123456789012345678'), channel), false);
  assert.equal(canCloseTicket(makeMember('999999999999999999', [PermissionFlagsBits.ManageChannels]), channel), false);
});

test('findOpenTicket returns only a matching ticket channel', () => {
  const openTicket = { id: 'ticket-1', topic: 'ticket-owner:123456789012345678:1710000000000' };
  const guild = { channels: { cache: new Map([['ticket-1', openTicket], ['other', { id: 'other', topic: 'general' }]]) } };
  assert.equal(findOpenTicket(guild, '123456789012345678'), openTicket);
  assert.equal(findOpenTicket(guild, '999999999999999999'), null);
});

test('ticket rename names are normalized and prefixed safely', () => {
  assert.equal(normalizeTicketName('My Billing Issue'), 'ticket-my-billing-issue');
  assert.equal(normalizeTicketName('ticket-old-name'), 'ticket-old-name');
  assert.equal(normalizeTicketName('!!!'), null);
});

test('ticket setup uses the general support role', () => {
  assert.equal(TICKET_SUPPORT_ROLE_NAME, 'general support');
  const supportRole = { id: 'role-1', name: 'general support', managed: false };
  const guild = { roles: { cache: new Map([['role-1', supportRole]]) } };
  assert.equal(findTicketSupportRole(guild), supportRole);
});

test('ticket setup builds a support panel with a ticket selector', () => {
  const panel = buildTicketPanel();
  assert.equal(panel.embeds[0].data.title, '🎟️ Support Tickets');
  assert.equal(panel.components[0].components[0].data.custom_id, TICKET_PANEL_SELECT_ID);
});

test('ticket panel includes the reference ticket types', () => {
  assert.deepEqual(Object.keys(TICKET_TYPES), ['invite-rewards', 'general-support', 'giveaway']);
  const options = buildTicketPanel().components[0].toJSON().components[0].options;
  assert.deepEqual(options.map((option) => option.value), ['invite-rewards', 'general-support', 'giveaway']);
  assert.equal(options[1].label, 'General Support');
});

test('ticket close countdown can be cancelled', () => {
  const channel = { id: 'ticket-countdown', delete: () => Promise.resolve() };

  assert.equal(scheduleTicketClosure(channel), true);
  assert.equal(hasPendingTicketClosure(channel), true);
  assert.equal(cancelTicketClosure(channel), true);
  assert.equal(hasPendingTicketClosure(channel), false);
  assert.equal(cancelTicketClosure(channel), false);
});

test('cancel command has the expected command definition', () => {
  assert.equal(cancelCommand.name, 'cancel');
  assert.equal(cancelCommand.usage, '~cancel');
});

test('bare prefix ticket command shows ticket usage instead of creating a ticket', async () => {
  let reply;
  await ticketCommand.execute({ reply: (payload) => { reply = payload; } }, []);

  assert.match(reply, /~ticket create/);
  assert.match(reply, /~ticket setup #channel/);
  assert.match(reply, /~ticket status/);
  assert.match(reply, /~ticket close/);
  assert.match(reply, /~ticket rename <name>/);
});