const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, setConfig } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'noprefix',
  aliases: ['noprefixmode', 'no-prefix', 'nopref'],
  description: 'Enable or disable no-prefix commands for this guild (owner only)',
  ownerOnly: true,
  usage: '~noprefix <enable|disable|status>',

  async execute(message, args, client) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'noprefix', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const subcommand = args[0]?.toLowerCase();
    if (!subcommand || !['enable', 'disable', 'status', 'on', 'off'].includes(subcommand)) {
      return message.reply('❌ Usage: `~noprefix <enable|disable|status>`');
    }

    const currentValue = await getConfig(`noprefix:${message.guild.id}`);
    const currentEnabled = currentValue === 'true';

    if (subcommand === 'status') {
      const embed = new EmbedBuilder()
        .setColor(currentEnabled ? '#00FF00' : '#FF4500')
        .setTitle('🔎 No-Prefix Status')
        .setDescription(`No-prefix mode is currently **${currentEnabled ? 'ENABLED' : 'DISABLED'}** for this server.`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const enabled = subcommand === 'enable' || subcommand === 'on';
    if (enabled === currentEnabled) {
      return message.reply(`❌ No-prefix mode is already ${enabled ? 'enabled' : 'disabled'} for this server.`);
    }

    await setConfig(`noprefix:${message.guild.id}`, enabled ? 'true' : 'false');
    if (client?.noPrefixEnabled) {
      client.noPrefixEnabled.set(message.guild.id, enabled);
    }

    const embed = new EmbedBuilder()
      .setColor(enabled ? '#00FF00' : '#FF4500')
      .setTitle(enabled ? '✅ No-Prefix Enabled' : '⛔ No-Prefix Disabled')
      .setDescription(`No-prefix mode has been ${enabled ? 'enabled' : 'disabled'} for this server.`)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
