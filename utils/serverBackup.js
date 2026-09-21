const fs = require('fs/promises');
const path = require('path');
const { ChannelType } = require('discord.js');

const BACKUP_ROOT = path.join(__dirname, '..', 'data', 'server-backups');
const TEMPLATES_ROOT = path.join(__dirname, '..', 'data', 'templates');

const BACKUPABLE_CHANNEL_TYPES = new Set([
  ChannelType.GuildCategory,
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia
]);

function safeSegment(value) {
  return String(value).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'backup';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildProgressBar(currentValue, totalValue = 100, width = 20) {
  const current = Number.isFinite(currentValue) ? currentValue : 0;
  const total = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : 100;
  const percent = clamp((current / total) * 100, 0, 100);
  const filled = Math.round((percent / 100) * width);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
  return `${bar} ${Math.round(percent)}%`;
}

function createBackupId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureBackupDirectory(guildId) {
  const directory = path.join(BACKUP_ROOT, safeSegment(guildId));
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

async function ensureTemplatesDirectory() {
  await fs.mkdir(TEMPLATES_ROOT, { recursive: true });
  return TEMPLATES_ROOT;
}

function serializeOverwrite(overwrite) {
  return {
    id: overwrite.id,
    type: overwrite.type === 'member' ? 1 : 0,
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString()
  };
}

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(),
    position: role.position,
    managed: role.managed,
    isEveryone: role.id === role.guild.id
  };
}

function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || null,
    position: channel.position,
    topic: 'topic' in channel ? channel.topic ?? null : null,
    nsfw: 'nsfw' in channel ? Boolean(channel.nsfw) : false,
    rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser ?? 0 : 0,
    bitrate: 'bitrate' in channel ? channel.bitrate ?? null : null,
    userLimit: 'userLimit' in channel ? channel.userLimit ?? null : null,
    permissionOverwrites: channel.permissionOverwrites.cache.map(serializeOverwrite)
  };
}

function serializeMessageAttachment(attachment) {
  return {
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    proxyURL: attachment.proxyURL,
    contentType: attachment.contentType || null,
    size: attachment.size || 0
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    channelId: message.channelId,
    author: {
      id: message.author?.id || null,
      username: message.author?.username || 'Unknown',
      displayName: message.member?.displayName || message.author?.globalName || message.author?.username || 'Unknown',
      avatarURL: typeof message.author?.displayAvatarURL === 'function' ? message.author.displayAvatarURL({ size: 128 }) : null,
      bot: Boolean(message.author?.bot)
    },
    content: message.content || '',
    createdAt: message.createdAt ? message.createdAt.toISOString() : null,
    attachments: message.attachments.map(serializeMessageAttachment),
    embeds: message.embeds.map((embed) => (typeof embed.toJSON === 'function' ? embed.toJSON() : embed))
  };
}

function shouldKeepMessage(message, cutoffTimestamp) {
  if (!cutoffTimestamp) {
    return true;
  }

  return Boolean(message?.createdTimestamp) && message.createdTimestamp >= cutoffTimestamp;
}

async function fetchRecentChannelMessages(channel, cutoffTimestamp) {
  if (typeof channel?.messages?.fetch !== 'function') {
    return [];
  }

  const collectedMessages = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 }).catch(() => null);
    if (!batch || batch.size === 0) {
      break;
    }

    for (const message of batch.values()) {
      if (shouldKeepMessage(message, cutoffTimestamp)) {
        collectedMessages.push(message);
      }
    }

    const oldestMessage = batch.last();
    if (cutoffTimestamp && oldestMessage && oldestMessage.createdTimestamp < cutoffTimestamp) {
      break;
    }

    if (batch.size < 100) {
      break;
    }

    before = oldestMessage.id;
  }

  return collectedMessages
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map(serializeMessage);
}

async function collectBackupMessages(guild, options = {}) {
  const messageGroups = [];
  const cutoffMinutes = Number.isFinite(options.messageWindowMinutes) ? Math.max(1, Math.min(60, options.messageWindowMinutes)) : null;
  const cutoffTimestamp = cutoffMinutes ? Date.now() - (cutoffMinutes * 60 * 1000) : null;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const channels = guild.channels.cache
    .filter((channel) => typeof channel?.messages?.fetch === 'function')
    .sort((left, right) => left.position - right.position);

  const totalChannels = channels.size || 1;
  let processedChannels = 0;

  for (const channel of channels.values()) {
    const messages = await fetchRecentChannelMessages(channel, cutoffTimestamp);
    if (messages.length > 0) {
      messageGroups.push({
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        messages
      });
    }

    processedChannels += 1;
    if (onProgress) {
      const percent = Math.min(100, Math.round((processedChannels / totalChannels) * 100));
      onProgress({
        phase: 'messages',
        percent,
        processedChannels,
        totalChannels,
        channelName: channel.name,
        cutoffMinutes
      });
    }
  }

  return messageGroups;
}

