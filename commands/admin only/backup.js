const { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { createGuildBackup } = require('../../utils/serverBackup');
const { sendAdminProgressDm } = require('../../utils/adminProgress');

function parseBackupWindow(arg) {
  if (!arg) {
    return 60;
  }

  const normalized = String(arg).trim().toLowerCase();
  if (normalized === '1h' || normalized === '1hour' || normalized === '1hours') {
    return 60;
  }

  const numericValue = Number.parseInt(normalized.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(1, Math.min(60, numericValue));
}

module.exports = {
  name: 'backup',
  description: 'Create a backup of the server roles and channels',
  usage: '~backup [1-60|1h]',

  async execute(message, args = []) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'backup', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) || !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ I need Manage Roles and Manage Channels permissions to create and later restore backups.');
    }

    try {
      const messageWindowMinutes = parseBackupWindow(args[0]);
      if (messageWindowMinutes === null) {
        return message.reply('❌ Usage: `~backup [1-60|1h]`');
      }

      const statusMessage = await sendAdminProgressDm(message, `📦 Starting backup for **${message.guild.name}**... 0% complete. Saving messages from the last ${messageWindowMinutes} minute(s).`);

      let lastProgressPercent = -1;
      const { backupId, filePath, backup } = await createGuildBackup(message.guild, {
        messageWindowMinutes,
        onProgress: async ({ percent, channelName, totalChannels, processedChannels, cutoffMinutes }) => {
          if (percent === lastProgressPercent) {
            return;
          }

          lastProgressPercent = percent;
          await statusMessage.edit(`📦 Backing up... ${percent}% complete. Processed ${processedChannels}/${totalChannels} channels. Saving messages from the last ${cutoffMinutes || messageWindowMinutes} minute(s). ${channelName ? `Current: ${channelName}` : ''}`).catch(() => {});
        }
      });
      const attachment = new AttachmentBuilder(filePath, { name: `${message.guild.id}-${backupId}.json` });

      const embed = new EmbedBuilder()
        .setColor('#4DB6AC')
        .setTitle('📦 Server Backup Created')
        .setDescription(`A JSON backup of the server roles, channels, and recent messages has been saved and attached below. Message window: last ${backup.messageWindowMinutes || messageWindowMinutes} minute(s).`)
        .addFields(
          { name: 'Backup ID', value: backupId, inline: true },
          { name: 'Roles', value: String(backup.roles.length), inline: true },
          { name: 'Channels', value: String(backup.channels.length), inline: true },
          { name: 'Message Groups', value: String(backup.messages?.length || 0), inline: true },
          { name: 'Message Window', value: `${backup.messageWindowMinutes || messageWindowMinutes} minute(s)`, inline: true }
        )
        .setFooter({ text: 'Use ~restore <backup-id> confirm to restore this backup.' })
        .setTimestamp();

      await statusMessage.edit({ content: '✅ Backup complete.', embeds: [embed], files: [attachment] }).catch(async () => {
        await sendAdminProgressDm(message, { embeds: [embed], files: [attachment] }).catch(() => {});
      });
    } catch (error) {
      console.error('Failed to create server backup:', error);
      await message.reply('❌ Failed to create the server backup. I could not send the progress or result to your DMs.');
    }
  }
};