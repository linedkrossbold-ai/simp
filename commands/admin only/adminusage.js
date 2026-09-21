const { getAdminCommandUsageCounts } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

function formatUsageEntry({ commandName, timestamp, userLabel }) {
  return `• \`${commandName || 'unknown'}\` — ${timestamp || 'unknown time'} — Used by ${userLabel || 'unknown user'}`;
}

module.exports = {
  name: 'adminusage',
  description: 'View usage counts for owner and admin commands',
  ownerOnly: true,
  usage: '~adminusage',
  async execute(message) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'adminusage', requireApproval: true }))) return;
    const rows = await getAdminCommandUsageCounts({ guildId: message.guild?.id || null });
    if (!rows.length) return message.reply('No admin command usage has been recorded yet.');
    const lines = rows.map((row) => `• \`${row.commandName}\` — ${row.usageCount || 0} use(s)`);
    return message.reply(`**Admin command usage**\n${lines.join('\n')}`);
  }
};

module.exports.formatUsageEntry = formatUsageEntry;