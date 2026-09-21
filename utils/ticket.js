const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { createTicket, setupTicketSystem, getTicketStatus, renameTicket, requestTicketClosure } = require('./ticketSystem');

function buildTicketMessage(interaction) {
  return {
    author: interaction.user,
    client: interaction.client,
    guild: interaction.guild,
    member: interaction.member,
    channel: interaction.channel,
    content: interaction.options.getString('name') || '',
    setupChannel: interaction.options.getChannel('channel'),
    reply: (payload) => interaction.deferred || interaction.replied ? interaction.editReply(payload) : interaction.reply(payload)
  };
}

module.exports = {
  name: 'ticket',
  aliases: ['support', 'help-ticket', 'tr'],
  description: 'Create a private support ticket',
  usage: '~ticket <create|setup|status|close|rename <name>>',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create and manage private support tickets')
    .addSubcommand((subcommand) => subcommand
      .setName('create')
      .setDescription('Create a private support ticket'))
    .addSubcommand((subcommand) => subcommand
      .setName('setup')
      .setDescription('Post the support ticket panel in a channel')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel where the support panel should be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('status')
      .setDescription('Show the ticket system status'))
    .addSubcommand((subcommand) => subcommand
      .setName('close')
      .setDescription('Start the one-minute ticket close countdown'))
    .addSubcommand((subcommand) => subcommand
      .setName('rename')
      .setDescription('Rename the current ticket')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('New ticket name')
        .setRequired(true))),

  async execute(target, args = []) {
    if (target?.isChatInputCommand?.()) {
      if (!target.deferred && !target.replied) {
        await target.deferReply();
      }

      const action = target.options.getSubcommand();
      const message = buildTicketMessage(target);
      if (action === 'setup') return setupTicketSystem(message, message.setupChannel);
      if (action === 'status') return getTicketStatus(message);
      if (action === 'close') return requestTicketClosure(message.channel, message.member, target.user, (content) => target.editReply({ content }));
      if (action === 'rename') return renameTicket(message, target.options.getString('name'));
      return createTicket(message);
    }

    const message = target;
    const action = String(args[0] || '').toLowerCase();
    if (!action) {
      return message.reply([
        '🎟️ **Ticket commands**',
        '`~ticket create` - Create a private support ticket',
        '`~ticket setup #channel` - Post the ticket panel',
        '`~ticket status` - Check the ticket system status',
        '`~ticket close` - Start the one-minute close countdown',
        '`~ticket rename <name>` - Rename the current ticket'
      ].join('\n'));
    }
    if (action === 'setup') return setupTicketSystem(message, args[1]);
    if (action === 'status') return getTicketStatus(message);
    if (action === 'close') return requestTicketClosure(message.channel, message.member, message.author, (content) => message.reply(content));
    if (action === 'rename') return renameTicket(message, args.slice(1).join(' '));
    if (action === 'create') return createTicket(message);
    if (args.length > 0) return renameTicket(message, args.join(' '));
    return message.reply('❌ Usage: `~ticket <create|setup|status|close|rename <name>>`');
  }
};