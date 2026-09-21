const { EmbedBuilder } = require('discord.js');
const { ensureUser, ensureBaits, addBait, addBounty, getDailyClaimRow, upsertDailyClaim, applyBountyPassiveBonus, addCoins } = require('../../database');

function getDailyRewardProfile(streak) {
  const streakBonus = Math.max(0, streak - 1);
  const commonWeight = Math.max(35, 60 - (streakBonus * 2));
  const uncommonWeight = 25 + Math.min(10, Math.floor(streakBonus / 2));
  const rareWeight = 10 + Math.min(8, Math.floor(streakBonus / 3));
  const epicWeight = 5 + Math.min(7, Math.floor(streakBonus / 4));

  return {
    baitWeights: [commonWeight, uncommonWeight, rareWeight, epicWeight],
    baitTypes: ['common_bait', 'uncommon_bait', 'rare_bait', 'epic_bait'],
    bountyMin: 500 + Math.min(2500, streakBonus * 100),
    bountyMax: 1500 + Math.min(5000, streakBonus * 200),
    milestoneContainer: streak > 0 && streak % 5 === 0 ? 1 : 0
  };
}

function pickWeightedReward(baitTypes, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let index = 0; index < baitTypes.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return baitTypes[index];
    }
  }

  return baitTypes[0];
}

function toUtcDateKey(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

module.exports = {
  name: 'daily',
  description: 'Claim your daily bait reward',
  usage: '~daily',

  async execute(message, args) {
    try {
      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);

      const claimRow = await getDailyClaimRow(message.author.id);
      const todayKey = new Date().toISOString().slice(0, 10);
      const claimDayKey = toUtcDateKey(claimRow?.lastDaily);
      if (claimDayKey === todayKey) {
        return message.reply('❌ You have already claimed your daily reward! Come back tomorrow.');
      }

      const yesterdayKey = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const isConsecutiveDay = claimDayKey === yesterdayKey;
      const streak = isConsecutiveDay ? Math.max(1, (claimRow.dailyStreak || 0) + 1) : 1;
      const profile = getDailyRewardProfile(streak);

      const baitType = pickWeightedReward(profile.baitTypes, profile.baitWeights);
      await addBait(message.author.id, baitType, 1);

      const baseBountyReward = Math.floor(Math.random() * (profile.bountyMax - profile.bountyMin + 1)) + profile.bountyMin;
      const passiveResult = await applyBountyPassiveBonus(message.author.id, baseBountyReward, 'daily');
      await addBounty(message.author.id, passiveResult.amount);

      if (profile.milestoneContainer > 0) {
        await addBait(message.author.id, 'bait_containers', profile.milestoneContainer);
      }

      await addCoins(message.author.id, 1, 'daily_claim');

      await upsertDailyClaim(message.author.id, streak);

      const baitName = baitType.replace('_', ' ').toUpperCase();
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎁 Daily Reward Claimed!')
        .addFields(
          { name: 'Daily Streak', value: `${streak}`, inline: true },
          { name: 'Bait', value: `${baitName} x1`, inline: true },
          { name: 'Coins', value: '💰 +1', inline: true },
          { name: 'Bounty', value: `+${passiveResult.amount.toLocaleString()} 🏴‍☠️`, inline: true },
          { name: 'Passive Bonus', value: passiveResult.multiplier > 1 ? `${Math.round((passiveResult.multiplier - 1) * 100)}% bonus` : 'None', inline: true },
          { name: 'Milestone Bonus', value: profile.milestoneContainer ? '+1 bait container' : 'None', inline: true }
        )
        .setFooter({ text: 'Claim daily every day to grow the streak and rewards.' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while claiming your daily reward.');
    }
  }
};
