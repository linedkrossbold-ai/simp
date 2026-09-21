function buildRoast(targetName = 'that person') {
  const target = String(targetName || 'that person');
  const replies = [
    `${target} has the confidence of a final boss and the strategy of a loading screen.`,
    `${target} is proof that being loud and being right are unrelated skills.`,
    `${target} brings tutorial-level decisions to ranked conversations.`,
    `${target} has potential. It is currently under heavy construction.`
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

module.exports = { buildRoast };