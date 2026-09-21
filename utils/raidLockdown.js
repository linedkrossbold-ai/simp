const activeLockdowns = new Map();

async function applyGuildLockdown(guild, reason = 'Temporary lockdown', durationMs = 60000) {
  if (!guild?.channels?.cache) return { applied: false, alreadyActive: false };
  const existing = activeLockdowns.get(guild.id);
  if (existing && existing.expiresAt > Date.now()) return { applied: false, alreadyActive: true };

  const everyone = guild.roles.everyone;
  const editableChannels = guild.channels.cache.filter((channel) => channel.permissionOverwrites?.edit && channel.isTextBased?.());
  await Promise.all([...editableChannels.values()].map((channel) => channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason }).catch(() => {})));
  const expiresAt = Date.now() + Math.max(1000, Number(durationMs) || 60000);
  activeLockdowns.set(guild.id, { expiresAt });
  const timer = setTimeout(() => unlockGuildLockdown(guild, 'Lockdown duration expired').catch(() => {}), expiresAt - Date.now());
  timer.unref?.();
  return { applied: true, alreadyActive: false };
}

async function unlockGuildLockdown(guild, reason = 'Lockdown ended') {
  activeLockdowns.delete(guild?.id);
  if (!guild?.channels?.cache) return false;
  const everyone = guild.roles.everyone;
  const editableChannels = guild.channels.cache.filter((channel) => channel.permissionOverwrites?.edit && channel.isTextBased?.());
  await Promise.all([...editableChannels.values()].map((channel) => channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason }).catch(() => {})));
  return true;
}

function getLockdownRemainingMs(guildId) {
  return Math.max(0, (activeLockdowns.get(guildId)?.expiresAt || 0) - Date.now());
}

module.exports = { applyGuildLockdown, unlockGuildLockdown, getLockdownRemainingMs };