function createMessagePayload(message) {
  const content = typeof message.content === 'string' ? message.content : '';
  const payload = {
    content,
    allowedMentions: { parse: [] }
  };

  if (Array.isArray(message.embeds) && message.embeds.length > 0) {
    payload.embeds = message.embeds;
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    payload.files = message.attachments.map((attachment) => ({
      attachment: attachment.url,
      name: attachment.name || 'attachment'
    }));
  }

  if (message.author) {
    payload.username = message.author.displayName || message.author.username || 'Unknown';
    if (message.author.avatarURL) {
      payload.avatarURL = message.author.avatarURL;
    }
  }

  if (!payload.content && !payload.embeds?.length && !payload.files?.length) {
    return null;
  }

  return payload;
}

function buildChannelCreateOptions(channelData, parentId, permissionOverwrites) {
  const options = {
    name: channelData.name,
    type: channelData.type,
    reason: 'Restoring guild backup',
    permissionOverwrites
  };

  if (channelData.type === ChannelType.GuildCategory) {
    return options;
  }

  if (parentId) {
    options.parent = parentId;
  }

  if (channelData.type === ChannelType.GuildText || channelData.type === ChannelType.GuildAnnouncement || channelData.type === ChannelType.GuildForum || channelData.type === ChannelType.GuildMedia) {
    if (channelData.topic) options.topic = channelData.topic;
    if (typeof channelData.nsfw === 'boolean') options.nsfw = channelData.nsfw;
    if (Number.isInteger(channelData.rateLimitPerUser)) options.rateLimitPerUser = channelData.rateLimitPerUser;
  }

  if (channelData.type === ChannelType.GuildVoice || channelData.type === ChannelType.GuildStageVoice) {
    if (Number.isInteger(channelData.bitrate)) options.bitrate = channelData.bitrate;
    if (Number.isInteger(channelData.userLimit)) options.userLimit = channelData.userLimit;
  }

  return options;
}

function buildChannelEditOptions(channelData, parentId, permissionOverwrites) {
  const options = {
    name: channelData.name,
    reason: 'Restoring guild backup',
    permissionOverwrites
  };

  if (channelData.type === ChannelType.GuildCategory) {
    return options;
  }

  if (parentId) {
    options.parent = parentId;
  }

  if (channelData.type === ChannelType.GuildText || channelData.type === ChannelType.GuildAnnouncement || channelData.type === ChannelType.GuildForum || channelData.type === ChannelType.GuildMedia) {
    if (channelData.topic) options.topic = channelData.topic;
    if (typeof channelData.nsfw === 'boolean') options.nsfw = channelData.nsfw;
    if (Number.isInteger(channelData.rateLimitPerUser)) options.rateLimitPerUser = channelData.rateLimitPerUser;
  }

  if (channelData.type === ChannelType.GuildVoice || channelData.type === ChannelType.GuildStageVoice) {
    if (Number.isInteger(channelData.bitrate)) options.bitrate = channelData.bitrate;
    if (Number.isInteger(channelData.userLimit)) options.userLimit = channelData.userLimit;
  }

  return options;
}

function remapPermissionOverwrites(guild, permissionOverwrites, roleMap) {
  return permissionOverwrites
    .map((overwrite) => {
      const targetId = overwrite.type === 1 ? overwrite.id : (roleMap.get(overwrite.id) || (overwrite.id === guild.id ? guild.id : null));
      if (!targetId) return null;
      return {
        id: targetId,
        type: overwrite.type,
        allow: overwrite.allow,
        deny: overwrite.deny
      };
    })
    .filter(Boolean);
}

