const { EmbedBuilder } = require('discord.js');
const { ensureUser, getBounty, addBounty } = require('../../database');
const { PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'givebounty',
  description: 'Give bounty to yourself or another user (owner only)',
  ownerOnly: true,
  usage: '~givebounty [@user] <amount>',

  parseAmount(input) {
    if (!input || typeof input !== 'string') return 0;
    const normalized = input.replace(/,/g, '').trim().toLowerCase();
    const match = normalized.match(/^([0-9]*\.?[0-9]+)\s*([km])?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    if (Number.isNaN(value)) return 0;

    switch (match[2]) {
      case 'k':
        return Math.floor(value * 1000);
      case 'm':
        return Math.floor(value * 1000000);
      default:
        return Math.floor(value);
    }
  },

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'givebounty', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const mention = message.mentions.users.first();
    const target = mention || message.author;
    const amountArg = mention ? args.slice(1).join(' ') : args.join(' ');
    const amount = this.parseAmount(amountArg);

    if (!amount || amount < 1) {
      return message.reply('❌ Please provide a valid bounty amount. Use numbers like `1000`, `1.5k`, or `2m`.');
    }

    try {
      await ensureUser(target.id);
      await addBounty(target.id, amount);
      const totalBounty = await getBounty(target.id);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏴‍☠️ Bounty Granted')
        .addFields(
          { name: 'Target', value: `${target.tag}`, inline: true },
          { name: 'Amount Given', value: `+${amount.toLocaleString()} bounty`, inline: true },
          { name: 'New Total', value: `${totalBounty.toLocaleString()} bounty`, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error giving bounty:', error);
      await message.reply('❌ Failed to give bounty.');
    }
  }
};
