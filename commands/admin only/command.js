const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, setConfig } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'command',
  aliases: ['commands', 'cmd', 'cmdtoggle'],
  description: 'Enable or disable command execution globally',
  ownerOnly: true,
  usage: '~command <enable|disable|status>',
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'command', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const subcommand = (args[0] || '').toLowerCase();
    if (!subcommand || !['enable', 'disable', 'status'].includes(subcommand)) {
      return message.reply('❌ Usage: `~command <enable|disable|status>`');
    }

    const currentValue = await getConfig('bot_enabled');
    const currentEnabled = currentValue !== 'false';

    if (subcommand === 'status') {
      const embed = new EmbedBuilder()
        .setColor(currentEnabled ? '#00FF00' : '#FF4500')
        .setTitle('⚙️ Command Execution Status')
        .setDescription(`Command execution is currently **${currentEnabled ? 'ENABLED' : 'DISABLED'}**.`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const enabled = subcommand === 'enable';
    if (enabled === currentEnabled) {
      return message.reply(`❌ Command execution is already ${enabled ? 'enabled' : 'disabled'}.`);
    }

    await setConfig('bot_enabled', enabled ? 'true' : 'false');
    message.client.enabled = enabled;

    const embed = new EmbedBuilder()
      .setColor(enabled ? '#00FF00' : '#FF4500')
      .setTitle(enabled ? '✅ Command Execution Enabled' : '⛔ Command Execution Disabled')
      .setDescription(`Command execution is now **${enabled ? 'enabled' : 'disabled'}**.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
