const { PermissionFlagsBits } = require('discord.js');
const { setupTicketSystem } = require('../utils/ticketSystem');

module.exports = {
  name: 'ticketsetup',
  aliases: [],
  description: 'Create the ticket category and panel channel',
  usage: '~ticketsetup',
  requiredPermissions: [PermissionFlagsBits.ManageChannels],

  async execute(message) {
    return setupTicketSystem(message);
  }
};