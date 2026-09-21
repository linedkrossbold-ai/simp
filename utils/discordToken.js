function resolveDiscordToken(env = process.env) {
  const token = String(env.DISCORD_TOKEN || '').trim();
  if (!token) {
    return { token: null, error: 'DISCORD_TOKEN is missing. Add it to the Railway Variables tab.' };
  }
  return { token, error: null };
}

module.exports = { resolveDiscordToken };