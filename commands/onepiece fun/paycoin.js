const { EmbedBuilder } = require('discord.js');
const { ensureUser, transferCoins, getUser } = require('../../database');

module.exports = {
  name: 'paycoin',
  aliases: ['paycoins', 'pay'],
  description: 'Pay coins to another member',
  usage: '~paycoin @user <amount>',

  async execute(message, args = []) {
    if (!message.guild) return message.reply('❌ This command can only be used in a server.');

    const target = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    const amountArg = message.mentions.users.first() ? args[1] : args[0];

    if (!target) return message.reply('❌ Please mention a user or provide their ID to pay coins to.');

    const amount = Number.parseInt(amountArg, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return message.reply('❌ Please provide a valid positive amount of coins to transfer.');
    }

    if (target.id === message.author.id) {
      return message.reply('❌ You cannot pay coins to yourself.');
    }

    try {
      await ensureUser(message.author.id);
      await ensureUser(target.id);

      const sender = await getUser(message.author.id);
      const senderCoins = sender?.coins || 0;
      if (senderCoins < amount) {
        return message.reply(`❌ You do not have enough coins. Your balance: ${senderCoins.toLocaleString()}`);
      }

      const ok = await transferCoins(message.author.id, target.id, amount, `user_pay:${message.author.id}`);
      if (!ok) {
        return message.reply('❌ Transfer failed — insufficient funds or a database error.');
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD54F')
        .setTitle('🪙 Coins Transferred')
        .setDescription(`${message.author} paid **${amount.toLocaleString()}** coin(s) to ${target}.`)
        .addFields(
          { name: 'From', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'To', value: `${target.tag} (${target.id})`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('paycoin error:', err);
      return message.reply('❌ An error occurred while processing the transfer.');
    }
  }
};
