const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../database');

const TICKET_TOPIC_PREFIX = 'ticket-owner:';
const TICKET_CLOSE_BUTTON_PREFIX = 'ticket:close:';
const TICKET_CLAIM_BUTTON_PREFIX = 'ticket:claim:';
const TICKET_CATEGORY_CONFIG_PREFIX = 'ticket-category:';
const TICKET_SUPPORT_ROLE_CONFIG_PREFIX = 'ticket-support-role:';
const TICKET_PANEL_CHANNEL_CONFIG_PREFIX = 'ticket-panel-channel:';
const TICKET_PANEL_MESSAGE_CONFIG_PREFIX = 'ticket-panel-message:';
const TICKET_LOG_CHANNEL_CONFIG_PREFIX = 'ticket-log-channel:';
const TICKET_SUPPORT_ROLE_NAME = 'general support';
const TICKET_PANEL_SELECT_ID = 'ticket:open';
const TICKET_CLOSE_DELAY_MS = 60 * 1000;
const pendingTicketClosures = new Map();
const TICKET_TYPES = {
  'invite-rewards': { label: 'Invite rewards', description: 'Invite Rewards - spend your invites here', channelPrefix: 'invite-rewards' },
  'general-support': { label: 'General Support', description: 'General support ticket', channelPrefix: 'general-support' },
  giveaway: { label: 'Giveaway', description: 'Giveaway - enter for a chance to win', channelPrefix: 'giveaway' }
};

function getTicketOwnerId(channel) {
  const topic = String(channel?.topic || '');
  if (!topic.startsWith(TICKET_TOPIC_PREFIX)) return null;
  const ownerId = topic.slice(TICKET_TOPIC_PREFIX.length).split(':')[0];
  return /^\d+$/.test(ownerId) ? ownerId : null;
}

function getTicketClaimantId(channel) {
  const topic = String(channel?.topic || '');
  const match = topic.match(/^ticket-owner:\d+:\d+:claimed:(\d+)$/);
  return match ? match[1] : null;
}

function isTicketChannel(channel) {
  return Boolean(getTicketOwnerId(channel));
}

