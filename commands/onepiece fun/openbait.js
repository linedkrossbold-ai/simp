const { EmbedBuilder } = require('discord.js');
const { ensureUser, ensureBaits, getBaits, addBait, addBounty, deductBait, applyBountyPassiveBonus, addCoins } = require('../../database');

function openBait() {
  const bountyReward = Math.floor(Math.random() * 1500) + 500;
  const rewards = [
    { type: 'common_bait', chance: 100 },
    { type: 'bounty', amount: bountyReward, chance: 100 }
  ];

  // Random other baits
  const randomBaits = [
    { type: 'uncommon_bait', chance: 15 },
    { type: 'rare_bait', chance: 8 },
    { type: 'epic_bait', chance: 4 },
    { type: 'legendary_bait', chance: 2 },
    { type: 'mythical_bait', chance: 1 }
  ];

  for (const bait of randomBaits) {
    if (Math.random() * 100 < bait.chance) {
      rewards.push({ type: bait.type, chance: bait.chance });
    }
  }

  return rewards;
}

function parseOpenAmount(input, available) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) {
    return 1;
  }

  if (value === 'all') {
    return available;
  }

  const amount = Number.parseInt(value, 10);
  if (!Number.isInteger(amount) || amount < 1) {
    return null;
  }

  return amount;
}

function summarizeRewards(rewardTotals) {
  const lines = [];
  const baitOrder = ['common_bait', 'uncommon_bait', 'rare_bait', 'epic_bait', 'legendary_bait', 'mythical_bait', 'owner_bait'];

  for (const baitType of baitOrder) {
    const amount = rewardTotals[baitType] || 0;
    if (amount > 0) {
      lines.push(`• ${baitType.replace('_', ' ').toUpperCase()} x${amount}`);
    }
  }

  if ((rewardTotals.bounty || 0) > 0) {
    lines.push(`• BOUNTY +${rewardTotals.bounty.toLocaleString()} 🏴‍☠️`);
  }

  if ((rewardTotals.coins || 0) > 0) {
    lines.push(`• COINS 💰 +${rewardTotals.coins}`);
  }

  return lines.length ? lines.join('\n') : 'No additional rewards';
}

module.exports = {
  name: 'openbait',
  aliases: ['open'],
  description: 'Open one or more bait containers and receive guaranteed common bait plus additional bait rewards',
  usage: '~openbait [amount|all]',

  async execute(message, args) {
    try {
      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);
      const baits = await getBaits(message.author.id);

      if (!baits || baits.bait_containers < 1) {
        return message.reply('❌ You need at least 1 bait container to open!');
      }

      const openAmount = parseOpenAmount(args[0], baits.bait_containers);
      if (!openAmount) {
        return message.reply('❌ Please use a valid amount or `all`.');
      }

      if (openAmount > baits.bait_containers) {
        return message.reply(`❌ You only have ${baits.bait_containers} bait container(s).`);
      }

      await deductBait(message.author.id, 'bait_containers', openAmount);

      const rewardTotals = {
        common_bait: 0,
        uncommon_bait: 0,
        rare_bait: 0,
        epic_bait: 0,
        legendary_bait: 0,
        mythical_bait: 0,
        owner_bait: 0,
        bounty: 0,
        coins: openAmount
      };

      for (let index = 0; index < openAmount; index += 1) {
        const rewards = openBait();

        for (const reward of rewards) {
          if (reward.type === 'bounty') {
            const passiveResult = await applyBountyPassiveBonus(message.author.id, reward.amount, 'container');
            rewardTotals.bounty += passiveResult.amount;
            continue;
          }

          rewardTotals[reward.type] = (rewardTotals[reward.type] || 0) + 1;
        }
      }

      if (rewardTotals.bounty > 0) {
        await addBounty(message.author.id, rewardTotals.bounty);
      }

      if (rewardTotals.coins > 0) {
        await addCoins(message.author.id, rewardTotals.coins, 'container_opened');
      }

      const baitTypes = ['common_bait', 'uncommon_bait', 'rare_bait', 'epic_bait', 'legendary_bait', 'mythical_bait', 'owner_bait'];
      for (const baitType of baitTypes) {
        const amount = rewardTotals[baitType] || 0;
        if (amount > 0) {
          await addBait(message.author.id, baitType, amount);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(openAmount === 1 ? '🎁 Bait Container Opened!' : `🎁 ${openAmount} Bait Containers Opened!`)
        .setDescription(`You opened ${openAmount} bait container${openAmount === 1 ? '' : 's'} and received:`)
        .addFields(
          { name: 'Rewards', value: summarizeRewards(rewardTotals), inline: false },
          { name: 'Containers Left', value: `${Math.max(0, baits.bait_containers - openAmount)}`, inline: true }
        )
        .setFooter({ text: 'Use !openbait [amount|all] to open multiple containers at once.' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while opening the bait container.');
    }
  }
};
