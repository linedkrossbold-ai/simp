const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensureUser, ensureBaits, getBaits, addBait, getBounty, addBounty, applyBountyPassiveBonus, incrementQuestProgress, addCoins } = require('../../database');

const SESSION_TIME_MS = 10 * 60 * 1000;
const BANDIT_BATTLE_MAX_TURNS = 6;
const BANDIT_STEAL_MIN = 1500;
const BANDIT_STEAL_MAX = 3000;

function formatBounty(amount) {
  return `${amount.toLocaleString()} 🏴‍☠️`;
}

function buildDirectionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sail_north').setLabel('North').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sail_south').setLabel('South').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sail_east').setLabel('East').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sail_west').setLabel('West').setStyle(ButtonStyle.Primary)
  );
}

function buildDisabledDirectionsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sail_north').setLabel('North').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('sail_south').setLabel('South').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('sail_east').setLabel('East').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('sail_west').setLabel('West').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
}

function buildSailEmbed(author, state) {
  return new EmbedBuilder()
    .setColor(state.color)
    .setTitle('⛵ Sail the Grand Sea')
    .setDescription('Choose a direction and see what the sea brings you.')
    .addFields(
      { name: 'Position', value: `X: **${state.x}** | Y: **${state.y}**`, inline: true },
      { name: 'Last Event', value: state.lastEvent, inline: false },
      { name: 'Bounty', value: formatBounty(state.bounty), inline: true }
    )
    .setFooter({ text: `Sailing as ${author.username}` })
    .setTimestamp();
}

function getRandomLoss(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomGain(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveEncounter() {
  const roll = Math.random() * 100;

  if (roll < 0.5) {
    return {
      type: 'one_piece',
      color: '#FFD700',
      bountyChange: 100000,
      passiveSource: 'sail_one_piece',
      message: 'You found the One Piece and claimed a legendary treasure of 100,000 bounty!'
    };
  }

  if (roll < 8.5) {
    return {
      type: 'wealthy_ship',
      color: '#00C853',
      bountyChange: getRandomLoss(10000, 18000),
      passiveSource: 'sail_wealthy_ship',
      message: 'You intercepted a wealthy ship and gained a huge bounty haul.'
    };
  }

  if (roll < 22) {
    return {
      type: 'merchant',
      color: '#43A047',
      bountyChange: 5000,
      passiveSource: 'sail_merchant',
      rewardBait: 'common_bait',
      message: 'A friendly merchant rewarded you with bounty and a common bait.'
    };
  }

  if (roll < 34) {
    return {
      type: 'bandit',
      color: '#FF7043',
      message: 'Bandits ambushed your crew. Choose your move before they strike again.',
      battle: true,
      passiveSource: 'sail_bandit'
    };
  }

  if (roll < 44) {
    return {
      type: 'boat_destroyed',
      color: '#B71C1C',
      bountyChange: -getRandomLoss(1000, 2000),
      message: 'Your boat was destroyed in a brutal storm and you lost bounty in the wreck.'
    };
  }

  return {
    type: 'calm',
    color: '#4FC3F7',
    bountyChange: 0,
    message: 'The sea is calm. Nothing special happened on this trip.'
  };
}

function buildBattleRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bandit_attack').setLabel('Attack').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bandit_counter').setLabel('Counter').setStyle(ButtonStyle.Success)
  );
}

function buildDisabledBattleRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bandit_attack').setLabel('Attack').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('bandit_counter').setLabel('Counter').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
}

function resolveBanditRound(userMove) {
  const banditMove = Math.random() < 0.5 ? 'attack' : 'ignore';

  if (userMove === 'attack' && banditMove === 'ignore') {
    return { result: 'win', banditMove, text: 'Your attack lands while the bandit hesitates.' };
  }

  if (userMove === 'counter' && banditMove === 'attack') {
    return { result: 'win', banditMove, text: 'You counter the bandit attack and seize the opening.' };
  }

  if (userMove === 'attack' && banditMove === 'attack') {
    return { result: 'continue', banditMove, text: 'Your attack clashes with the bandit strike. The fight continues.' };
  }

  return { result: 'continue', banditMove, text: 'The bandit holds back while you brace yourself. The fight continues.' };
}

