const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, setConfig } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

function settingsKey(guildId, key) {
  return `antinuke:${guildId}:${key}`;
}

async function getAntiNukeSettings(guildId) {
  const [enabledValue, thresholdValue, windowValue, actionValue, spamValue, mentionValue, joinValue, lockdownValue, lockdownDurationValue] = await Promise.all([
    getConfig(settingsKey(guildId, 'enabled')),
    getConfig(settingsKey(guildId, 'threshold')),
    getConfig(settingsKey(guildId, 'windowMs')),
    getConfig(settingsKey(guildId, 'action')),
    getConfig(settingsKey(guildId, 'spamThreshold')),
    getConfig(settingsKey(guildId, 'mentionThreshold')),
    getConfig(settingsKey(guildId, 'joinThreshold')),
    getConfig(settingsKey(guildId, 'lockdownEnabled')),
    getConfig(settingsKey(guildId, 'lockdownDurationMs'))
  ]);

  return {
    enabled: enabledValue === 'true',
    threshold: Number.parseInt(thresholdValue || '3', 10),
    windowMs: Number.parseInt(windowValue || '10000', 10),
    spamThreshold: Number.parseInt(spamValue || '6', 10),
    mentionThreshold: Number.parseInt(mentionValue || '4', 10),
    joinThreshold: Number.parseInt(joinValue || '5', 10),
    lockdownEnabled: lockdownValue === 'true',
    lockdownDurationMs: Number.parseInt(lockdownDurationValue || '300000', 10),
    action: ['timeout', 'kick', 'ban'].includes(actionValue) ? actionValue : 'timeout'
  };
}

function formatSeconds(ms) {
  return Math.max(1, Math.round(ms / 1000));
}

function parseInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function formatPermissionState(hasPermission) {
  return hasPermission ? 'Yes' : 'No';
}

