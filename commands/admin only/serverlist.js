const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

module.exports = {
  name: 'serverlist',
  aliases: ['sl'],
  description: 'List the servers this bot is currently in',
  ownerOnly: true,
  usage: '~serverlist',

  async execute(message) {
    if (!(await authorizeOwnerCommand(message, { commandName: 'serverlist', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
      return;
    }

    const guilds = [...message.client.guilds.cache.values()]
      .sort((left, right) => left.name.localeCompare(right.name));

    if (guilds.length === 0) {
      return message.reply('📋 The bot is not currently in any servers.');
    }

    const lines = guilds.map((guild, index) => {
      const memberCount = Number.isInteger(guild.memberCount) ? ` | ${guild.memberCount} members` : '';
      return `**${index + 1}. ${guild.name}**\nID: \`${guild.id}\`${memberCount}`;
    });

    const embed = new EmbedBuilder()
      .setColor('#42A5F5')
      .setTitle('📋 Bot Server List')
      .setDescription(lines.join('\n\n').slice(0, 4096))
      .setFooter({ text: `${guilds.length} server(s) total` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};