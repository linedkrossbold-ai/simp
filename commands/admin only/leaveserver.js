const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

function getProtectedGuildId(message) {
  return process.env.PROTECTED_GUILD_ID || process.env.MAIN_GUILD_ID || process.env.HOME_GUILD_ID || message.guild?.id || null;
}

module.exports = {
  name: 'leaveserver',
  aliases: ['ls'],
  description: 'Remove the bot from a server by ID after explicit confirmation',
  ownerOnly: true,
  usage: '~leaveserver <guild-id> confirm',

  async execute(message, args = []) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'leaveserver', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const guildId = String(args[0] || '').trim();
    const confirmed = String(args[1] || '').trim().toLowerCase() === 'confirm';

    if (!/^\d{17,20}$/.test(guildId) || !confirmed) {
      return message.reply('❌ Usage: `~leaveserver <guild-id> confirm`\nThe guild ID and the word `confirm` are both required.');
    }

    const protectedGuildId = getProtectedGuildId(message);
    if (guildId === protectedGuildId) {
      return message.reply('🛡️ I will not leave the protected server.');
    }

    const targetGuild = message.client.guilds.cache.get(guildId);
    if (!targetGuild) {
      return message.reply('❌ I am not currently in a server with that ID. Use `~serverlist` first.');
    }

    try {
      const targetName = targetGuild.name;
      await targetGuild.leave();

      const embed = new EmbedBuilder()
        .setColor('#FF7043')
        .setTitle('🚪 Left Server')
        .setDescription(`I left **${targetName}**.`)
        .addFields({ name: 'Guild ID', value: `\`${guildId}\``, inline: true })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(`Failed to leave guild ${guildId}:`, error);
      return message.reply('❌ I could not leave that server.');
    }
  }
};