async function awardBanditBounty(userId, baseAmount, source = 'sail_bandit') {
  const passiveResult = await applyBountyPassiveBonus(userId, baseAmount, source);
  await addBounty(userId, passiveResult.amount);
  return passiveResult.amount;
}

async function trackQuestProgress(userId, encounterType, didWinBattle = false) {
  const questUpdates = [];

  if (encounterType === 'bandit' && didWinBattle) {
    questUpdates.push(['daily', 'bandit'], ['weekly', 'bandit']);
  }

  if (encounterType === 'merchant') {
    questUpdates.push(['daily', 'merchant'], ['weekly', 'merchant']);
  }

  if (encounterType === 'one_piece') {
    questUpdates.push(['daily', 'onepiece'], ['weekly', 'onepiece']);
  }

  await Promise.all(
    questUpdates.map(([period, questKey]) => incrementQuestProgress(userId, period, questKey, 1).catch(() => null))
  );
}

function moveShip(state, direction) {
  if (direction === 'north') state.y -= 1;
  if (direction === 'south') state.y += 1;
  if (direction === 'east') state.x += 1;
  if (direction === 'west') state.x -= 1;
}

async function applyBountyChange(userId, change, source = 'sail') {
  const current = await getBounty(userId);
  if (change < 0) {
    const loss = Math.min(current, Math.abs(change));
    if (loss > 0) {
      await addBounty(userId, -loss);
      return -loss;
    }
    return 0;
  }

  if (change > 0) {
    const passiveResult = await applyBountyPassiveBonus(userId, change, source);
    await addBounty(userId, passiveResult.amount);
    return passiveResult.amount;
  }

  return 0;
}

