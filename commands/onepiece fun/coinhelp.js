const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'coinhelp',
  description: 'Show the coin economy commands',
  usage: '~coinhelp',
  async execute(message) {
    const embed = new EmbedBuilder()
      .setColor('#F4C56E')
      .setTitle('Coin Economy')
      .setDescription('Use these commands to earn, spend, and trade coins.')
      .addFields(
        { name: 'Balance', value: '`~coins` - Check your balance\n`~coins @user` - Check another member' },
        { name: 'Earn and spend', value: '`~daily` - Claim your daily reward\n`~coinflip` - Gamble coins\n`~usecoin` - Exchange coins for rewards\n`~shop` - View the bounty shop' },
        { name: 'Trade', value: '`~paycoin @user amount` - Send coins to another member\n`~coinleaderboard` - View the richest members' }
      );
    return message.reply({ embeds: [embed] });
  }
};