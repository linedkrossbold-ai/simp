const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, setConfig } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'bot',
  aliases: ['botcontrol', 'botstatus', 'botstop'],
  description: 'Enable, disable, shut down, or check bot status',
  ownerOnly: true,
  usage: '~bot <enable|disable|status|shutdown>',

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'bot', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const subcommand = args[0]?.toLowerCase();
    if (!subcommand || !['enable', 'disable', 'status', 'shutdown', 'stop'].includes(subcommand)) {
      return message.reply('❌ Usage: `~bot <enable|disable|status|shutdown>`');
    }

    const currentValue = await getConfig('bot_enabled');
    const currentEnabled = currentValue !== 'false';

    if (subcommand === 'status') {
      const ping = Number.isFinite(message.client?.ws?.ping) && message.client.ws.ping >= 0
        ? `${Math.round(message.client.ws.ping)}ms`
        : 'N/A';
      const embed = new EmbedBuilder()
        .setColor(currentEnabled ? '#00FF00' : '#FF4500')
        .setTitle('🔌 Bot Status')
        .setDescription(`The bot is currently **${currentEnabled ? 'ENABLED' : 'DISABLED'}**.\n**Ping latency:** ${ping}`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (subcommand === 'shutdown' || subcommand === 'stop') {
      const embed = new EmbedBuilder()
        .setColor('#FF4500')
        .setTitle('⛔ Bot Shutting Down')
        .setDescription('The bot is shutting down now.')
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      await message.client.destroy();
      process.exit(0);
      return;
    }

    const enabled = subcommand === 'enable';
    if (enabled === currentEnabled) {
      return message.reply(`❌ The bot is already ${enabled ? 'enabled' : 'disabled'}.`);
    }

    await setConfig('bot_enabled', enabled ? 'true' : 'false');
    message.client.enabled = enabled;

    const embed = new EmbedBuilder()
      .setColor(enabled ? '#00FF00' : '#FF4500')
      .setTitle(enabled ? '✅ Bot Enabled' : '⛔ Bot Disabled')
      .setDescription(`The bot is now **${enabled ? 'enabled' : 'disabled'}**.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
