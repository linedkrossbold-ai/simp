const { EmbedBuilder } = require('discord.js');
const { ensureBaits, getBaits } = require('../../database');
const { getBountyPassiveProfile } = require('../../database');

module.exports = {
  name: 'baits',
  aliases: ['inventory', 'bag'],
  description: 'Check your bait inventory or another user\'s bait inventory',
  usage: '~baits [@user|userId]',

  async execute(message, args, client) {
    try {
      const PREFIX = client?.prefix || process.env.PREFIX || '!';
      const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null) || message.author;
      const targetId = targetUser?.id || message.author.id;

      await ensureBaits(targetId);
      const [baits, passiveProfile] = await Promise.all([
        getBaits(targetId),
        getBountyPassiveProfile(targetId)
      ]);

      const passiveText = passiveProfile?.title
        ? `${passiveProfile.title}${passiveProfile.bonusAmount ? ` (+${passiveProfile.bonusAmount.toLocaleString()} bounty)` : passiveProfile.bonusPercent ? ` (+${passiveProfile.bonusPercent}%)` : ''}`
        : 'None yet';

      const baitDisplay = `
📦 **Bait Containers**: ${baits.bait_containers || 0}
🟤 **Common Bait**: ${baits.common_bait || 0}
🟦 **Uncommon Bait**: ${baits.uncommon_bait || 0}
🟥 **Rare Bait**: ${baits.rare_bait || 0}
🟪 **Epic Bait**: ${baits.epic_bait || 0}
🟨 **Legendary Bait**: ${baits.legendary_bait || 0}
⭐ **Mythical Bait**: ${baits.mythical_bait || 0}
👑 **Owner Bait**: ${baits.owner_bait || 0}
      `;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(targetId === message.author.id ? '🎣 Your Bait Inventory' : `🎣 ${targetUser.username}'s Bait Inventory`)
        .setDescription(baitDisplay)
        .addFields(
          { name: 'Passive', value: passiveText, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `Use ${PREFIX}catch @user to catch members, ${PREFIX}openbait to open bait containers, and ${PREFIX}daily to claim daily bait.` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while fetching your bait inventory.');
    }
  }
};
