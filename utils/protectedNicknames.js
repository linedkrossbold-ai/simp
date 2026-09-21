function getProtectedIds() {
  return new Set([
    ...(process.env.PROTECTED_NICKNAME_IDS || '').split(','),
    ...(process.env.OWNER_IDS || '').split(','),
    process.env.OWNER_ID || '',
    process.env.TRUE_OWNER_ID || ''
  ].map((id) => id.trim()).filter(Boolean));
}

function isProtectedNicknameTarget(userId) {
  return getProtectedIds().has(String(userId || '').trim());
}

module.exports = { isProtectedNicknameTarget };