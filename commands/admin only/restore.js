const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { buildProgressBar, loadBackupFromFile, loadBackupFromAttachment, restoreGuildBackup } = require('../../utils/serverBackup');
const { sendAdminProgressDm } = require('../../utils/adminProgress');

function isConfirmToken(value) {
  return ['confirm', '--confirm', 'yes', 'restore'].includes(String(value || '').toLowerCase());
}

function normalizeBackupReference(reference) {
  if (!reference) return null;
  const fileName = path.basename(String(reference));
  return fileName.replace(/\.json$/i, '');
}

module.exports = {
  name: 'restore',
  description: 'Restore a server backup of roles and channels',
  usage: '~restore <backup-id|attachment> confirm',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'restore', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) || !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ I need Manage Roles and Manage Channels permissions to restore backups.');
    }

    const backupReference = normalizeBackupReference(args.find((arg) => !isConfirmToken(arg)));
    const confirmed = args.some(isConfirmToken);
    const attachment = message.attachments.first();

    if (!backupReference && !attachment) {
      return message.reply('❌ Usage: `~restore <backup-id|attachment> confirm`');
    }

    if (!confirmed) {
      return message.reply('⚠️ Restoration can change roles and channels. Re-run the command with `confirm` to continue.');
    }

    const backupDirectory = path.join(__dirname, '..', '..', 'data', 'server-backups', message.guild.id);
    const backupPath = backupReference && !attachment
      ? path.join(backupDirectory, `${backupReference}.json`)
      : null;

    let progressMessage = null;

    try {
      const backup = attachment
        ? await loadBackupFromAttachment(attachment)
        : await loadBackupFromFile(backupPath);

      progressMessage = await sendAdminProgressDm(message, {
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('♻️ Backup Restore in Progress')
              .setDescription(`Restoring **${message.guild.name}**...`)
              .addFields(
                { name: 'Phase', value: 'Starting', inline: true },
                { name: 'Progress', value: `${buildProgressBar(0, 100, 20)}`, inline: false },
                { name: 'Status', value: 'Preparing restore environment', inline: false }
              )
              .setTimestamp()
          ]
        });

      const updateProgress = async ({ phase, percent, detail }) => {
        if (!progressMessage) {
          return;
        }

        const labelMap = {
          roles: 'Roles',
          categories: 'Categories',
          channels: 'Channels',
          messages: 'Messages'
        };

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('♻️ Backup Restore in Progress')
          .setDescription(`Restoring **${message.guild.name}**...`)
          .addFields(
            { name: 'Phase', value: labelMap[phase] || 'Preparing', inline: true },
            { name: 'Progress', value: buildProgressBar(percent, 100, 20), inline: false },
            { name: 'Status', value: detail || 'Working on the restore', inline: false }
          )
          .setTimestamp();

        await progressMessage.edit({ embeds: [embed] }).catch(() => {});
      };

      const summary = await restoreGuildBackup(message.guild, backup, { onProgress: updateProgress });

      if (progressMessage) {
        const finalEmbed = new EmbedBuilder()
          .setColor('#81C784')
          .setTitle('♻️ Server Backup Restored')
          .setDescription(`Restore complete for **${message.guild.name}**.`)
          .addFields(
            { name: 'Roles Created', value: String(summary.rolesCreated), inline: true },
            { name: 'Roles Updated', value: String(summary.rolesUpdated), inline: true },
            { name: 'Categories Created', value: String(summary.categoriesCreated), inline: true },
            { name: 'Categories Updated', value: String(summary.categoriesUpdated), inline: true },
            { name: 'Channels Created', value: String(summary.channelsCreated), inline: true },
            { name: 'Channels Updated', value: String(summary.channelsUpdated), inline: true },
            { name: 'Messages Restored', value: String(summary.messagesRestored || 0), inline: true },
            { name: 'Skipped', value: String(summary.skipped), inline: true }
          )
          .setTimestamp();

        await progressMessage.edit({ embeds: [finalEmbed] }).catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor('#81C784')
        .setTitle('♻️ Server Backup Restored')
        .setDescription(`Backup restore completed for **${message.guild.name}**.`)
        .addFields(
          { name: 'Roles Created', value: String(summary.rolesCreated), inline: true },
          { name: 'Roles Updated', value: String(summary.rolesUpdated), inline: true },
          { name: 'Categories Created', value: String(summary.categoriesCreated), inline: true },
          { name: 'Categories Updated', value: String(summary.categoriesUpdated), inline: true },
          { name: 'Channels Created', value: String(summary.channelsCreated), inline: true },
          { name: 'Channels Updated', value: String(summary.channelsUpdated), inline: true },
          { name: 'Messages Restored', value: String(summary.messagesRestored || 0), inline: true },
          { name: 'Skipped', value: String(summary.skipped), inline: true }
        )
        .setTimestamp();

      await progressMessage.edit({ embeds: [embed] }).catch(async () => {
        await sendAdminProgressDm(message, { embeds: [embed] }).catch(() => {});
      });
    } catch (error) {
      console.error('Failed to restore server backup:', error);
      await message.reply('❌ Failed to restore the server backup. Make sure the backup ID or attachment is valid and that your DMs are open.');
    }
  }
};