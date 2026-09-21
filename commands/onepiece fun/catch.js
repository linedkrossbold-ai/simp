const { EmbedBuilder } = require('discord.js');
const { ensureUser, ensureBaits, getBaits, deductBait, recordCatch, addBounty, applyBountyPassiveBonus } = require('../../database');

const SFZ_GUILD_NAME = 'sfz';
const OWNER_USER_IDS = [
  '1454114348430655530',
  '1445625395649974388'
];

const MYTHICAL_USER_IDS = [
  '1016811034767536130',
  '1466365875652264052',
  '1400119019700490290',
  '1267413301458112512',
  '1365581979420196904',
  '747815577682444382',
  '888949086756175912',
  '883279285631201281'
];

const LEGENDARY_USER_IDS = [
  '827821383417331732',
  '1484624502661976277',
  '1203862285874110486',
  '1421010797852889138',
  '1489897356840271994',
  '1212244510034235424'
];

const LEGENDARY_ROLE_IDS = [
  '1550516263346774168'
];

const EPIC_ROLE_IDS = [
  '1542441672976244736',
  '1542441489991344200',
  '1550127872222699610'
];

const RARE_ROLE_IDS = [
  '1542869688831311894',
  '1547987701909823598',
  '1540506077572108318',
  '1550734030868062218',
  '1540505990422859847',
  '1542441272231333958',
  '1540504635268137032',
  '1540750483923407030',
  '1540503976795971687',
  '1547591275417698434',
  '1538009840125739129',
  '1538009839123300363'
];

const UNCOMMON_ROLE_IDS = [
  '1538009850582401127',
  '1550868588456443964',
  '1538009851110883360',
  '1538009852322775092',
  '1538009857230250087',
  '1543332134997983312',
  '1548034498325774468',
  '1538009849416388678',
  '1547952625666883604',
  '1549614320000835695',
  '1538009858475823125',
  '1503397004653498368',
  '1538009859180593204'
];

const BAIT_PRIORITY = {
  owner_bait: 6,
  mythical_bait: 5,
  legendary_bait: 4,
  epic_bait: 3,
  rare_bait: 2,
  uncommon_bait: 1,
  common_bait: 0
};

const ROLE_BAIT_ID_LISTS = [
  { bait: 'legendary_bait', ids: LEGENDARY_ROLE_IDS },
  { bait: 'epic_bait', ids: EPIC_ROLE_IDS },
  { bait: 'rare_bait', ids: RARE_ROLE_IDS },
  { bait: 'uncommon_bait', ids: UNCOMMON_ROLE_IDS }
];

function getBaitRequirement(member) {
  if (!member || !member.id) {
    return 'common_bait';
  }

  const userBaitOverrides = [
    { bait: 'owner_bait', ids: OWNER_USER_IDS },
    { bait: 'mythical_bait', ids: MYTHICAL_USER_IDS },
    { bait: 'legendary_bait', ids: LEGENDARY_USER_IDS }
  ];
  const userOverride = userBaitOverrides.find(({ ids }) => ids.includes(member.id));
  if (userOverride) return userOverride.bait;

  const highestRole = member.roles?.highest || null;
  if (highestRole?.id) {
    for (const { bait, ids } of ROLE_BAIT_ID_LISTS) {
      if (ids.includes(highestRole.id)) {
        return bait;
      }
    }
  }

  return 'common_bait';
}

function getRequiredRoleDisplay(member) {
  if (!member || !member.roles) {
    return 'current role tier';
  }

  const highestRole = member.roles.highest || null;
  if (highestRole && highestRole.id) {
    for (const { ids } of ROLE_BAIT_ID_LISTS) {
      if (ids.includes(highestRole.id)) {
        return highestRole.name || 'current role tier';
      }
    }
  }

  return 'current role tier';
}

function getSuccessRate(baitType) {
  const rates = {
    common_bait: 0.70,
    uncommon_bait: 0.65,
    rare_bait: 0.60,
    epic_bait: 0.55,
    legendary_bait: 0.50,
    mythical_bait: 0.40,
    owner_bait: 0.30
  };
  return rates[baitType] || 0.70;
}

function getRandomBounty(baitType) {
  const bounties = {
    common_bait: [500, 750, 1000],
    uncommon_bait: [1000, 1500, 2000],
    rare_bait: [2000, 2750, 3500],
    epic_bait: [3500, 4250, 5000],
    legendary_bait: [5000, 5750, 6500],
    mythical_bait: [6000, 6500, 7000],
    owner_bait: [7000, 10000, 15000]
  };
  const options = bounties[baitType] || bounties.common_bait;
  return options[Math.floor(Math.random() * options.length)];
}

const CATCH_PASSIVE_ROLLS = {
  common_bait: { chance: 0.15, bonusPercent: 5, name: 'Common Catch Passive' },
  uncommon_bait: { chance: 0.18, bonusPercent: 8, name: 'Uncommon Catch Passive' },
  rare_bait: { chance: 0.20, bonusPercent: 10, name: 'Rare Catch Passive' },
  epic_bait: { chance: 0.24, bonusPercent: 12, name: 'Epic Catch Passive' },
  legendary_bait: { chance: 0.28, bonusPercent: 15, name: 'Legendary Catch Passive' },
  mythical_bait: { chance: 0.32, bonusPercent: 20, name: 'Mythical Catch Passive' },
  owner_bait: { chance: 0.36, bonusPercent: 30, name: 'Owner Catch Passive' }
};

