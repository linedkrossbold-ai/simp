const { EmbedBuilder } = require('discord.js');
const { ensureUser, getDailyClaimRow, getBountyPassiveProfile } = require('../../database');

function toUtcDateKey(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

module.exports = {
  name: 'dailystreak',
  aliases: ['streak', 'dailybonus', 'passive'],
  description: 'Show your daily streak and bounty passive bonus',
  usage: '~dailystreak',

  async execute(message) {
    try {
      await ensureUser(message.author.id);

      const claimRow = await getDailyClaimRow(message.author.id);
      const currentDayKey = new Date().toISOString().slice(0, 10);
      const lastClaimDayKey = toUtcDateKey(claimRow?.lastDaily);
      const isClaimedToday = lastClaimDayKey === currentDayKey;

      const streak = claimRow?.dailyStreak || 0;
      const passiveProfile = await getBountyPassiveProfile(message.author.id);
      const bonusPercent = Math.max(0, Math.round((passiveProfile.multiplier - 1) * 100));
        const passiveBonusText = passiveProfile.bonusText || (passiveProfile.displayBonusAmount != null ? `Sea Emperor (+${passiveProfile.displayBonusAmount.toLocaleString()} bounty)` : null);

      const embed = new EmbedBuilder()
        .setColor(passiveProfile.multiplier > 1 ? '#00C853' : '#4FC3F7')
        .setTitle('📈 Daily Streak & Passive Bonus')
        .addFields(
          { name: 'Current Streak', value: `${streak} day(s)`, inline: true },
          { name: 'Claimed Today', value: isClaimedToday ? 'Yes' : 'No', inline: true },
            { name: 'Passive Bonus', value: passiveProfile.title ? (passiveBonusText || `${passiveProfile.title} (+${bonusPercent}%)`) : 'None yet', inline: true },
            { name: 'Bonus Trigger', value: passiveProfile.title ? 'Unlocked by successfully catching legendary, mythical, or owner targets. Sea Emperor rewards also scale by event type.' : 'Catch legendary, mythical, or owner targets to unlock this bonus.', inline: false }
        )
        .setFooter({ text: 'Daily streaks grow from consecutive claims. Passive bonus applies to bounty rewards.' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to show daily streak status:', error);
      await message.reply('❌ An error occurred while checking your daily streak.');
    }
  }
};