async function sendAdminProgressDm(message, payload) {
  const user = message?.author || message?.user;
  if (!user?.send) {
    throw new Error('Admin progress recipient is unavailable');
  }
  return user.send(payload);
}

module.exports = { sendAdminProgressDm };