const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');
const { getExecutedNickname, setExecutedNickname, getLockedNickname, setLockedNickname, getConfig, deleteConfig } = require('../../database');

const EXECUTED_ROLE_NAME = '☠️ 𝕖𝕩𝕖𝕔𝕦𝕥𝕖𝕕';

module.exports = {
  name: 'absolve',
  description: 'Remove executed nickname lock from a member',
  ownerOnly: true,
  usage: '~absolve @user',
  requiredPermissions: [PermissionFlagsBits.ManageNicknames],

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command must be used in a server.');
    }

    if (!(await authorizeOwnerCommand(message, { commandName: 'absolve', requiredPermissions: [PermissionFlagsBits.ManageNicknames], requireApproval: true }))) {
      return;
    }

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]?.replace(/[^0-9]/g, ''));
    if (!target) {
      return message.reply('❌ Please mention a member or provide their ID to absolve.');
    }

    const executedNick = await getExecutedNickname(message.guild.id, target.id);
    const lockedNick = await getLockedNickname(message.guild.id, target.id);
    if (!executedNick && !lockedNick) {
      return message.reply('❌ That member does not currently have an executed lock.');
    }

    await setExecutedNickname(message.guild.id, target.id, null).catch(() => {});
    await setLockedNickname(message.guild.id, target.id, null).catch(() => {});
    await target.setNickname(null).catch(() => {});

    const savedRolesRaw = await getConfig(`executedroles:${message.guild.id}:${target.id}`);
    let savedRoleIds = [];
    try {
      const parsed = JSON.parse(savedRolesRaw || '[]');
      savedRoleIds = Array.isArray(parsed) ? parsed : [];
    } catch {
      savedRoleIds = [];
    }

    const botHighestRole = message.guild.members.me?.roles.highest;
    let restoredRoles = 0;
    for (const roleId of savedRoleIds) {
      const role = message.guild.roles.cache.get(roleId);
      if (!role || role.managed || !botHighestRole || role.position >= botHighestRole.position) continue;
      if (!target.roles.cache.has(role.id)) {
        await target.roles.add(role, 'Restored role after absolution').catch(() => {});
        if (target.roles.cache.has(role.id)) restoredRoles += 1;
      }
    }
    await deleteConfig(`executedroles:${message.guild.id}:${target.id}`).catch(() => {});

    const executedRole = message.guild.roles.cache.find((role) => role.name === EXECUTED_ROLE_NAME);
    if (executedRole && target.roles.cache.has(executedRole.id)) {
      await target.roles.remove(executedRole, 'Absolved executed lock').catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🕊️ Absolution Complete')
      .setDescription(`${target} has been absolved. Their nickname lock${executedNick ? ' and executed lock' : ''} was removed and ${restoredRoles} moderation role(s) were restored.`)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