function rollCatchPassiveBonus(baitType) {
  const passiveRoll = CATCH_PASSIVE_ROLLS[baitType] || CATCH_PASSIVE_ROLLS.common_bait;
  if (Math.random() >= passiveRoll.chance) {
    return null;
  }

  return passiveRoll;
}

function formatPassiveText(passives) {
  if (!passives || passives.length === 0) {
    return 'None';
  }

  return passives.map((passive) => {
    const rawName = passive.name || 'Passive';
    const shortName = rawName
      .replace(/ Catch Passive$/i, ' Passive')
      .replace(/ gives .*$/i, '')
      .replace(/\s*\(\+.*\)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (passive.bonusAmount) {
      return `${shortName || 'Passive'} (+${passive.bonusAmount.toLocaleString()})`;
    }

    if (typeof passive.bonusPercent === 'number') {
      return `${shortName || 'Passive'} (+${passive.bonusPercent}%)`;
    }

    return shortName || 'Passive';
  }).join(' • ');
}

function formatBaitLabel(baitKey) {
  return String(baitKey || 'common_bait')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/Bait\b/g, 'Bait');
}

module.exports = {
  getBaitRequirement,
  getRequiredRoleDisplay,
  formatBaitLabel,
  name: 'catch',
  description: 'Catch another Discord member using baits',
  usage: '~catch @user',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]?.replace(/[^0-9]/g, ''));
    if (!target) {
      return message.reply('❌ Please mention a member or provide their ID to catch.');
    }

    if (target.id === message.author.id) {
      return message.reply('❌ You cannot catch yourself!');
    }

    if (target.user.bot) {
      return message.reply('❌ You cannot catch bots!');
    }

    try {
      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);

      const catcherBaits = await getBaits(message.author.id);
      const requiredBait = getBaitRequirement(target);
      const baitAmount = catcherBaits[requiredBait] || 0;

      if (baitAmount < 1) {
        const baitName = formatBaitLabel(requiredBait);
        return message.reply(`❌ You don't have any ${baitName}! You need ${baitName} to catch ${target}.`);
      }

      const successRate = getSuccessRate(requiredBait);
      const success = Math.random() < successRate;

      if (success) {
        const bounty = getRandomBounty(requiredBait);
        await deductBait(message.author.id, requiredBait, 1);
        const permanentPassive = await applyBountyPassiveBonus(message.author.id, bounty, 'catch');
        const catchPassive = rollCatchPassiveBonus(requiredBait);
        const extraCatchBonus = catchPassive ? Math.floor(permanentPassive.amount * (catchPassive.bonusPercent / 100)) : 0;
        const totalBounty = permanentPassive.amount + extraCatchBonus;
        const passivePieces = [];

        if (Array.isArray(permanentPassive.passivePieces) && permanentPassive.passivePieces.length > 0) {
          passivePieces.push(...permanentPassive.passivePieces);
        } else if (permanentPassive.title) {
          passivePieces.push({
            name: permanentPassive.title,
            bonusPercent: permanentPassive.bonusPercent || Math.max(0, Math.round((permanentPassive.multiplier - 1) * 100)),
            displayText: permanentPassive.title
          });
        }

        if (catchPassive) {
          passivePieces.push({
            name: catchPassive.name,
            bonusPercent: catchPassive.bonusPercent,
            displayText: `${catchPassive.name} gives ${catchPassive.bonusPercent}% more bounty`
          });
        }

        const passiveName = passivePieces.length ? formatPassiveText(passivePieces) : 'None';
        const passiveBonus = totalBounty - bounty;

        await addBounty(message.author.id, totalBounty);
        await recordCatch(message.author.id, target.id, requiredBait, true, totalBounty, passiveName, passiveBonus);

        const requiredBaitLabel = formatBaitLabel(requiredBait);
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎣 Catch Successful!')
          .addFields(
            { name: 'Catcher', value: `${message.author}`, inline: true },
            { name: 'Caught Member', value: `${target}`, inline: true },
            { name: 'Required Bait', value: requiredBaitLabel, inline: false },
            { name: 'Passive', value: passiveName === 'None' ? 'None' : passiveName, inline: true },
            { name: '💰 Bounty Gained', value: `${totalBounty.toLocaleString()} 🏴‍☠️`, inline: true },
            { name: 'Baits Left', value: `${Math.max(0, baitAmount - 1)}`, inline: true }
          )
          .setThumbnail(target.user.displayAvatarURL())
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        await deductBait(message.author.id, requiredBait, 1);
        await recordCatch(message.author.id, target.id, requiredBait, false, 0);

        const requiredBaitLabel = formatBaitLabel(requiredBait);
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🎣 Catch Failed!')
          .addFields(
            { name: 'Catcher', value: `${message.author}`, inline: true },
            { name: 'Target', value: `${target}`, inline: true },
            { name: 'Required Bait', value: requiredBaitLabel, inline: false },
            { name: 'Baits Left', value: `${Math.max(0, baitAmount - 1)}`, inline: true }
          )
          .setThumbnail(target.user.displayAvatarURL())
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while attempting to catch the member.');
    }
  }
};