module.exports = {
  name: 'sail',
  aliases: ['voyage', 'ship'],
  description: 'Sail in any direction and risk random sea encounters',
  usage: '~sail',

  async execute(message) {
    try {
      if (!message.guild) {
        return message.reply('❌ This command can only be used in a server.');
      }

      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);

      const state = {
        x: 0,
        y: 0,
        bounty: await getBounty(message.author.id),
        lastEvent: 'Pick a direction to begin your voyage.',
        color: '#4FC3F7',
        finished: false,
        phase: 'travel',
        battle: null
      };

      const sailMessage = await message.reply({
        embeds: [buildSailEmbed(message.author, state)],
        components: [buildDirectionsRow()]
      });

      const collector = sailMessage.createMessageComponentCollector({ time: SESSION_TIME_MS });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: 'Only the command author can steer this boat.', ephemeral: true }).catch(() => {});
          return;
        }

        if (state.finished) {
          await interaction.reply({ content: 'This voyage has already ended.', ephemeral: true }).catch(() => {});
          return;
        }

        if (state.phase === 'battle') {
          if (!interaction.customId.startsWith('bandit_')) {
            await interaction.reply({ content: 'You are currently fighting bandits.', ephemeral: true }).catch(() => {});
            return;
          }

          const userMove = interaction.customId === 'bandit_attack' ? 'attack' : 'counter';
          const roundResult = resolveBanditRound(userMove);
          state.battle.turns += 1;
          state.color = roundResult.result === 'win' ? '#43A047' : '#FFB300';

          if (roundResult.result === 'win') {
            const baseReward = getRandomGain(BANDIT_STEAL_MIN, BANDIT_STEAL_MAX);
            const gained = await awardBanditBounty(message.author.id, baseReward, state.battle?.source || 'sail_bandit');
            await addCoins(message.author.id, 3, 'sail_bandit_victory');
            await trackQuestProgress(message.author.id, 'bandit', true);
            state.bounty = await getBounty(message.author.id);
            state.lastEvent = `Bandit battle round ${state.battle.turns}/${BANDIT_BATTLE_MAX_TURNS}: ${roundResult.text} You stole ${formatBounty(gained)}.`;
            state.phase = 'travel';
            state.battle = null;
          } else if (state.battle.turns >= BANDIT_BATTLE_MAX_TURNS) {
            state.lastEvent = `Bandit battle round ${state.battle.turns}/${BANDIT_BATTLE_MAX_TURNS}: ${roundResult.text} The fight ends in a tie.`;
            state.phase = 'travel';
            state.battle = null;
          } else {
            state.lastEvent = `Bandit battle round ${state.battle.turns}/${BANDIT_BATTLE_MAX_TURNS}: ${roundResult.text}`;
          }

          await interaction.update({
            embeds: [buildSailEmbed(message.author, state)],
            components: state.phase === 'battle' ? [buildBattleRow()] : [buildDirectionsRow()]
          });

          return;
        }

        const directionMap = {
          sail_north: 'north',
          sail_south: 'south',
          sail_east: 'east',
          sail_west: 'west'
        };

        const direction = directionMap[interaction.customId];
        if (!direction) {
          return;
        }

        moveShip(state, direction);
        const encounter = resolveEncounter();
        const appliedChange = await applyBountyChange(message.author.id, encounter.bountyChange, encounter.passiveSource || 'sail');

        // Add coin rewards based on encounter type
        if (encounter.type === 'one_piece') {
          await addCoins(message.author.id, 10, 'sail_one_piece');
        } else if (encounter.type === 'wealthy_ship') {
          const coinReward = getRandomGain(2, 5);
          await addCoins(message.author.id, coinReward, 'sail_wealthy_ship');
        } else if (encounter.type === 'merchant') {
          if (Math.random() < 0.5) {
            await addCoins(message.author.id, 1, 'sail_merchant');
          }
        }

        if (encounter.rewardBait) {
          await addBait(message.author.id, encounter.rewardBait, 1);
        }

        await trackQuestProgress(message.author.id, encounter.type, false);

        state.bounty = await getBounty(message.author.id);
        state.lastEvent = `${direction.toUpperCase()}: ${encounter.message} ${appliedChange > 0 ? `(+${formatBounty(appliedChange)})` : appliedChange < 0 ? `(-${formatBounty(Math.abs(appliedChange))})` : ''}`.trim();
        state.color = encounter.color;

        if (encounter.type === 'bandit') {
          state.phase = 'battle';
          state.battle = { turns: 0, maxTurns: BANDIT_BATTLE_MAX_TURNS, source: encounter.passiveSource || 'sail_bandit' };
          state.lastEvent = `${direction.toUpperCase()}: ${encounter.message} Round 1/${BANDIT_BATTLE_MAX_TURNS}.`;
        }

        if (encounter.type === 'one_piece' || encounter.type === 'boat_destroyed') {
          state.finished = true;
        }

        await interaction.update({
          embeds: [buildSailEmbed(message.author, state)],
          components: state.finished
            ? [buildDisabledDirectionsRow()]
            : state.phase === 'battle'
              ? [buildBattleRow()]
              : [buildDirectionsRow()]
        });

        if (state.finished) {
          collector.stop(encounter.type);
        }
      });

      collector.on('end', async () => {
        if (!state.finished && state.phase === 'battle') {
          state.lastEvent = `Bandit battle reached the session limit. The fight ends in a tie.`;
          state.phase = 'travel';
          state.battle = null;
          await sailMessage.edit({ embeds: [buildSailEmbed(message.author, state)], components: [buildDirectionsRow()] }).catch(() => {});
          return;
        }

        if (!state.finished) {
          await sailMessage.edit({ components: [buildDisabledDirectionsRow()] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error('Failed to start sail command:', error);
      await message.reply('❌ An error occurred while starting the sail command.');
    }
  }
};