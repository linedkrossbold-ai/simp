const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, setConfig } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'coin',
  aliases: ['coincontrol', 'coinstatus'],
  description: 'Enable or disable coin drops and coin economy actions',
  ownerOnly: true,
  usage: '~coin <enable|disable|status>',
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'coin', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const subcommand = (args[0] || '').toLowerCase();
    if (!subcommand || !['enable', 'disable', 'status'].includes(subcommand)) {
      return message.reply('❌ Usage: `~coin <enable|disable|status>`');
    }

    const currentValue = await getConfig('coin_enabled');
    const currentEnabled = currentValue !== 'false';

    if (subcommand === 'status') {
      const embed = new EmbedBuilder()
        .setColor(currentEnabled ? '#00FF00' : '#FF4500')
        .setTitle('💰 Coin Economy Status')
        .setDescription(`Coin drops and coin economy actions are currently **${currentEnabled ? 'ENABLED' : 'DISABLED'}**.`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const enabled = subcommand === 'enable';
    if (enabled === currentEnabled) {
      return message.reply(`❌ Coin economy is already ${enabled ? 'enabled' : 'disabled'}.`);
    }

    await setConfig('coin_enabled', enabled ? 'true' : 'false');

    const embed = new EmbedBuilder()
      .setColor(enabled ? '#00FF00' : '#FF4500')
      .setTitle(enabled ? '✅ Coin Economy Enabled' : '⛔ Coin Economy Disabled')
      .setDescription(`Coin drops and coin economy actions are now **${enabled ? 'enabled' : 'disabled'}**.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
