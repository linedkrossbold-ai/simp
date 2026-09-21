const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { getCoinsLeaderboard } = require('../../database');

function buildLeaderboardEmbed(entries, page, totalPages) {
  const lines = [];
  const medals = ['🥇', '🥈', '🥉'];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const medal = medals[index] || `${page * 10 + index + 1}.`;
    lines.push(`${medal} <@${entry.userId}>: ${entry.coins.toLocaleString()} 🪙`);
  }

  return new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🪙 Coin Leaderboard')
    .setDescription(lines.join('\n') || 'No coin holders yet.')
    .setFooter({ text: `Page ${page + 1}/${totalPages}` })
    .setTimestamp();
}

module.exports = {
  name: 'coinleaderboard',
  aliases: ['coinboard', 'coinsleaderboard'],
  description: 'View the top users by coin balance with paged navigation',
  usage: '~coinleaderboard',

  async execute(message, args) {
    try {
      const requestedPage = Number.parseInt(args[0], 10);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0;

      const leaderboard = await getCoinsLeaderboard(100);
      if (!leaderboard || leaderboard.length === 0) {
        return message.reply('📊 The coin leaderboard is empty. Start earning coins to appear here!');
      }

      const pageSize = 10;
      const totalPages = Math.max(1, Math.ceil(leaderboard.length / pageSize));
      const safePage = Math.min(page, totalPages - 1);
      const pageEntries = leaderboard.slice(safePage * pageSize, safePage * pageSize + pageSize);
      const embed = buildLeaderboardEmbed(pageEntries, safePage, totalPages);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('coin_lb_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),
        new ButtonBuilder()
          .setCustomId('coin_lb_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages - 1)
      );

      const response = await message.reply({ embeds: [embed], components: [row] });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: 'Only the command author can change pages.', ephemeral: true });
          return;
        }

        const nextPage = interaction.customId === 'coin_lb_next' ? safePage + 1 : safePage - 1;
        const clampedPage = Math.max(0, Math.min(nextPage, totalPages - 1));
        const nextEntries = leaderboard.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);
        const nextEmbed = buildLeaderboardEmbed(nextEntries, clampedPage, totalPages);

        const nextRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('coin_lb_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(clampedPage === 0),
          new ButtonBuilder()
            .setCustomId('coin_lb_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(clampedPage >= totalPages - 1)
        );

        await interaction.update({ embeds: [nextEmbed], components: [nextRow] });
      });

      collector.on('end', async () => {
        try {
          await response.edit({ components: [] }).catch(() => {});
        } catch (error) {
          console.error(error);
        }
      });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while fetching the coin leaderboard.');
    }
  }
};
