const { EmbedBuilder } = require('discord.js');
const { getBountyLeaderboard } = require('../../database');

module.exports = {
  name: 'bountyleaderboard',
  aliases: ['bbl', 'bountyboard'],
  description: 'View the top users by bounty',
  usage: '~bountyleaderboard [limit]',

  async execute(message, args) {
    const limit = Math.min(parseInt(args[0]) || 10, 50);

    try {
      const leaderboard = await getBountyLeaderboard(limit);

      if (!leaderboard || leaderboard.length === 0) {
        return message.reply('📊 The bounty leaderboard is empty. Earn bounty by catching members or gambling!');
      }

      let leaderboardText = '';
      const medals = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const medal = medals[i] || `${i + 1}.`;
        try {
          const discordUser = await message.client.users.fetch(user.userId);
          leaderboardText += `${medal} **${discordUser.username}**: ${user.bounty.toLocaleString()} 🏴‍☠️\n`;
        } catch {
          leaderboardText += `${medal} **ID: ${user.userId}**: ${user.bounty.toLocaleString()} 🏴‍☠️\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Bounty Leaderboard')
        .setDescription(leaderboardText)
        .setFooter({ text: `Showing top ${limit} bounty holders` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while fetching the bounty leaderboard.');
    }
  }
};
