const { EmbedBuilder } = require('discord.js');
const { ensureUser, getUser } = require('../../database');

module.exports = {
  name: 'coins',
  aliases: ['balance', 'wallet'],
  description: 'Check your or another member\'s coin balance',
  usage: '~coins [@user]',

  async execute(message, args) {
    try {
      const target = (message.mentions.members && message.mentions.members.first()) ||
        (message.guild && message.guild.members.cache.get(args[0]?.replace(/[^0-9]/g, ''))) ||
        (message.member || message.author);

      const userId = target.id || message.author.id;
      await ensureUser(userId);
      const user = await getUser(userId);
      const coins = user?.coins || 0;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 Coin Balance')
        .addFields(
          { name: 'User', value: `${(target.user && target.user.tag) || (message.author && message.author.tag)}`, inline: true },
          { name: 'Coins', value: `${coins}`, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await message.reply('❌ Failed to fetch coin balance.');
    }
  }
};
