const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addWatchedUser, removeWatchedUser, isWatchedUser } = require('../utils/pingWatch');
const { authorizeOwnerCommand } = require('../utils/owner');

module.exports = {
  name: 'ping',
  aliases: ['watchping', 'pingwatch'],
  description: 'Watch a user so the bot pings them whenever they send a message',
  usage: '~ping @user',
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message, args) {
    try {
      if (!(await authorizeOwnerCommand(message, { commandName: 'ping', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
        return;
      }

      const target = message.mentions.users.first();
      if (!target) {
        return message.reply('❌ Please mention a user to watch.');
      }

      if (target.id === message.author.id) {
        return message.reply('❌ You cannot watch yourself.');
      }

      const currentState = isWatchedUser(target.id);
      if (currentState) {
        removeWatchedUser(target.id);
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('👀 Ping Watch Removed')
          .setDescription(`${target} is no longer being watched.`);
        return message.reply({ embeds: [embed] });
      }

      addWatchedUser(target.id);
      const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('👀 Ping Watch Added')
        .setDescription(`${target} will now be pinged by the bot whenever they send a message.`);
      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply('❌ An error occurred while managing the ping watch.');
    }
  }
};
