const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ensureUser, getUser, transferCoins } = require('../../database');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'coinflip',
  aliases: ['cf'],
  description: 'Challenge another user to a coinflip. Winner takes the amount from loser.',
  usage: '~coinflip @user <amount>',

  async execute(message, args) {
    if (!message.guild) return message.reply('❌ This command can only be used in a server.');

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]?.replace(/[^0-9]/g, ''));
    if (!target) return message.reply('❌ Please mention a member or provide their ID to challenge.');
    if (target.id === message.author.id) return message.reply('❌ You cannot coinflip yourself.');

    const amount = Math.max(1, parseInt(args[1] || '1', 10));
    if (!Number.isFinite(amount) || amount <= 0) return message.reply('❌ Invalid amount.');

    try {
      await ensureUser(message.author.id);
      await ensureUser(target.id);

      const challenger = await getUser(message.author.id);
      const opponent = await getUser(target.id);

      if ((challenger.coins || 0) < amount) return message.reply('❌ You do not have enough coins to challenge that amount.');
      if ((opponent.coins || 0) < amount) return message.reply('❌ The target does not have enough coins to accept that amount.');

      // Require the target to confirm the challenge by replying 'yes'
      // Send a challenge embed
      const challengeEmbed = new EmbedBuilder()
          .setColor('#E8C547')
        .setTitle('🪙 Coinflip Challenge')
          .setDescription(`${message.author} challenged ${target} to a duel!\n\n**Bet:** ${amount.toLocaleString()} coins\n**Win chance:** 50% each`)
          .addFields({ name: 'Will you accept?', value: `Reply directly to this message with \`accept\` or \`deny\`.` })
          .setFooter({ text: 'Only the challenged member can answer this duel.' })
        .setTimestamp();

        const challengeMessage = await message.reply({ embeds: [challengeEmbed] }).catch(() => null);
        if (!challengeMessage) return null;

      // Wait for response from target
      let confirmMsg = null;
      try {
          const collected = await message.channel.awaitMessages({
            filter: (m) => m.author.id === target.id
              && m.reference?.messageId === challengeMessage.id
              && /^(?:accept|deny)$/i.test(m.content.trim()),
            max: 1,
            time: 30000,
            errors: ['time']
          });
        const response = collected.first().content.trim().toLowerCase();
        if (/^deny$/.test(response)) {
          return message.reply(`${target.user.tag} declined the coinflip.`);
        }
      } catch (err) {
        return message.reply('❌ Challenge not accepted (timeout).');
      }

      // Countdown timer before revealing result
      const countdownEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🪙 Coinflip Result');
      
      for (let i = 5; i >= 1; i--) {
        countdownEmbed
          .setFields({ name: 'Flipping...', value: `**${i}**`, inline: false })
          .setTimestamp();
        
        if (!confirmMsg) {
          confirmMsg = await message.reply({ embeds: [countdownEmbed] }).catch(() => null);
        } else {
          await confirmMsg.edit({ embeds: [countdownEmbed] }).catch(() => null);
        }
        
        // Wait 1 second before next countdown
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Random winner
      const challengerWins = Math.random() < 0.5;
      const winner = challengerWins ? message.author : target.user;
      const loser = challengerWins ? target.user : message.author;

      const transferred = await transferCoins(loser.id, winner.id, amount, 'coinflip');
      if (!transferred) return message.reply('❌ Transfer failed (insufficient funds).');

      const resultEmbed = new EmbedBuilder()
        .setColor(challengerWins ? '#00FF00' : '#FF0000')
        .setTitle('🪙 Coinflip Result')
        .addFields(
          { name: 'Winner', value: `${winner.tag}`, inline: true },
          { name: 'Loser', value: `${loser.tag}`, inline: true },
          { name: 'Amount', value: `${amount}`, inline: true }
        )
        .setTimestamp();

      return confirmMsg.edit({ embeds: [resultEmbed] }).catch(() => message.reply({ embeds: [resultEmbed] }));
    } catch (error) {
      console.error(error);
      return message.reply('❌ Failed to process coinflip.');
    }
  }
};
