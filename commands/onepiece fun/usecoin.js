const { EmbedBuilder } = require('discord.js');
const { ensureUser, ensureBaits, getBaits, addBait, addCoins, deductCoins, getUser } = require('../../database');

const COST_PER_ROLL = 100;
const REWARD_TABLE = [
  { type: 'owner_bait', chance: 1 },
  { type: 'bait_containers', chance: 30 },
  { type: 'common_bait', chance: 40 },
  { type: 'uncommon_bait', chance: 15 },
  { type: 'rare_bait', chance: 8 },
  { type: 'epic_bait', chance: 4 },
  { type: 'legendary_bait', chance: 3 },
  { type: 'mythical_bait', chance: 2 }
];

function parseSpendAmount(input) {
  if (!input || typeof input !== 'string') return COST_PER_ROLL;

  const normalized = input.replace(/,/g, '').trim().toLowerCase();
  if (!normalized) return COST_PER_ROLL;
  if (normalized === 'all') return 'all';

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < COST_PER_ROLL) return null;
  return parsed;
}

function pickReward() {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const entry of REWARD_TABLE) {
    cumulative += entry.chance;
    if (roll < cumulative) {
      return entry.type;
    }
  }

  return REWARD_TABLE[REWARD_TABLE.length - 1].type;
}

function summarizeRewards(rewardTotals) {
  const lines = [];
  const rewardOrder = ['owner_bait', 'bait_containers', 'common_bait', 'uncommon_bait', 'rare_bait', 'epic_bait', 'legendary_bait', 'mythical_bait'];

  for (const rewardType of rewardOrder) {
    const amount = rewardTotals[rewardType] || 0;
    if (amount > 0) {
      lines.push(`• ${rewardType.replace('_', ' ').toUpperCase()} x${amount}`);
    }
  }

  return lines.length ? lines.join('\n') : '• No rewards';
}

module.exports = {
  name: 'usecoin',
  aliases: ['usecoins', 'coinbet'],
  description: 'Spend coins to gamble for random bait rewards with owner bait as the rarest prize and 30% bait container chance',
  usage: '~usecoin [amount|all]',

  async execute(message, args) {
    try {
      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);
      const user = await getUser(message.author.id);
      const currentCoins = user?.coins || 0;
      const requestedAmount = parseSpendAmount(args[0]);

      if (requestedAmount === null) {
        return message.reply('❌ Please provide a valid amount of coins to spend, or use `all`.\nEach roll costs ' + COST_PER_ROLL + ' coins.');
      }

      const rollCount = requestedAmount === 'all'
        ? Math.floor(currentCoins / COST_PER_ROLL)
        : Math.floor(requestedAmount / COST_PER_ROLL);

      if (rollCount < 1) {
        return message.reply(`❌ You need at least ${COST_PER_ROLL} coins to gamble for one roll.`);
      }

      if (requestedAmount !== 'all' && requestedAmount % COST_PER_ROLL !== 0) {
        return message.reply(`❌ Amount must be a multiple of ${COST_PER_ROLL} coins. Each roll costs ${COST_PER_ROLL} coins.`);
      }

      const totalCost = requestedAmount === 'all'
        ? rollCount * COST_PER_ROLL
        : requestedAmount;

      if (currentCoins < totalCost) {
        return message.reply(`❌ You only have ${currentCoins.toLocaleString()} coins, but this would cost ${totalCost.toLocaleString()} coins.`);
      }

      const rewardTotals = {
        owner_bait: 0,
        bait_containers: 0,
        common_bait: 0,
        uncommon_bait: 0,
        rare_bait: 0,
        epic_bait: 0,
        legendary_bait: 0,
        mythical_bait: 0
      };

      await deductCoins(message.author.id, totalCost, 'usecoin_gamble');

      for (let index = 0; index < rollCount; index += 1) {
        const rewardType = pickReward();
        rewardTotals[rewardType] = (rewardTotals[rewardType] || 0) + 1;
      }

      for (const [rewardType, amount] of Object.entries(rewardTotals)) {
        if (amount > 0) {
          await addBait(message.author.id, rewardType, amount);
        }
      }

      const updatedUser = await getUser(message.author.id);
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎲 Coin Gamble Result')
        .setDescription(`You spent ${totalCost.toLocaleString()} coins for ${rollCount} roll${rollCount === 1 ? '' : 's'} and received:`)
        .addFields(
          { name: 'Rewards', value: summarizeRewards(rewardTotals), inline: false },
          { name: 'Coins Left', value: `${(updatedUser?.coins || 0).toLocaleString()}`, inline: true },
          { name: 'Odds', value: 'Owner bait: 1% • Mythical: 2% • Legendary: 3% • Containers: 30%', inline: true }
        )
        .setFooter({ text: 'Use ~usecoin [amount|all] to gamble more coins.' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while gambling your coins.');
    }
  }
};

module.exports.REWARD_TABLE = REWARD_TABLE;
module.exports.parseRollCount = parseSpendAmount;
module.exports.parseSpendAmount = parseSpendAmount;
module.exports.pickReward = pickReward;
module.exports.COST_PER_ROLL = COST_PER_ROLL;
