const { EmbedBuilder } = require('discord.js');
const { getCaughtTargets, releaseCaughtTarget } = require('../../database');

module.exports = {
  name: 'release',
  aliases: ['free', 'unrelease', 'releasecaught', 'freecaught'],
  description: 'Release a caught member or release all caught members',
  usage: '~release @user|all',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const targetArg = String(args[0] || '').toLowerCase();
    if (!targetArg) {
      return message.reply('❌ Usage: `~release @user|all`');
    }

    try {
      if (targetArg === 'all') {
        const caughtTargets = await getCaughtTargets(message.author.id);
        if (!caughtTargets.length) {
          return message.reply('📜 You do not have any caught members to release.');
        }

        let releasedCount = 0;
        for (const entry of caughtTargets) {
          releasedCount += await releaseCaughtTarget(message.author.id, entry.targetId);
        }

        const embed = new EmbedBuilder()
          .setColor('#00BFFF')
          .setTitle('🕊️ All Caught Members Released')
          .setDescription(`You released **${releasedCount}** caught member record(s).`)
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      const target = message.mentions.users.first();
      if (!target) {
        return message.reply('❌ Please mention a member or provide their ID to release, or use `all`.');
      }

      const released = await releaseCaughtTarget(message.author.id, target.id);
      if (!released) {
        return message.reply('❌ That member is not currently in your caught list.');
      }

      const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle('🕊️ Member Released')
        .setDescription(`You released ${target} from your caught list.`)
        .addFields({ name: 'Released Records', value: `${released}`, inline: true })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to release caught member:', error);
      return message.reply('❌ An error occurred while releasing the caught member.');
    }
  }
};