const { EmbedBuilder } = require('discord.js');
const { getCaughtTargets } = require('../../database');

module.exports = {
  name: 'caught',
  aliases: ['catchhistory', 'caughtlist'],
  description: 'View all people you have successfully caught',
  usage: '~caught',

  async execute(message) {
    const targetUser = message.author;

    try {
      const targets = await getCaughtTargets(targetUser.id);

      if (!targets || targets.length === 0) {
        return message.reply('📜 You have not caught anyone yet.');
      }

      const fetchedUsers = await Promise.all(
        targets.map((entry) => message.client.users.fetch(entry.targetId).catch(() => null))
      );

      let catchText = targets.map((entry, index) => {
        const target = fetchedUsers[index];
        const targetName = target ? target.username : entry.targetId;
        const time = entry.lastCaught ? new Date(entry.lastCaught).toLocaleString() : 'Unknown time';
        const baitUsed = entry.baitUsed ? entry.baitUsed.replace('_', ' ').toUpperCase() : 'Unknown bait';
        const passiveText = entry.passiveName ? `Yes - ${entry.passiveName}${entry.passiveBonus ? ` (+${entry.passiveBonus.toLocaleString()} bounty)` : ''}` : 'No';
        return `**${index + 1}.** **${targetName}** • Bait: **${baitUsed}** • Passive: **${passiveText}** • Last caught: ${time}`;
      }).join('\n');

      if (catchText.length > 1024) {
        catchText = catchText.slice(0, 1020) + '...';
      }

      const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle(`🎣 People Caught by ${targetUser.username}`)
        .setDescription(catchText)
        .setFooter({ text: `Total unique people caught: ${targets.length}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while fetching your caught list.');
    }
  }
};