module.exports = {
  name: 'antinuke',
  aliases: ['raidguard', 'antiraid'],
  description: 'Configure anti-nuke protection for the server',
  usage: '~antinuke <on|off|status|threshold|window|action|spam|mentions|joins|lockdown>',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

      if (!(await authorizeOwnerCommand(message, { commandName: 'antinuke', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
        return;
    }

    const subcommand = args[0]?.toLowerCase();
    if (!subcommand) {
      return message.reply('❌ Usage: `~antinuke <on|off|status|threshold|window|action|spam|mentions|joins|lockdown>`');
    }

    const guildId = message.guild.id;

    if (subcommand === 'status') {
      const settings = await getAntiNukeSettings(guildId);
      const botMember = message.guild.members.me;
      const hasViewAuditLog = botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog);
      const hasManageChannels = botMember?.permissions.has(PermissionFlagsBits.ManageChannels);
      const warning = !hasViewAuditLog || !hasManageChannels
        ? [
            '⚠️ Bot permission warning',
            !hasViewAuditLog ? '• Missing View Audit Log: destructive actions may not be attributed.' : null,
            !hasManageChannels ? '• Missing Manage Channels: lockdown fallback cannot run.' : null
          ].filter(Boolean).join('\n')
        : null;

      const embed = new EmbedBuilder()
        .setColor(settings.enabled ? '#00C853' : '#FF5252')
        .setTitle('🛡️ Anti-Nuke Status')
        .setDescription(warning)
        .addFields(
          { name: 'Enabled', value: settings.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Threshold', value: String(settings.threshold), inline: true },
          { name: 'Window', value: `${formatSeconds(settings.windowMs)}s`, inline: true },
          { name: 'Action', value: settings.action, inline: true },
          { name: 'Spam Threshold', value: String(settings.spamThreshold), inline: true },
          { name: 'Mention Threshold', value: String(settings.mentionThreshold), inline: true },
          { name: 'Join Threshold', value: String(settings.joinThreshold), inline: true },
          { name: 'Lockdown', value: settings.lockdownEnabled ? `On (${formatSeconds(settings.lockdownDurationMs)}s)` : 'Off', inline: true },
          { name: 'View Audit Log', value: formatPermissionState(hasViewAuditLog), inline: true },
          { name: 'Manage Channels', value: formatPermissionState(hasManageChannels), inline: true },
          { name: 'Monitored Actions', value: 'Ban, kick, channel delete, role delete, message spam, mention spam, join bursts', inline: false }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (subcommand === 'on' || subcommand === 'off') {
      await setConfig(settingsKey(guildId, 'enabled'), subcommand === 'on' ? 'true' : 'false');
      const embed = new EmbedBuilder()
        .setColor(subcommand === 'on' ? '#00C853' : '#FF5252')
        .setTitle(subcommand === 'on' ? '🛡️ Anti-Nuke Enabled' : '🛑 Anti-Nuke Disabled')
        .setDescription(`Anti-nuke protection is now **${subcommand === 'on' ? 'enabled' : 'disabled'}** for this server.`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (subcommand === 'threshold') {
      const value = parseInteger(args[1], 1, 10);
      if (value === null) {
        return message.reply('❌ Usage: `~antinuke threshold <1-10>`');
      }

      await setConfig(settingsKey(guildId, 'threshold'), String(value));
      return message.reply(`✅ Anti-nuke threshold set to **${value}** destructive actions.`);
    }

    if (subcommand === 'window') {
      const seconds = parseInteger(args[1], 5, 300);
      if (seconds === null) {
        return message.reply('❌ Usage: `~antinuke window <5-300>` in seconds');
      }

      await setConfig(settingsKey(guildId, 'windowMs'), String(seconds * 1000));
      return message.reply(`✅ Anti-nuke window set to **${seconds} seconds**.`);
    }

    if (subcommand === 'action') {
      const action = args[1]?.toLowerCase();
      if (!['timeout', 'kick', 'ban'].includes(action)) {
        return message.reply('❌ Usage: `~antinuke action <timeout|kick|ban>`');
      }

      await setConfig(settingsKey(guildId, 'action'), action);
      return message.reply(`✅ Anti-nuke action set to **${action}**.`);
    }

    if (subcommand === 'spam') {
      const value = parseInteger(args[1], 3, 20);
      if (value === null) {
        return message.reply('❌ Usage: `~antinuke spam <3-20>`');
      }

      await setConfig(settingsKey(guildId, 'spamThreshold'), String(value));
      return message.reply(`✅ Message spam threshold set to **${value} messages** per window.`);
    }

    if (subcommand === 'mentions') {
      const value = parseInteger(args[1], 1, 10);
      if (value === null) {
        return message.reply('❌ Usage: `~antinuke mentions <1-10>`');
      }

      await setConfig(settingsKey(guildId, 'mentionThreshold'), String(value));
      return message.reply(`✅ Mention spam threshold set to **${value} mentions** per message.`);
    }

    if (subcommand === 'joins') {
      const value = parseInteger(args[1], 2, 20);
      if (value === null) {
        return message.reply('❌ Usage: `~antinuke joins <2-20>`');
      }

      await setConfig(settingsKey(guildId, 'joinThreshold'), String(value));
      return message.reply(`✅ Join burst threshold set to **${value} joins** per window.`);
    }

    if (subcommand === 'lockdown') {
      const mode = args[1]?.toLowerCase();
      if (mode === 'on') {
        const durationSeconds = parseInteger(args[2] || '300', 30, 3600);
        if (durationSeconds === null) {
          return message.reply('❌ Usage: `~antinuke lockdown on <30-3600>` in seconds');
        }

        await setConfig(settingsKey(guildId, 'lockdownEnabled'), 'true');
        await setConfig(settingsKey(guildId, 'lockdownDurationMs'), String(durationSeconds * 1000));
        return message.reply(`✅ Raid lockdown will now auto-apply for **${durationSeconds} seconds** during join bursts.`);
      }

      if (mode === 'off') {
        await setConfig(settingsKey(guildId, 'lockdownEnabled'), 'false');
        return message.reply('✅ Raid lockdown has been disabled.');
      }

      if (mode === 'status') {
        return message.reply(`ℹ️ Raid lockdown is currently **${settings.lockdownEnabled ? 'enabled' : 'disabled'}**${settings.lockdownEnabled ? ` for ${formatSeconds(settings.lockdownDurationMs)} seconds` : ''}.`);
      }

      return message.reply('❌ Usage: `~antinuke lockdown <on|off|status> [durationSeconds]`');
    }

    return message.reply('❌ Usage: `~antinuke <on|off|status|threshold|window|action|spam|mentions|joins|lockdown>`');
  }
};
