const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensureUser, ensureBaits, getBaits, addBait, addCoins, addBounty, deductBait, applyBountyPassiveBonus } = require('../../database');
const { createFishingState, stepFishingState } = require('../../utils/fishingGame');

const FISHING_SESSION_MS = 90 * 1000;
const FISHING_ANIMATION_FRAMES = [
  { label: '🌊', marker: '🐟' },
  { label: '🌊🌊', marker: '🐠' },
  { label: '🌊🌊🌊', marker: '🐡' }
];

function getAnimatedBoard(state, frameIndex = 0) {
  const fishMarker = FISHING_ANIMATION_FRAMES[frameIndex % FISHING_ANIMATION_FRAMES.length].marker;
  const cursorMarker = '■';
  const track = Array.from({ length: 10 }, (_, index) => {
    if (index === state.cursor) return cursorMarker;
    if (index === state.fishIndex) return fishMarker;
    return '·';
  }).join('');
  return track;
}

function buildFishingEmbed(author, state, rewardSummary = null, frameIndex = 0) {
  const bar = '█'.repeat(Math.max(0, state.progress)) + '░'.repeat(8 - Math.max(0, state.progress));
  const cursorMarker = '■';
  const triggerMarker = '⚡';
  const track = getAnimatedBoard(state, frameIndex);
  const boardPrefix = state.triggered ? `${triggerMarker} ` : '⛓ ';
  const statusText = state.caught
    ? 'Reeled in successfully.'
    : state.escaped
      ? 'The fish swam away.'
      : state.triggered
        ? 'Bait triggered — keep the cursor on the fish.'
        : 'Waiting for bait to trigger…';

  return new EmbedBuilder()
    .setColor(state.caught ? '#43A047' : state.escaped ? '#E53935' : '#1E88E5')
    .setTitle(state.caught ? '🎣 Catch Success!' : state.escaped ? '🎣 Fish Escaped!' : '🎣 Fishing Mini-Game')
    .setDescription(state.caught
      ? 'You kept the square on the fish long enough to reel it in.'
      : state.escaped
        ? 'The fish swam away after you lost the progression bar.'
        : 'Use the buttons to move the square and stay centered on the fish. Missing it drains your progress bar.')
    .addFields(
      { name: 'Progress', value: `**${bar}** (${state.progress}/8)`, inline: false },
      { name: 'Board', value: `${boardPrefix}${track}`, inline: false },
      { name: 'Wave', value: FISHING_ANIMATION_FRAMES[frameIndex % FISHING_ANIMATION_FRAMES.length].label, inline: true },
      { name: 'Status', value: statusText, inline: false }
    )
    .setFooter({ text: rewardSummary ? `Rewards: ${rewardSummary}` : `Fishing as ${author.username}` })
    .setTimestamp();
}

function buildFishingRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fish_left').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(state.caught || state.escaped),
    new ButtonBuilder().setCustomId('fish_hold').setLabel('Hold').setStyle(ButtonStyle.Success).setDisabled(state.caught || state.escaped),
    new ButtonBuilder().setCustomId('fish_right').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(state.caught || state.escaped)
  );
}

function buildRewardSummary(rewardTotals) {
  const lines = [];
  const baitOrder = ['common_bait', 'uncommon_bait', 'rare_bait', 'epic_bait', 'legendary_bait', 'mythical_bait', 'owner_bait'];
  for (const baitType of baitOrder) {
    if ((rewardTotals[baitType] || 0) > 0) {
      lines.push(`${baitType.replace('_', ' ').toUpperCase()} x${rewardTotals[baitType]}`);
    }
  }
  if ((rewardTotals.bait_containers || 0) > 0) lines.push(`CONTAINERS x${rewardTotals.bait_containers}`);
  if ((rewardTotals.coins || 0) > 0) lines.push(`COINS +${rewardTotals.coins}`);
  if ((rewardTotals.bounty || 0) > 0) lines.push(`BOUNTY +${rewardTotals.bounty}`);
  return lines.join(' • ');
}

function getFishingRewards() {
  const rewardRoll = Math.random() * 100;
  const rewards = [];
  if (rewardRoll < 100) rewards.push({ type: 'common_bait', chance: 100 });
  if (Math.random() * 100 < 15) rewards.push({ type: 'uncommon_bait', chance: 15 });
  if (Math.random() * 100 < 8) rewards.push({ type: 'rare_bait', chance: 8 });
  if (Math.random() * 100 < 4) rewards.push({ type: 'epic_bait', chance: 4 });
  if (Math.random() * 100 < 2) rewards.push({ type: 'legendary_bait', chance: 2 });
  if (Math.random() * 100 < 1) rewards.push({ type: 'mythical_bait', chance: 1 });
  if (Math.random() * 100 < 30) rewards.push({ type: 'bait_containers', chance: 30 });
  if (Math.random() * 100 < 20) rewards.push({ type: 'coins', amount: 3 + Math.floor(Math.random() * 8), chance: 20 });
  return rewards;
}