async function clearGuildStructure(guild, summary, reportProgress) {
  const channels = await guild.channels.fetch();
  const deletableChannels = [...channels.values()];

  for (let index = 0; index < deletableChannels.length; index += 1) {
    const channel = deletableChannels[index];
    try {
      await channel.delete('Replacing guild structure from server template');
      summary.channelsDeleted += 1;
    } catch {
      summary.skipped += 1;
    }

    await reportProgress('cleanup', index + 1, Math.max(deletableChannels.length, 1), `Deleted ${channel.name}`);
  }

  const roles = await guild.roles.fetch();
  const deletableRoles = [...roles.values()].filter((role) => role.id !== guild.id && !role.managed && role.editable);

  for (let index = 0; index < deletableRoles.length; index += 1) {
    const role = deletableRoles[index];
    try {
      await role.delete('Replacing guild structure from server template');
      summary.rolesDeleted += 1;
    } catch {
      summary.skipped += 1;
    }

    await reportProgress('cleanup', index + 1, Math.max(deletableRoles.length, 1), `Deleted role ${role.name}`);
  }

  const expressions = [
    { collection: guild.emojis, summaryKey: 'emojisDeleted', label: 'emoji' },
    { collection: guild.stickers, summaryKey: 'stickersDeleted', label: 'sticker' }
  ];

  for (const { collection, summaryKey, label } of expressions) {
    if (typeof collection?.fetch !== 'function') {
      continue;
    }

    const items = await collection.fetch();
    for (const item of items.values()) {
      try {
        await item.delete('Replacing guild structure from server template');
        summary[summaryKey] += 1;
      } catch {
        summary.skipped += 1;
      }
    }

    await reportProgress('cleanup', 1, 1, `Deleted destination ${label}s`);
  }

  await reportProgress('cleanup', 1, 1, 'Destination structure cleared');
}

async function createGuildBackup(guild, options = {}) {
  const backupId = createBackupId();
  const isTemplate = Boolean(options.skipMessages);
  const backupDirectory = isTemplate ? await ensureTemplatesDirectory() : await ensureBackupDirectory(guild.id);
  const filePath = path.join(backupDirectory, `${backupId}.json`);

  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((left, right) => left.position - right.position)
    .map(serializeRole);

  const channels = guild.channels.cache
    .filter((channel) => BACKUPABLE_CHANNEL_TYPES.has(channel.type) && !(typeof channel.isThread === 'function' && channel.isThread()))
    .sort((left, right) => left.position - right.position)
    .map(serializeChannel);

  const messages = options.skipMessages ? [] : await collectBackupMessages(guild, options);
  const messageWindowMinutes = options.skipMessages ? null : (Number.isFinite(options.messageWindowMinutes) ? Math.max(1, Math.min(60, options.messageWindowMinutes)) : null);

  const backup = {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    messageWindowMinutes,
    isTemplate: Boolean(options.skipMessages),
    guild: {
      id: guild.id,
      name: guild.name,
      iconURL: guild.iconURL() || null,
      bannerURL: guild.bannerURL?.() || null
    },
    roles,
    channels,
    messages
  };

  await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { backupId, filePath, backup };
}

