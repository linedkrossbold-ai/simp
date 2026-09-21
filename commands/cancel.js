const { isTicketChannel, hasTicketSupportRole, cancelTicketClosure, hasPendingTicketClosure, logTicketEvent } = require('../utils/ticketSystem');

module.exports = {
  name: 'cancel',
  aliases: ['cancelclose'],
  description: 'Cancel a pending ticket close countdown',
  usage: '~cancel',

  async execute(message) {
    if (!message.guild || !isTicketChannel(message.channel)) {
      return message.reply('❌ This command can only be used inside an active ticket channel.');
    }

    if (!hasTicketSupportRole(message.member)) {
      return message.reply('❌ Only members with the general support role can cancel the ticket close countdown.');
    }

    if (!hasPendingTicketClosure(message.channel) || !cancelTicketClosure(message.channel)) {
      return message.reply('❌ This ticket does not have an active close countdown.');
    }

    await logTicketEvent(message.guild, `Ticket close cancelled by ${message.author} for ${message.channel}.`);
    return message.reply('✅ Ticket closing cancelled.');
  }
};