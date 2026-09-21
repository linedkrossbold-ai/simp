const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { buildProgressBar, loadBackupFromAttachment, loadTemplateByIdOrFile, restoreGuildBackup } = require('../../utils/serverBackup');
const { sendAdminProgressDm } = require('../../utils/adminProgress');

function isConfirmToken(value) {
  return ['confirm', '--confirm', 'yes', 'paste'].includes(String(value || '').toLowerCase());
}

function normalizeTemplateReference(reference) {
  if (!reference) return null;
  const fileName = path.basename(String(reference));
  return fileName.replace(/\.json$/i, '');
}

module.exports = {
  name: 'paste',
  description: 'Replace this server with a server template (roles and channels)',
  usage: '~paste <template-id|attachment> confirm',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'paste', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) || !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ I need Manage Roles and Manage Channels permissions to apply templates.');
    }

    const templateReference = normalizeTemplateReference(args.find((arg) => !isConfirmToken(arg)));
    const confirmed = args.some(isConfirmToken);
    const attachment = message.attachments.first();

    if (!templateReference && !attachment) {
      return message.reply('❌ Usage: `~paste <template-id|attachment> confirm`');
    }

    if (!confirmed) {
      return message.reply('⚠️ Pasting will delete the destination server channels and roles before rebuilding them. Re-run the command with `confirm` to continue.');
    }

    let progressMessage = null;

    try {
      const template = attachment
        ? await loadBackupFromAttachment(attachment)
        : await loadTemplateByIdOrFile(templateReference);

      if (!template) {
        return message.reply('❌ Template not found. Make sure the template ID is correct or use the attachment.');
      }

      if (!template.isTemplate) {
        return message.reply('⚠️ This is not a template file. Use ~paste with a template created by ~copy.');
      }

      progressMessage = await sendAdminProgressDm(message, {
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('📋 Template Paste in Progress')
              .setDescription(`Replacing **${message.guild.name}** with the template...`)
              .addFields(
                { name: 'Phase', value: 'Starting', inline: true },
                { name: 'Progress', value: `${buildProgressBar(0, 100, 20)}`, inline: false },
                { name: 'Status', value: 'Preparing server replacement', inline: false }
              )
              .setTimestamp()
          ]
        });

      const updateProgress = async ({ phase, percent, detail }) => {
        if (!progressMessage) {
          return;
        }

        const labelMap = {
          cleanup: 'Cleanup',
          roles: 'Roles',
          categories: 'Categories',
          channels: 'Channels',
          messages: 'Messages'
        };

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📋 Template Paste in Progress')
          .setDescription(`Replacing **${message.guild.name}** with the template...`)
          .addFields(
            { name: 'Phase', value: labelMap[phase] || 'Preparing', inline: true },
            { name: 'Progress', value: buildProgressBar(percent, 100, 20), inline: false },
            { name: 'Status', value: detail || 'Applying the template', inline: false }
          )
          .setTimestamp();

        await progressMessage.edit({ embeds: [embed] }).catch(() => {});
      };

      const summary = await restoreGuildBackup(message.guild, template, { replaceExisting: true, onProgress: updateProgress });

      if (progressMessage) {
        const finalEmbed = new EmbedBuilder()
          .setColor('#81C784')
          .setTitle('📋 Template Pasted Successfully')
          .setDescription(`Template applied to **${message.guild.name}**.`)
          .addFields(
            { name: 'Channels Deleted', value: String(summary.channelsDeleted), inline: true },
            { name: 'Roles Deleted', value: String(summary.rolesDeleted), inline: true },
            { name: 'Emojis Deleted', value: String(summary.emojisDeleted), inline: true },
            { name: 'Stickers Deleted', value: String(summary.stickersDeleted), inline: true },
            { name: 'Roles Created', value: String(summary.rolesCreated), inline: true },
            { name: 'Roles Updated', value: String(summary.rolesUpdated), inline: true },
            { name: 'Categories Created', value: String(summary.categoriesCreated), inline: true },
            { name: 'Categories Updated', value: String(summary.categoriesUpdated), inline: true },
            { name: 'Channels Created', value: String(summary.channelsCreated), inline: true },
            { name: 'Channels Updated', value: String(summary.channelsUpdated), inline: true },
            { name: 'Skipped', value: String(summary.skipped), inline: true }
          )
          .setTimestamp();

        await progressMessage.edit({ embeds: [finalEmbed] }).catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor('#81C784')
        .setTitle('📋 Template Pasted Successfully')
        .setDescription(`**${message.guild.name}** now matches the template structure.`)
        .addFields(
          { name: 'Channels Deleted', value: String(summary.channelsDeleted), inline: true },
          { name: 'Roles Deleted', value: String(summary.rolesDeleted), inline: true },
          { name: 'Emojis Deleted', value: String(summary.emojisDeleted), inline: true },
          { name: 'Stickers Deleted', value: String(summary.stickersDeleted), inline: true },
          { name: 'Roles Created', value: String(summary.rolesCreated), inline: true },
          { name: 'Roles Updated', value: String(summary.rolesUpdated), inline: true },
          { name: 'Categories Created', value: String(summary.categoriesCreated), inline: true },
          { name: 'Categories Updated', value: String(summary.categoriesUpdated), inline: true },
          { name: 'Channels Created', value: String(summary.channelsCreated), inline: true },
          { name: 'Channels Updated', value: String(summary.channelsUpdated), inline: true },
          { name: 'Skipped', value: String(summary.skipped), inline: true }
        )
        .setTimestamp();

      await progressMessage.edit({ embeds: [embed] }).catch(async () => {
        await sendAdminProgressDm(message, { embeds: [embed] }).catch(() => {});
      });
    } catch (error) {
      console.error('Failed to apply template:', error);
      await message.reply('❌ Failed to apply the template. Make sure the template ID or attachment is valid and that your DMs are open.');
    }
  }
};
