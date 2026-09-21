// Crate reward probabilities
const CRATE_REWARDS = [
  { amount: 1000, probability: 90 },  // 90%
  { amount: 5000, probability: 6 },   // 6%
  { amount: 10000, probability: 2 },  // 2%
  { amount: 25000, probability: 1.5 },// 1.5%
  { amount: 50000, probability: 0.5 } // 0.5%
];

function calculateCrateReward() {
  const random = Math.random() * 100;
  let cumulative = 0;

  for (const reward of CRATE_REWARDS) {
    cumulative += reward.probability;
    if (random <= cumulative) {
      return reward.amount || reward.type;
    }
  }

  return CRATE_REWARDS[1].amount; // Fallback to common reward
}

module.exports = {
  CRATE_REWARDS,
  calculateCrateReward
};
