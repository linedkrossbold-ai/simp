const watchedUsers = new Set();

function addWatchedUser(userId) { watchedUsers.add(String(userId)); }
function removeWatchedUser(userId) { watchedUsers.delete(String(userId)); }
function isWatchedUser(userId) { return watchedUsers.has(String(userId)); }

module.exports = { addWatchedUser, removeWatchedUser, isWatchedUser };