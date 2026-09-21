const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { authorizeOwnerCommand, grantTempAccess, grantAllTempAccess, isTempAccessGranted } = require('../../utils/owner');

function normalizeCommandName(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

const GRANTABLE_COMMANDS = new Set(['setnick', 'execute', 'say']);

function getAllCommandAccessNames(startDir = path.join(__dirname, '..', '..', 'commands'), names = new Set()) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      getAllCommandAccessNames(entryPath, names);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    try {
      const commandModule = require(entryPath);
      if (commandModule?.name) {
        names.add(String(commandModule.name).trim().toLowerCase());
      }
      if (Array.isArray(commandModule?.aliases)) {
        for (const alias of commandModule.aliases) {
          if (alias) {
            names.add(String(alias).trim().toLowerCase());
          }
        }
      }
    } catch (error) {
      console.error(`Failed to inspect command module for grantaccess: ${entryPath}`, error);
    }
  }

  return [...names].filter(Boolean);
}

module.exports = {
  name: 'grantaccess',
  aliases: ['giveaccess', 'approveaccess', 'grantgrant'],
  description: 'Manually grant approved access for a user',
  ownerOnly: true,
  usage: '~grantaccess @user [command1] [command2] [command3...] | all',
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'grantaccess', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('❌ Please mention a user you want to grant access to.');
    }

    const requestedCommands = args
      .slice(1)
      .flatMap((value) => String(value).split(','))
      .map((value) => normalizeCommandName(value))
      .filter(Boolean);

    if (requestedCommands.length === 0) {
      return message.reply('❌ Usage: `~grantaccess @user [command1] [command2] [command3...] | all`');
    }

    const uniqueCommands = [...new Set(requestedCommands.filter((value) => value !== 'all'))];
    if (uniqueCommands.length === 0) {
      return message.reply('❌ Usage: `~grantaccess @user [command1] [command2] [command3...] | all`');
    }

    const unsupportedCommands = uniqueCommands.filter((commandName) => !GRANTABLE_COMMANDS.has(commandName));
    const grantCommands = uniqueCommands.filter((commandName) => GRANTABLE_COMMANDS.has(commandName));
    if (grantCommands.length === 0) {
      return message.reply('❌ Access can only be granted for `setnick`, `execute`, or `say`.');
    }

    const grantedNow = [];
    const alreadyGranted = [];

    for (const commandName of grantCommands) {
      const wasAlreadyGranted = await isTempAccessGranted(target.id, commandName);
      await grantTempAccess(target.id, commandName);
      if (wasAlreadyGranted) {
        alreadyGranted.push(commandName);
      } else {
        grantedNow.push(commandName);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#43A047')
      .setTitle('✅ Access Granted')
      .setDescription(
        grantedNow.length > 0 || alreadyGranted.length > 0
          ? [
              `Approved access for ${target} has been updated for the permitted commands.`,
              grantedNow.length > 0 ? `Granted: ${grantedNow.map((commandName) => `\`${commandName}\``).join(', ')}.` : null,
              alreadyGranted.length > 0 ? `Already existed: ${alreadyGranted.map((commandName) => `\`${commandName}\``).join(', ')}.` : null,
              unsupportedCommands.length > 0 ? `Ignored: ${unsupportedCommands.map((commandName) => `\`${commandName}\``).join(', ')}.` : null
            ].filter(Boolean).join(' ')
          : `No valid command names were provided for ${target}.`
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};