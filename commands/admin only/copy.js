const { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { createGuildBackup } = require('../../utils/serverBackup');
const { sendAdminProgressDm } = require('../../utils/adminProgress');

module.exports = {
  name: 'copy',
  description: 'Create a server template (roles and channels, no messages) to use elsewhere',
  usage: '~copy',

  async execute(message, args = []) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'copy', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) || !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ I need Manage Roles and Manage Channels permissions to create templates.');
    }

    try {
      const statusMessage = await sendAdminProgressDm(message, `📋 Creating a server template for **${message.guild.name}**... 0% complete.`);

      let lastProgressPercent = -1;
      const { backupId, filePath, backup } = await createGuildBackup(message.guild, {
        skipMessages: true,
        onProgress: async ({ percent, totalChannels, processedChannels, channelName }) => {
          if (percent === lastProgressPercent) {
            return;
          }

          lastProgressPercent = percent;
          await statusMessage.edit(`📋 Creating template... ${percent}% complete. Processed ${processedChannels}/${totalChannels} channels. ${channelName ? `Current: ${channelName}` : ''}`).catch(() => {});
        }
      });

      const attachment = new AttachmentBuilder(filePath, { name: `${message.guild.id}-template-${backupId}.json` });

      const embed = new EmbedBuilder()
        .setColor('#42A5F5')
        .setTitle('📋 Server Template Created')
        .setDescription(`A JSON template of the server roles and channels has been saved and attached below. No messages included.`)
        .addFields(
          { name: 'Template ID', value: backupId, inline: true },
          { name: 'Roles', value: String(backup.roles.length), inline: true },
          { name: 'Channels', value: String(backup.channels.length), inline: true }
        )
        .setFooter({ text: 'Use ~paste <template-id> confirm in another server to apply this template.' })
        .setTimestamp();

      await statusMessage.edit({ content: '✅ Template created.', embeds: [embed], files: [attachment] }).catch(async () => {
        await sendAdminProgressDm(message, { embeds: [embed], files: [attachment] }).catch(() => {});
      });
    } catch (error) {
      console.error('Failed to create server template:', error);
      await message.reply('❌ Failed to create the server template. I could not send the progress or result to your DMs.');
    }
  }
};