module.exports = {
  name: 'fish',
  aliases: ['fishing'],
  description: 'Fish with a bait container and play a timing mini-game to catch a fish',
  usage: '~fish',

  async execute(message) {
    try {
      if (!message.guild) {
        return message.reply('❌ This command can only be used in a server.');
      }

      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);
      const baits = await getBaits(message.author.id);
      if (!baits || baits.bait_containers < 1) {
        return message.reply('❌ You need at least 1 bait container to fish.');
      }

      const state = createFishingState({ progress: 4, fishIndex: 4, cursor: 4, triggered: false, caught: false, escaped: false, turn: 0 });
      const fishingMessage = await message.reply({ embeds: [buildFishingEmbed(message.author, state)], components: [buildFishingRow(state)] });

      const collector = fishingMessage.createMessageComponentCollector({ time: FISHING_SESSION_MS, dispose: true });
      let currentState = state;
      let frameIndex = 0;
      const animationTimer = setInterval(() => {
        if (currentState.caught || currentState.escaped) {
          clearInterval(animationTimer);
          return;
        }
        frameIndex += 1;
        fishingMessage.edit({ embeds: [buildFishingEmbed(message.author, currentState, null, frameIndex)] }).catch(() => {});
      }, 900);

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: 'Only the command author can play this fishing game.', ephemeral: true }).catch(() => {});
          return;
        }

        if (currentState.caught || currentState.escaped) {
          await interaction.reply({ content: 'This fishing session is already over.', ephemeral: true }).catch(() => {});
          return;
        }

        const action = interaction.customId === 'fish_left' ? 'move_left' : interaction.customId === 'fish_right' ? 'move_right' : 'hold';
        currentState = stepFishingState(currentState, { action });

        if (currentState.escaped) {
          clearInterval(animationTimer);
          await interaction.update({ embeds: [buildFishingEmbed(message.author, currentState, null, frameIndex)], components: [buildFishingRow(currentState)] });
          collector.stop('escaped');
          return;
        }

        if (currentState.caught) {
          const rewardBounty = 500 + Math.floor(Math.random() * 1000);
          const rewardTotals = {
            common_bait: 0,
            uncommon_bait: 0,
            rare_bait: 0,
            epic_bait: 0,
            legendary_bait: 0,
            mythical_bait: 0,
            owner_bait: 0,
            bait_containers: 0,
            coins: 0,
            bounty: 0
          };
          const passiveResult = await applyBountyPassiveBonus(message.author.id, rewardBounty, 'catch');
          rewardTotals.bounty = passiveResult.amount;
          const treasureRewards = getFishingRewards();
          for (const reward of treasureRewards) {
            if (reward.type === 'coins') {
              rewardTotals.coins += reward.amount || 0;
            } else if (reward.type === 'bait_containers') {
              rewardTotals.bait_containers += 1;
            } else {
              rewardTotals[reward.type] = (rewardTotals[reward.type] || 0) + 1;
            }
          }
          rewardTotals.common_bait += 1;
          await deductBait(message.author.id, 'bait_containers', 1);
          await addCoins(message.author.id, rewardTotals.coins, 'fishing_catch');
          await addBounty(message.author.id, rewardTotals.bounty);
          for (const [baitType, amount] of Object.entries(rewardTotals)) {
            if (baitType === 'bounty' || baitType === 'coins' || baitType === 'bait_containers') continue;
            if (amount > 0) await addBait(message.author.id, baitType, amount);
          }
          if (rewardTotals.bait_containers > 0) {
            await addBait(message.author.id, 'bait_containers', rewardTotals.bait_containers);
          }
          const rewardText = buildRewardSummary(rewardTotals) || 'No extra rewards';
          clearInterval(animationTimer);
          await interaction.update({ embeds: [buildFishingEmbed(message.author, currentState, rewardText, frameIndex)], components: [buildFishingRow(currentState)] });
          await fishingMessage.reply(`🎣 Catch success! ${rewardText}.`).catch(() => {});
          collector.stop('caught');
          return;
        }

        await interaction.update({ embeds: [buildFishingEmbed(message.author, currentState, null, frameIndex)], components: [buildFishingRow(currentState)] });
      });

      collector.on('end', async () => {
        clearInterval(animationTimer);
        if (!currentState.caught && !currentState.escaped) {
          await fishingMessage.edit({ embeds: [buildFishingEmbed(message.author, { ...currentState, escaped: true }, null, frameIndex)], components: [buildFishingRow({ ...currentState, escaped: true })] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error('Failed to start fishing mini-game:', error);
      await message.reply('❌ An error occurred while starting the fishing mini-game.');
    }
  }
};
