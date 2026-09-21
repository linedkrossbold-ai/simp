const { EmbedBuilder } = require('discord.js');
const { ensureUser, addBounty, ensureBaits, addBait } = require('../../database');
const { PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'give',
  description: 'Give containers, bounty, or baits to a user (owner only)',
  ownerOnly: true,
  usage: '~give @user <containers|bounty|bait> <type/amount> [amount]',

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'give', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('❌ Please mention a user to give items to.');
    }

    const itemType = args[1]?.toLowerCase();
    if (!itemType || !['containers', 'bounty', 'bait'].includes(itemType)) {
      return message.reply('❌ Usage: `~give @user <containers|bounty|bait> <type/amount> [amount]`');
    }

    try {
      await ensureUser(target.id);

      if (itemType === 'containers') {
        const amount = parseInt(args[2]) || 1;
        if (isNaN(amount) || amount < 1) {
          return message.reply('❌ Please provide a valid amount.');
        }
        
        await ensureBaits(target.id);
        await addBait(target.id, 'bait_containers', amount);

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📦 Containers Given')
          .addFields(
            { name: 'User', value: `${target}`, inline: true },
            { name: 'Amount', value: `${amount} container(s)`, inline: true }
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else if (itemType === 'bounty') {
        const amount = parseInt(args[2]) || 1;
        if (isNaN(amount) || amount < 1) {
          return message.reply('❌ Please provide a valid amount.');
        }

        await addBounty(target.id, amount);

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🏴‍☠️ Bounty Given')
          .addFields(
            { name: 'User', value: `${target}`, inline: true },
            { name: 'Amount', value: `${amount} bounty`, inline: true }
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else if (itemType === 'bait') {
        const baitType = args[2]?.toLowerCase();
        const amount = parseInt(args[3]) || 1;

        if (!baitType) {
          return message.reply('❌ Please specify a bait type (e.g., common, uncommon, rare, epic, legendary, mythical, owner).');
        }

        if (isNaN(amount) || amount < 1) {
          return message.reply('❌ Please provide a valid amount.');
        }

        const baitMap = {
          common: 'common_bait',
          uncommon: 'uncommon_bait',
          rare: 'rare_bait',
          epic: 'epic_bait',
          legendary: 'legendary_bait',
          mythical: 'mythical_bait',
          owner: 'owner_bait'
        };

        const normalizedBaitType = baitMap[baitType];
        if (!normalizedBaitType) {
          return message.reply(`❌ Invalid bait type. Valid types: ${Object.keys(baitMap).join(', ')}`);
        }

        await ensureBaits(target.id);
        await addBait(target.id, normalizedBaitType, amount);

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎣 Baits Given')
          .addFields(
            { name: 'User', value: `${target}`, inline: true },
            { name: 'Bait Type', value: `${baitType.toUpperCase()}`, inline: true },
            { name: 'Amount', value: `${amount}`, inline: true }
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while giving items.');
    }
  }
};
