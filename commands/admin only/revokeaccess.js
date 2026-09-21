const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand, revokeTempAccess, revokeAllTempAccess, isTempAccessGranted } = require('../../utils/owner');

function normalizeCommandName(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['all', '*', 'everything'].includes(normalized)) {
    return 'all';
  }
  return normalized;
}

module.exports = {
  name: 'revokeaccess',
  aliases: ['removeaccess', 'revokegrant', 'removegrant'],
  description: 'Remove approved access for a user',
  ownerOnly: true,
  usage: '~revokeaccess @user [command|all]',
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'revokeaccess', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('❌ Please mention a user whose access you want to remove.');
    }

    const commandName = normalizeCommandName(args[1]);
    if (!commandName) {
      return message.reply('❌ Usage: `~revokeaccess @user [command|all]`');
    }

    if (commandName === 'all') {
      const removed = await revokeAllTempAccess(target.id);
      if (!removed) {
        return message.reply(`ℹ️ No approved access was found for ${target}.`);
      }

      const embed = new EmbedBuilder()
        .setColor('#E53935')
        .setTitle('🚫 Access Removed')
        .setDescription(`All approved access grants for ${target} have been removed.`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const removed = await revokeTempAccess(target.id, commandName);
    if (!removed) {
      const stillGranted = await isTempAccessGranted(target.id, commandName);
      if (!stillGranted) {
        return message.reply(`ℹ️ ${target} does not currently have approved access for \`${commandName}\`.`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#E53935')
      .setTitle('🚫 Access Removed')
      .setDescription(`Approved access for ${target} on \`${commandName}\` has been removed.`)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};