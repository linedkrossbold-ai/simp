const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { authorizeOwnerCommand } = require('../../utils/owner');

function resolveChannel(message, value) {
  const channelId = String(value || '').match(/^<#(\d+)>$/)?.[1] || String(value || '').trim();
  return message.mentions.channels.first()
    || message.guild.channels.cache.get(channelId)
    || null;
}

async function sendToChannel(message, content, channel) {
  if (!content) return message.reply('❌ Provide something for me to say.');
  if (!channel || !channel.isTextBased?.() || channel.type === ChannelType.GuildVoice) {
    return message.reply('❌ Provide a valid text channel.');
  }
  if (!channel.permissionsFor(message.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
    return message.reply('❌ I cannot send messages in that channel.');
  }

  await channel.send({ content });
  return message.reply(`✅ Message sent in ${channel}.`);
}

module.exports = {
  name: 'say',
  aliases: [],
  description: 'Send a message to a channel',
  usage: '~say <content> in #channel',
  requiredPermissions: [PermissionFlagsBits.ManageMessages],
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message to a channel')
    .addStringOption((option) => option
      .setName('content')
      .setDescription('The message to send')
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('The channel where the message should be sent')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)),

  async execute(target, args = []) {
    if (target.author && !(await authorizeOwnerCommand(target, { commandName: 'say', requiredPermissions: [PermissionFlagsBits.ManageMessages] }))) {
      return;
    }

    if (target?.isChatInputCommand?.()) {
      const content = target.options.getString('content');
      const channel = target.options.getChannel('channel');
      if (!target.deferred && !target.replied) await target.deferReply({ ephemeral: true });
      return sendToChannel({
        guild: target.guild,
        mentions: { channels: { first: () => channel } },
        reply: (payload) => target.editReply(payload)
      }, content, channel);
    }

    if (!target.guild) return target.reply('❌ This command can only be used in a server.');
    const inIndex = args.findIndex((arg) => arg.toLowerCase() === 'in');
    if (inIndex < 1 || !args[inIndex + 1]) return target.reply('❌ Usage: `~say <content> in #channel`');
    const content = args.slice(0, inIndex).join(' ').trim();
    const channel = resolveChannel(target, args[inIndex + 1]);
    return sendToChannel(target, content, channel);
  }
};