const { EmbedBuilder } = require('discord.js');
const { getBounty, ensureUser } = require('../../database');

function getAvatarUrl(user) {
  return user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || user?.defaultAvatarURL || null;
}

module.exports = {
  name: 'bounty',
  description: 'Check your bounty balance',
  usage: '~bounty [@user]',

  async execute(message, args) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      await ensureUser(targetUser.id);
      const bountyAmount = await getBounty(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🏴‍☠️ Bounty - ${targetUser.username}`)
        .addFields(
          { name: 'Total Bounty', value: `${bountyAmount.toLocaleString()} 🏴‍☠️`, inline: true }
        )
        .setThumbnail(getAvatarUrl(targetUser))
        .setFooter({ text: 'Earn bounty by catching members with baits!' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while checking bounty.');
    }
  }
};