function buildTicketControls(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_CLAIM_BUTTON_PREFIX}${channelId}`)
      .setLabel('Claim Ticket')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${TICKET_CLOSE_BUTTON_PREFIX}${channelId}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
}

function canCloseTicket(member, channel) {
  const ownerId = getTicketOwnerId(channel);
  if (!member || !ownerId || !member.roles?.cache) return false;
  return [...member.roles.cache.values()].some((role) => String(role.name || '').toLowerCase() === TICKET_SUPPORT_ROLE_NAME);
}

function hasTicketSupportRole(member) {
  return Boolean([...(member?.roles?.cache?.values?.() || [])]
    .some((role) => String(role.name || '').toLowerCase() === TICKET_SUPPORT_ROLE_NAME));
}

function scheduleTicketClosure(channel, delayMs = TICKET_CLOSE_DELAY_MS) {
  if (!channel?.id || typeof channel.delete !== 'function') return false;

  cancelTicketClosure(channel);
  const timer = setTimeout(async () => {
    if (pendingTicketClosures.get(channel.id) !== timer) return;
    pendingTicketClosures.delete(channel.id);
    await logTicketEvent(channel.guild, `Ticket deleted after its close countdown: ${channel.name} (${channel.id}).`);
    await channel.delete('Ticket close countdown completed').catch(() => {});
  }, delayMs);
  timer.unref?.();
  pendingTicketClosures.set(channel.id, timer);
  return true;
}

function cancelTicketClosure(channel) {
  const timer = pendingTicketClosures.get(channel?.id);
  if (!timer) return false;
  clearTimeout(timer);
  pendingTicketClosures.delete(channel.id);
  return true;
}

function hasPendingTicketClosure(channel) {
  return pendingTicketClosures.has(channel?.id);
}

async function requestTicketClosure(channel, member, actor, reply) {
  if (!isTicketChannel(channel)) {
    await reply('❌ This is not an active ticket channel.');
    return false;
  }
  if (!canCloseTicket(member, channel)) {
    await reply('❌ Only members with the general support role can close this ticket.');
    return false;
  }
  await reply('🔒 This ticket will close in **1 minute**. Use `~cancel` to cancel the countdown.');
  await logTicketEvent(channel.guild, `Ticket close started by ${actor} for ${channel}.`);
  scheduleTicketClosure(channel);
  return true;
}

async function claimTicket(interaction, channel) {
  if (!hasTicketSupportRole(interaction.member)) {
    await interaction.reply({ content: '❌ Only the general support role can claim this ticket.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (getTicketClaimantId(channel)) {
    await interaction.reply({ content: '❌ This ticket has already been claimed.', ephemeral: true }).catch(() => {});
    return true;
  }

  const ownerId = getTicketOwnerId(channel);
  await channel.setTopic(`${TICKET_TOPIC_PREFIX}${ownerId}:${Date.now()}:claimed:${interaction.user.id}`, 'Ticket claimed by support').catch(() => {});

  const staffRoles = [...(channel.guild?.roles?.cache?.values?.() || [])]
    .filter((role) => role.id !== channel.guild.roles.everyone.id)
    .filter((role) => String(role.name || '').toLowerCase() !== TICKET_SUPPORT_ROLE_NAME)
    .filter((role) => role.permissions.has(PermissionFlagsBits.ManageChannels) || role.permissions.has(PermissionFlagsBits.Administrator));
  for (const role of staffRoles) {
    await channel.permissionOverwrites.edit(role, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true
    }, { reason: `Ticket claimed by ${interaction.user.tag || interaction.user.id}` });
  }

  await interaction.reply({ content: `✅ ${interaction.user} claimed this ticket.`, allowedMentions: { users: [interaction.user.id] } }).catch(() => {});
  return true;
}

function normalizeTicketName(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/^ticket[-_\s]*/i, '')
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);

  return normalized ? `ticket-${normalized}` : null;
}

async function renameTicket(message, requestedName) {
  if (!message?.guild || !message?.channel) {
    return message?.reply?.('❌ This command can only be used inside a ticket channel.');
  }

  if (!isTicketChannel(message.channel)) {
    return message.reply('❌ This command can only be used inside a ticket channel.');
  }

  if (!canCloseTicket(message.member, message.channel)) {
    return message.reply('❌ Only the ticket owner or a channel manager can rename this ticket.');
  }

  const newName = normalizeTicketName(requestedName);
  if (!newName) {
    return message.reply('❌ Usage: `~ticket rename <name>`');
  }

  await message.channel.setName(newName, `Ticket renamed by ${message.author?.tag || message.author?.id || 'user'}`);
  return message.reply(`✅ Ticket renamed to **${newName}**.`);
}

function findOpenTicket(guild, userId) {
  const cache = guild?.channels?.cache;
  if (typeof cache?.find === 'function') {
    return cache.find((channel) => getTicketOwnerId(channel) === String(userId)) || null;
  }

  return [...(cache?.values?.() || [])].find((channel) => getTicketOwnerId(channel) === String(userId)) || null;
}

function getTicketCategoryKey(guildId) {
  return `${TICKET_CATEGORY_CONFIG_PREFIX}${guildId}`;
}

function getTicketSupportRoleKey(guildId) {
  return `${TICKET_SUPPORT_ROLE_CONFIG_PREFIX}${guildId}`;
}

function getTicketPanelChannelKey(guildId) {
  return `${TICKET_PANEL_CHANNEL_CONFIG_PREFIX}${guildId}`;
}

function getTicketPanelMessageKey(guildId) {
  return `${TICKET_PANEL_MESSAGE_CONFIG_PREFIX}${guildId}`;
}

function getTicketLogChannelKey(guildId) {
  return `${TICKET_LOG_CHANNEL_CONFIG_PREFIX}${guildId}`;
}

async function getTicketLogChannel(guild) {
  if (!guild) return null;
  const configuredId = await getConfig(getTicketLogChannelKey(guild.id));
  return configuredId ? guild.channels.cache.get(configuredId) || null : null;
}

async function logTicketEvent(guild, message) {
  const logChannel = await getTicketLogChannel(guild);
  if (!logChannel?.send) return;
  await logChannel.send(`🎟️ ${message}`).catch(() => {});
}

async function ensureTicketLogChannel(guild) {
  if (!guild) return null;
  const configured = await getTicketLogChannel(guild);
  if (configured) return configured;

  let logChannel = guild.channels.cache.find((channel) => channel.name === 'ticket-logs' && channel.type === ChannelType.GuildText);
  if (!logChannel) {
    logChannel = await guild.channels.create({ name: 'ticket-logs', type: ChannelType.GuildText, permissionOverwrites: [] });
  }
  await logChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }, { reason: 'Ticket log privacy' });
  for (const managerRole of guild.roles.cache.filter((role) => role.permissions.has(PermissionFlagsBits.ManageGuild)).values()) {
    await logChannel.permissionOverwrites.edit(managerRole, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false }, { reason: 'Ticket log access' }).catch(() => {});
  }
  await setConfig(getTicketLogChannelKey(guild.id), logChannel.id);
  return logChannel;
}

function findTicketSupportRole(guild) {
  const cache = guild?.roles?.cache;
  const matches = (role) => !role.managed && String(role.name || '').toLowerCase() === TICKET_SUPPORT_ROLE_NAME;
  if (typeof cache?.find === 'function') {
    return cache.find(matches) || null;
  }

  return [...(cache?.values?.() || [])].find(matches) || null;
}

async function getConfiguredTicketSupportRole(guild) {
  if (!guild) return null;
  const configuredId = await getConfig(getTicketSupportRoleKey(guild.id));
  if (configuredId) {
    const configured = guild.roles.cache.get(configuredId);
    if (configured && !configured.managed) return configured;
  }

  return findTicketSupportRole(guild);
}

function buildTicketPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(TICKET_PANEL_SELECT_ID)
    .setPlaceholder('Choose a ticket type to open...')
    .addOptions(Object.entries(TICKET_TYPES).map(([value, ticketType]) => ({
      label: ticketType.label,
      value,
      description: ticketType.description,
      emoji: '🎟️'
    })));

  return {
    embeds: [new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎟️ Support Tickets')
      .setDescription('Need help? Choose an option below to open a private ticket. The support team will be with you shortly.')
      .setFooter({ text: 'One open ticket per member' })],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

function resolveSetupChannel(message, requestedChannel) {
  if (requestedChannel?.isTextBased?.()) return requestedChannel;
  if (!message?.guild) return null;

  const raw = String(requestedChannel || '').trim();
  const channelId = raw.replace(/^<#(\d+)>$/, '$1');
  return message.mentions?.channels?.first?.() || message.guild.channels.cache.get(channelId) || null;
}

function findTicketCategory(guild) {
  return guild?.channels?.cache?.find((channel) => channel.type === ChannelType.GuildCategory && ['ticket', 'tickets'].includes(channel.name.toLowerCase())) || null;
}

async function getConfiguredTicketCategory(guild) {
  if (!guild) return null;
  const configuredId = await getConfig(getTicketCategoryKey(guild.id));
  if (!configuredId) return findTicketCategory(guild);

  const configured = guild.channels.cache.get(configuredId);
  return configured?.type === ChannelType.GuildCategory ? configured : null;
}

async function setupTicketSystem(message, requestedChannel = null) {
  if (!message?.guild || !message?.member) {
    return message?.reply?.('❌ Ticket setup can only be used in a server.');
  }

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ You need Manage Server or Manage Channels permission to set up tickets.');
  }

  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ I need the Manage Channels permission to set up tickets.');
  }

  let category = await getConfiguredTicketCategory(message.guild);
  if (!category) {
    category = await message.guild.channels.create({
      name: 'ticket',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: message.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
      reason: `Ticket system setup by ${message.author.tag || message.author.id}`
    });
  } else if (category.name !== 'ticket') {
    await category.setName('ticket', 'Normalize ticket category name').catch(() => {});
  }

  let panelChannel = resolveSetupChannel(message, requestedChannel);
  if (!panelChannel && !requestedChannel) {
    panelChannel = message.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === 'ticket' && channel.parentId === category.id);
    if (!panelChannel) {
      panelChannel = await message.guild.channels.create({
        name: 'ticket',
        type: ChannelType.GuildText,
        parent: category.id,
        reason: `Ticket panel created by ${message.author.tag || message.author.id}`
      });
    }
  }
  if (!panelChannel?.isTextBased?.() || typeof panelChannel.send !== 'function') {
    return message.reply('❌ Choose a text channel where the support panel should be posted.');
  }
  let supportRole = await getConfiguredTicketSupportRole(message.guild);
  if (!supportRole) {
    supportRole = await message.guild.roles.create({
      name: TICKET_SUPPORT_ROLE_NAME,
      reason: `Ticket support role created by ${message.author.tag || message.author.id}`
    });
  }

  await category.permissionOverwrites.edit(supportRole, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  }, { reason: 'Ticket support role access' });

  await setConfig(getTicketCategoryKey(message.guild.id), category.id);
  await setConfig(getTicketSupportRoleKey(message.guild.id), supportRole.id);

  const existingPanelChannelId = await getConfig(getTicketPanelChannelKey(message.guild.id));
  const existingPanelMessageId = await getConfig(getTicketPanelMessageKey(message.guild.id));
  let panelMessage = null;
  if (existingPanelChannelId === panelChannel.id && existingPanelMessageId) {
    panelMessage = await panelChannel.messages?.fetch(existingPanelMessageId).catch(() => null);
    if (panelMessage) await panelMessage.edit(buildTicketPanel()).catch(() => {});
  }
  if (!panelMessage) {
    panelMessage = await panelChannel.send(buildTicketPanel());
  }

  await setConfig(getTicketPanelChannelKey(message.guild.id), panelChannel.id);
  await setConfig(getTicketPanelMessageKey(message.guild.id), panelMessage.id);
  await logTicketEvent(message.guild, `Ticket system configured by ${message.author} in ${panelChannel}.`);
  return message.reply(`✅ Ticket system is ready. Support panel posted in ${panelChannel}. New tickets will be created under ${category}. ${supportRole} can view and reply to them.`);
}

async function getTicketStatus(message) {
  if (!message?.guild) {
    return message?.reply?.('❌ Ticket status can only be checked in a server.');
  }

  const category = await getConfiguredTicketCategory(message.guild);
  const openTickets = [...(message.guild.channels.cache.values?.() || [])].filter(isTicketChannel).length;
  return message.reply(category
    ? `🎫 Ticket system is enabled. Category: ${category}\nOpen tickets: **${openTickets}**.`
    : '🎫 Ticket system is not set up yet. Run `~ticket setup` or `/ticket setup`.');
}

async function createTicket(message, requestedType = 'general-support') {
  if (!message?.guild || !message?.author) {
    return message?.reply?.('❌ Tickets can only be created in a server.');
  }

  const existing = findOpenTicket(message.guild, message.author.id);
  if (existing) {
    return message.reply(`❌ You already have an open ticket: ${existing}`);
  }

  const ticketType = TICKET_TYPES[requestedType] || TICKET_TYPES['general-support'];

  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ I need the Manage Channels permission to create tickets.');
  }

  const safeName = String(message.author.username || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'user';

  const staffRoleOverwrites = [...(message.guild.roles.cache?.values?.() || [])]
    .filter((role) => role.id !== message.guild.roles.everyone.id)
    .filter((role) => role.permissions.has(PermissionFlagsBits.ManageChannels) || role.permissions.has(PermissionFlagsBits.Administrator))
    .map((role) => ({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }));

  const category = await getConfiguredTicketCategory(message.guild);
  const supportRole = await getConfiguredTicketSupportRole(message.guild);

  const channel = await message.guild.channels.create({
    name: `${ticketType.channelPrefix}-${safeName}`.slice(0, 100),
    type: ChannelType.GuildText,
    parent: category?.id || undefined,
    topic: `${TICKET_TOPIC_PREFIX}${message.author.id}:${Date.now()}`,
    permissionOverwrites: [
      { id: message.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(supportRole ? [{ id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ...staffRoleOverwrites,
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
    ],
    reason: `Ticket created by ${message.author.tag || message.author.id}`
  });

  await channel.send({
    content: `${supportRole ? `${supportRole} ` : ''}${message.author}, your private **${ticketType.label}** ticket is ready. Please describe what you need help with.`,
    components: [buildTicketControls(channel.id)]
  });
  await logTicketEvent(message.guild, `Ticket created by ${message.author} in ${channel}.`);

  return message.reply(`✅ Your ticket has been created: ${channel}`);
}

async function handleTicketInteraction(interaction) {
  if (interaction?.isStringSelectMenu?.() && interaction.customId === TICKET_PANEL_SELECT_ID) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const message = {
      author: interaction.user,
      client: interaction.client,
      guild: interaction.guild,
      member: interaction.member,
      channel: interaction.channel,
      reply: (payload) => interaction.editReply(payload)
    };
    await createTicket(message, interaction.values[0]);
    return true;
  }

  if (!interaction?.isButton?.()) return false;

  const customId = String(interaction.customId || '');
  if (!customId.startsWith(TICKET_CLOSE_BUTTON_PREFIX) && !customId.startsWith(TICKET_CLAIM_BUTTON_PREFIX)) return false;

  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    await interaction.reply({ content: '❌ This is not an active ticket channel.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (customId.startsWith(TICKET_CLAIM_BUTTON_PREFIX)) {
    return claimTicket(interaction, channel);
  }
  await requestTicketClosure(channel, interaction.member, interaction.user, (content) => interaction.reply({ content }).catch(() => {}));
  return true;
}

module.exports = {
  TICKET_TOPIC_PREFIX,
  TICKET_CATEGORY_CONFIG_PREFIX,
  TICKET_SUPPORT_ROLE_CONFIG_PREFIX,
  TICKET_PANEL_CHANNEL_CONFIG_PREFIX,
  TICKET_PANEL_MESSAGE_CONFIG_PREFIX,
  TICKET_LOG_CHANNEL_CONFIG_PREFIX,
  TICKET_PANEL_SELECT_ID,
  TICKET_CLAIM_BUTTON_PREFIX,
  TICKET_CLOSE_DELAY_MS,
  TICKET_SUPPORT_ROLE_NAME,
  TICKET_TYPES,
  getTicketOwnerId,
  getTicketClaimantId,
  isTicketChannel,
  buildTicketControls,
  canCloseTicket,
  hasTicketSupportRole,
  scheduleTicketClosure,
  cancelTicketClosure,
  hasPendingTicketClosure,
  findOpenTicket,
  normalizeTicketName,
  renameTicket,
  findTicketCategory,
  findTicketSupportRole,
  getConfiguredTicketSupportRole,
  buildTicketPanel,
  getConfiguredTicketCategory,
  getTicketLogChannelKey,
  getTicketLogChannel,
  ensureTicketLogChannel,
  logTicketEvent,
  requestTicketClosure,
  setupTicketSystem,
  getTicketStatus,
  createTicket,
  handleTicketInteraction
};