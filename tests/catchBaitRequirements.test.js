const test = require('node:test');
const assert = require('node:assert/strict');
const { getBaitRequirement, formatBaitLabel } = require('../commands/onepiece fun/catch');

function makeMember(id, roleIds = [], guildName = 'sfz') {
  const cache = new Map(roleIds.map((roleId) => [roleId, { id: roleId, name: `Role ${roleId}` }]));
  const highestRoleId = roleIds[roleIds.length - 1] || 'default-role';
  return {
    id,
    guild: { name: guildName },
    roles: {
      cache,
      highest: { id: highestRoleId, name: `Highest ${highestRoleId}` }
    }
  };
}

test('catch bait requirements respect custom owner and tier role IDs', () => {
  assert.equal(getBaitRequirement(makeMember('1454114348430655530')), 'owner_bait');
  assert.equal(getBaitRequirement(makeMember('1016811034767536130')), 'mythical_bait');
  assert.equal(getBaitRequirement(makeMember('1466365875652264052', [], 'Other Server')), 'mythical_bait');
  assert.equal(getBaitRequirement(makeMember('827821383417331732')), 'legendary_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542441672976244736'])), 'epic_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542441489991344200'])), 'epic_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1550516263346774168'])), 'legendary_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542869688831311894'])), 'rare_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1538009850582401127'])), 'uncommon_bait');
  assert.equal(getBaitRequirement(makeMember('1454114348430655530', ['1538009850582401127'])), 'owner_bait');
  assert.equal(getBaitRequirement(makeMember('1489897356840271994', ['1542441672976244736'])), 'legendary_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542441672976244736', '1542869688831311894'])), 'rare_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1540505990422859847'])), 'rare_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['999999999999999999'])), 'common_bait');
});

test('catch bait requirements are limited to SFZ and the highest role', () => {
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542441672976244736'], 'Other Server')), 'epic_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['1542869688831311894', '999999999999999999'])), 'common_bait');
  assert.equal(getBaitRequirement(makeMember('123456789012345678', ['999999999999999999', '1542869688831311894'])), 'rare_bait');
});

test('catch bait labels stay human readable and do not include a target role name', () => {
  assert.equal(formatBaitLabel('owner_bait'), 'Owner Bait');
  assert.equal(formatBaitLabel('legendary_bait'), 'Legendary Bait');
  assert.equal(formatBaitLabel('common_bait'), 'Common Bait');
});