async function loadBackupFromFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadBackupFromAttachment(attachment) {
  if (typeof fetch !== 'function') {
    throw new Error('Attachment restore requires a runtime with fetch support.');
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download backup attachment (${response.status}).`);
  }

  return response.json();
}

async function restoreGuildBackup(guild, backup, options = {}) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup file.');
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const reportProgress = async (phase, progress, total, detail = '') => {
    if (!onProgress) {
      return;
    }

    const payload = {
      phase,
      progress,
      total,
      percent: total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0,
      detail
    };

    await onProgress(payload);
  };

  const roleMap = new Map([[guild.id, guild.id]]);
  const rolesCreatedOrUpdated = [];
  const summary = {
    channelsDeleted: 0,
    rolesDeleted: 0,
    emojisDeleted: 0,
    stickersDeleted: 0,
    rolesCreated: 0,
    rolesUpdated: 0,
    channelsCreated: 0,
    channelsUpdated: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    skipped: 0
  };

  if (options.replaceExisting) {
    await clearGuildStructure(guild, summary, (phase, progress, total, detail) => reportProgress(phase, progress, total, detail));
  }

  const roles = Array.isArray(backup.roles) ? [...backup.roles] : [];
  roles.sort((left, right) => (left.position || 0) - (right.position || 0));

  for (let index = 0; index < roles.length; index += 1) {
    const roleData = roles[index];
    if (!roleData || roleData.isEveryone || roleData.managed) {
      summary.skipped += 1;
      await reportProgress('roles', index + 1, Math.max(roles.length, 1), roleData?.name || 'Skipped role');
      continue;
    }

    const existingRole = guild.roles.cache.find((role) => !role.managed && role.name === roleData.name);
    const payload = {
      name: roleData.name,
      color: roleData.color,
      hoist: Boolean(roleData.hoist),
      mentionable: Boolean(roleData.mentionable),
      permissions: roleData.permissions || '0',
      reason: 'Restoring guild backup'
    };

    if (existingRole) {
      await existingRole.edit(payload).catch(() => {});
      roleMap.set(roleData.id, existingRole.id);
      rolesCreatedOrUpdated.push({ role: existingRole, originalPosition: roleData.position });
      summary.rolesUpdated += 1;
      await reportProgress('roles', index + 1, Math.max(roles.length, 1), `Updated ${roleData.name}`);
      continue;
    }

    const createdRole = await guild.roles.create(payload).catch(() => null);
    if (!createdRole) {
      summary.skipped += 1;
      continue;
    }

    roleMap.set(roleData.id, createdRole.id);
    rolesCreatedOrUpdated.push({ role: createdRole, originalPosition: roleData.position });
    summary.rolesCreated += 1;
    await reportProgress('roles', index + 1, Math.max(roles.length, 1), `Created ${roleData.name}`);
  }

  // Second pass: set all role positions correctly
  rolesCreatedOrUpdated.sort((left, right) => (left.originalPosition || 0) - (right.originalPosition || 0));
  for (let index = 0; index < rolesCreatedOrUpdated.length; index += 1) {
    const { role, originalPosition } = rolesCreatedOrUpdated[index];
    if (typeof role.setPosition === 'function' && Number.isInteger(originalPosition)) {
      await role.setPosition(originalPosition).catch(() => {});
    }
  }

  await reportProgress('roles', Math.max(roles.length, 1), Math.max(roles.length, 1), 'Role restore complete');

  const channels = Array.isArray(backup.channels) ? [...backup.channels] : [];
  channels.sort((left, right) => (left.position || 0) - (right.position || 0));

  const categories = channels.filter((channel) => channel.type === ChannelType.GuildCategory);
  const others = channels.filter((channel) => channel.type !== ChannelType.GuildCategory);

  const channelMap = new Map();
  const categoriesCreatedOrUpdated = [];
  const otherChannelsCreatedOrUpdated = [];

  for (let index = 0; index < categories.length; index += 1) {
    const channelData = categories[index];
    const permissionOverwrites = remapPermissionOverwrites(guild, channelData.permissionOverwrites || [], roleMap);
    const existingCategory = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === channelData.name);

    if (existingCategory) {
      await existingCategory.edit(buildChannelEditOptions(channelData, null, permissionOverwrites)).catch(() => {});
      channelMap.set(channelData.id, existingCategory.id);
      categoriesCreatedOrUpdated.push({ channel: existingCategory, originalPosition: channelData.position });
      summary.categoriesUpdated += 1;
      await reportProgress('categories', index + 1, Math.max(categories.length, 1), `Updated ${channelData.name}`);
      continue;
    }

    const createdCategory = await guild.channels.create(buildChannelCreateOptions(channelData, null, permissionOverwrites)).catch(() => null);
    if (!createdCategory) {
      summary.skipped += 1;
      await reportProgress('categories', index + 1, Math.max(categories.length, 1), `Skipped ${channelData.name}`);
      continue;
    }

    channelMap.set(channelData.id, createdCategory.id);
    categoriesCreatedOrUpdated.push({ channel: createdCategory, originalPosition: channelData.position });
    summary.categoriesCreated += 1;
    await reportProgress('categories', index + 1, Math.max(categories.length, 1), `Created ${channelData.name}`);
  }

  // Second pass: set all category positions
  categoriesCreatedOrUpdated.sort((left, right) => (left.originalPosition || 0) - (right.originalPosition || 0));
  for (let index = 0; index < categoriesCreatedOrUpdated.length; index += 1) {
    const { channel, originalPosition } = categoriesCreatedOrUpdated[index];
    if (typeof channel.setPosition === 'function' && Number.isInteger(originalPosition)) {
      await channel.setPosition(originalPosition).catch(() => {});
    }
  }

  await reportProgress('categories', Math.max(categories.length, 1), Math.max(categories.length, 1), 'Category restore complete');

  for (let index = 0; index < others.length; index += 1) {
    const channelData = others[index];
    const mappedParentId = channelData.parentId ? channelMap.get(channelData.parentId) || null : null;
    const permissionOverwrites = remapPermissionOverwrites(guild, channelData.permissionOverwrites || [], roleMap);
    const existingChannel = guild.channels.cache.find((channel) =>
      channel.type === channelData.type &&
      channel.name === channelData.name &&
      (mappedParentId ? channel.parentId === mappedParentId : !channel.parentId)
    );

    if (existingChannel) {
      await existingChannel.edit(buildChannelEditOptions(channelData, mappedParentId, permissionOverwrites)).catch(() => {});
      channelMap.set(channelData.id, existingChannel.id);
      otherChannelsCreatedOrUpdated.push({ channel: existingChannel, originalPosition: channelData.position, parentId: mappedParentId });
      summary.channelsUpdated += 1;
      await reportProgress('channels', index + 1, Math.max(others.length, 1), `Updated ${channelData.name}`);
      continue;
    }

    const createdChannel = await guild.channels.create(buildChannelCreateOptions(channelData, mappedParentId, permissionOverwrites)).catch(() => null);
    if (!createdChannel) {
      summary.skipped += 1;
      await reportProgress('channels', index + 1, Math.max(others.length, 1), `Skipped ${channelData.name}`);
      continue;
    }

    channelMap.set(channelData.id, createdChannel.id);
    otherChannelsCreatedOrUpdated.push({ channel: createdChannel, originalPosition: channelData.position, parentId: mappedParentId });
    summary.channelsCreated += 1;
    await reportProgress('channels', index + 1, Math.max(others.length, 1), `Created ${channelData.name}`);
  }

  // Second pass: set all channel positions (grouped by parent)
  const channelsByParent = new Map();
  for (const item of otherChannelsCreatedOrUpdated) {
    const parentId = item.parentId || 'root';
    if (!channelsByParent.has(parentId)) {
      channelsByParent.set(parentId, []);
    }
    channelsByParent.get(parentId).push(item);
  }

  for (const [, items] of channelsByParent) {
    items.sort((left, right) => (left.originalPosition || 0) - (right.originalPosition || 0));
    for (let index = 0; index < items.length; index += 1) {
      const { channel, originalPosition } = items[index];
      if (typeof channel.setPosition === 'function' && Number.isInteger(originalPosition)) {
        await channel.setPosition(originalPosition).catch(() => {});
      }
    }
  }

  await reportProgress('channels', Math.max(others.length, 1), Math.max(others.length, 1), 'Channel restore complete');

  summary.messagesRestored = 0;

  const messageGroups = Array.isArray(backup.messages) ? backup.messages : [];
  const totalMessages = messageGroups.reduce((sum, group) => sum + ((Array.isArray(group.messages) ? group.messages.length : 0)), 0);
  let restoredMessages = 0;

  for (const group of messageGroups) {
    const restoredChannelId = channelMap.get(group.channelId);
    if (!restoredChannelId) {
      summary.skipped += 1;
      continue;
    }

    const restoredChannel = guild.channels.cache.get(restoredChannelId);
    if (!restoredChannel || typeof restoredChannel.send !== 'function') {
      summary.skipped += 1;
      continue;
    }

    const messages = Array.isArray(group.messages) ? group.messages : [];
    if (messages.length === 0) {
      continue;
    }

    let webhook = null;
    if (typeof restoredChannel.createWebhook === 'function') {
      webhook = await restoredChannel.createWebhook({ name: 'Server Backup Restore' }).catch(() => null);
    }

    for (const message of messages) {
      const payload = createMessagePayload(message);
      if (!payload) {
        summary.skipped += 1;
        continue;
      }

      try {
        if (webhook) {
          await webhook.send(payload);
        } else {
          delete payload.username;
          delete payload.avatarURL;
          await restoredChannel.send(payload);
        }
        summary.messagesRestored += 1;
        restoredMessages += 1;
        await reportProgress('messages', totalMessages > 0 ? restoredMessages : 0, Math.max(totalMessages, 1), `Restored ${restoredMessages}/${Math.max(totalMessages, 1)} messages`);
      } catch (error) {
        summary.skipped += 1;
      }
    }

    if (webhook) {
      await webhook.delete('Finished restoring server backup messages').catch(() => {});
    }
  }

  if (totalMessages > 0) {
    await reportProgress('messages', totalMessages, Math.max(totalMessages, 1), 'Message restore complete');
  } else {
    await reportProgress('messages', 0, 1, 'No message history to restore');
  }

  return summary;
}

async function loadTemplateByIdOrFile(templateId) {
  if (!templateId) {
    return null;
  }

  const templatePath = path.join(TEMPLATES_ROOT, `${templateId}.json`);
  try {
    return await loadBackupFromFile(templatePath);
  } catch (error) {
    return null;
  }
}

module.exports = {
  buildProgressBar,
  createGuildBackup,
  loadBackupFromFile,
  loadBackupFromAttachment,
  restoreGuildBackup,
  loadTemplateByIdOrFile,
  TEMPLATES_ROOT
};
