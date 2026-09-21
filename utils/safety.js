function normalizeGuildIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter((entry) => /^\d{17,20}$/.test(entry));
  }

  return String(value)
    .split(',')
    .map((entry) => String(entry || '').trim())
    .filter((entry) => /^\d{17,20}$/.test(entry));
}

function getProtectedGuildIds(env = process.env) {
  const ids = new Set();
  for (const key of ['PROTECTED_GUILD_ID', 'PROTECTED_GUILD_IDS', 'MAIN_GUILD_ID', 'HOME_GUILD_ID']) {
    for (const id of normalizeGuildIdList(env?.[key])) {
      ids.add(id);
    }
  }
  return [...ids];
}

function validateBotSafetyConfig(env = process.env) {
  const issues = [];
  const token = String(env?.DISCORD_TOKEN || '').trim();
  const ownerIds = String(env?.OWNER_IDS || env?.OWNER_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
  const protectedGuilds = getProtectedGuildIds(env);

  if (!token || token === 'your_discord_token_here' || token === 'REPLACE_ME' || token === 'YOUR_DISCORD_TOKEN_HERE') {
    issues.push('DISCORD_TOKEN is missing or still placeholder');
  }

  if (ownerIds.length === 0) {
    issues.push('OWNER_IDS or OWNER_ID is not configured');
  }

  if (protectedGuilds.length === 0) {
    issues.push('No protected guild ID is configured (PROTECTED_GUILD_ID / MAIN_GUILD_ID / HOME_GUILD_ID)');
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  normalizeGuildIdList,
  getProtectedGuildIds,
  validateBotSafetyConfig
};
