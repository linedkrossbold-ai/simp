const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { saveEconomySnapshotToFile, restoreEconomySnapshotFromFile } = require('../../utils/economySnapshot');
const { db } = require('../../database');

module.exports = {
  name: 'snapshot',
  aliases: ['economysnapshot', 'saveeconomy'],
  description: 'Export or restore economy snapshot data for members (coins, bounty, baits, containers, streaks)',
  usage: '~snapshot [all|withdata] [filename.json] | ~snapshot load [filename.json] | ~snapshot restore [filename.json]',

  async execute(message, args = []) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'snapshot', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const normalizedArgs = args.map((value) => String(value || '').trim()).filter(Boolean);
    const includeAll = normalizedArgs.includes('all');
    const includeOnlyWithData = !includeAll;
    const requestedFilename = normalizedArgs.find((value) => value.toLowerCase().endsWith('.json')) || 'economy-snapshot.json';
    const restoreAction = normalizedArgs.find((value) => ['load', 'restore', 'import'].includes(value.toLowerCase()));

    try {
      const resolvedFilename = path.basename(requestedFilename);
      const outputPath = path.isAbsolute(requestedFilename)
        ? requestedFilename
        : path.join(process.cwd(), 'data', resolvedFilename);

      if (restoreAction) {
        if (!fs.existsSync(outputPath)) {
          return message.reply(`❌ Snapshot file not found: \`${path.basename(outputPath)}\``);
        }

        const restoredCount = await restoreEconomySnapshotFromFile({ db, filePath: outputPath });
        const embed = new EmbedBuilder()
          .setColor('#43A047')
          .setTitle('💾 Economy Snapshot Restored')
          .setDescription(`Restored ${restoredCount} member record(s) from the snapshot file.`)
          .addFields(
            { name: 'File', value: `\`${path.basename(outputPath)}\``, inline: false },
            { name: 'Records', value: String(restoredCount), inline: true }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      const entries = await saveEconomySnapshotToFile({
        db,
        filePath: outputPath,
        includeOnlyWithData
      });

      const attachment = new AttachmentBuilder(outputPath, { name: path.basename(outputPath) });
      const embed = new EmbedBuilder()
        .setColor('#43A047')
        .setTitle('💾 Economy Snapshot Exported')
        .setDescription(`Saved ${entries.length} member record(s) to a JSON file.${includeAll ? ' Included all users, even zeroed records.' : ' Included only members with economic activity.'}`)
        .addFields(
          { name: 'File', value: `\`${path.basename(outputPath)}\``, inline: false },
          { name: 'Records', value: String(entries.length), inline: true },
          { name: 'Mode', value: includeAll ? 'all users' : 'active users only', inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error('Failed to process economy snapshot:', error);
      await message.reply('❌ Failed to process the economy snapshot.');
    }
  }
};
