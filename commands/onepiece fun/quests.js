const { EmbedBuilder } = require('discord.js');
const { getQuestProgress, claimQuestReward } = require('../../database');

const QUEST_DEFINITIONS = {
  daily: {
    bandit: { label: 'Defeat 5 bandits', required: 5, reward: 67000, progressLabel: 'Bandits defeated' },
    merchant: { label: 'Encounter 10 merchants', required: 10, reward: 50000, progressLabel: 'Merchants encountered' },
    onepiece: { label: 'Encounter the One Piece 1 time', required: 1, reward: 100000, progressLabel: 'One Piece encounters' }
  },
  weekly: {
    bandit: { label: 'Defeat 100 bandits', required: 100, reward: 200000, progressLabel: 'Bandits defeated' },
    merchant: { label: 'Encounter 100 merchants', required: 100, reward: 300000, progressLabel: 'Merchants encountered' },
    onepiece: { label: 'Encounter the One Piece 10 times', required: 10, reward: 500000, progressLabel: 'One Piece encounters' }
  }
};

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function buildQuestLine(period, questKey, state) {
  const quest = QUEST_DEFINITIONS[period][questKey];
  const count = Number.parseInt(state?.[`${period}${capitalize(questKey)}Count`], 10) || 0;
  const claimed = Number.parseInt(state?.[`${period}${capitalize(questKey)}Claimed`], 10) || 0;
  const percent = Math.min(100, Math.floor((count / quest.required) * 100));
  const status = claimed > 0 ? 'Claimed' : count >= quest.required ? 'Ready to claim' : 'In progress';
  return `**${quest.label}**\n${quest.progressLabel}: **${count}/${quest.required}** (${percent}%)\nReward: **${quest.reward.toLocaleString()} bounty**\nStatus: **${status}**`;
}

function buildQuestEmbed(user, state) {
  return new EmbedBuilder()
    .setColor('#4DB6AC')
    .setTitle(`📜 Quests - ${user.username}`)
    .setDescription('Complete sailing encounters to progress daily and weekly quests. Claim rewards here when they are ready.')
    .addFields(
      { name: 'Daily Quests', value: [
        buildQuestLine('daily', 'bandit', state),
        buildQuestLine('daily', 'merchant', state),
        buildQuestLine('daily', 'onepiece', state)
      ].join('\n\n'), inline: false },
      { name: 'Weekly Quests', value: [
        buildQuestLine('weekly', 'bandit', state),
        buildQuestLine('weekly', 'merchant', state),
        buildQuestLine('weekly', 'onepiece', state)
      ].join('\n\n'), inline: false },
      { name: 'Claim Command', value: '`~quests claim <daily|weekly> <bandit|merchant|onepiece|all>`', inline: false }
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: 'Quest progress resets automatically every day and every week.' })
    .setTimestamp();
}

async function claimSingleQuest(message, period, questKey) {
  const quest = QUEST_DEFINITIONS[period]?.[questKey];
  if (!quest) {
    return message.reply('❌ Unknown quest. Use `bandit`, `merchant`, or `onepiece` for `daily` or `weekly`.');
  }

  const result = await claimQuestReward(message.author.id, period, questKey, quest);
  if (!result.ok) {
    if (result.reason === 'claimed') {
      return message.reply('❌ That quest has already been claimed for this period.');
    }

    if (result.reason === 'incomplete') {
      return message.reply(`❌ You have not completed **${quest.label}** yet.`);
    }

    return message.reply('❌ That quest is not available yet.');
  }

  return message.reply(`✅ You claimed **${quest.reward.toLocaleString()} bounty** for **${quest.label}**.`);
}

module.exports = {
  name: 'quests',
  aliases: ['quest'],
  description: 'View and claim daily and weekly sailing quests',
  usage: '~quests [claim <daily|weekly> <bandit|merchant|onepiece|all>] ',

  async execute(message, args) {
    try {
      const state = await getQuestProgress(message.author.id);

      if (String(args[0] || '').toLowerCase() === 'claim') {
        const period = String(args[1] || '').toLowerCase();
        if (!QUEST_DEFINITIONS[period]) {
          return message.reply('❌ Please choose `daily` or `weekly`.');
        }

        const target = String(args[2] || '').toLowerCase();
        if (!target) {
          return message.reply('❌ Please choose `bandit`, `merchant`, `onepiece`, or `all`.');
        }

        if (target === 'all') {
          const claimOrder = ['bandit', 'merchant', 'onepiece'];
          const results = [];
          for (const questKey of claimOrder) {
            const quest = QUEST_DEFINITIONS[period][questKey];
            const count = Number.parseInt(state?.[`${period}${capitalize(questKey)}Count`], 10) || 0;
            const claimed = Number.parseInt(state?.[`${period}${capitalize(questKey)}Claimed`], 10) || 0;
            if (count >= quest.required && claimed === 0) {
              const claimResult = await claimQuestReward(message.author.id, period, questKey, quest);
              if (claimResult.ok) {
                results.push(`✅ ${quest.label}: +${quest.reward.toLocaleString()} bounty`);
              }
            }
          }

          if (results.length === 0) {
            return message.reply('❌ There were no completed quests ready to claim.');
          }

          return message.reply(results.join('\n'));
        }

        return claimSingleQuest(message, period, target);
      }

      const embed = buildQuestEmbed(message.author, state);
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to show or claim quests:', error);
      await message.reply('❌ An error occurred while handling quests.');
    }
  }
};
