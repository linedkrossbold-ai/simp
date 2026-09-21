const { EmbedBuilder } = require('discord.js');
const { ensureBaits, addBait } = require('../../database');
const { PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'givecontainers',
  aliases: ['givecontainer', 'givebaitcontainers', 'givebaitcontainer'],
  description: 'Give bait containers to a user (owner only)',
  ownerOnly: true,
  usage: '~givecontainers @user <amount>',

  async execute(message, args) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'givecontainers', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('❌ Please mention a user to give bait containers to.');
    }

    const amount = Number.parseInt(args[1], 10) || 1;
    if (!Number.isInteger(amount) || amount < 1) {
      return message.reply('❌ Please provide a valid amount.');
    }

    try {
      await ensureBaits(target.id);
      await addBait(target.id, 'bait_containers', amount);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📦 Bait Containers Given')
        .addFields(
          { name: 'User', value: `${target}`, inline: true },
          { name: 'Amount', value: `${amount} container(s)`, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to give bait containers:', error);
      await message.reply('❌ An error occurred while giving bait containers.');
    }
  }
};