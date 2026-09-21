const { Collection, SlashCommandBuilder } = require('discord.js');
const schemas = require('./slashCommandSchemas');

function getMentionIds(value) {
  return [...String(value || '').matchAll(/<@!?([0-9]+)>/g)].map((match) => match[1]);
}

function getChannelMentionIds(value) {
  return [...String(value || '').matchAll(/<#([0-9]+)>/g)].map((match) => match[1]);
}

function getRoleMentionIds(value) {
  return [...String(value || '').matchAll(/<@&([0-9]+)>/g)].map((match) => match[1]);
}

function normalizeSlashName(name) {
  return String(name || 'command').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
}

function addOption(builder, spec) {
  const addMethod = {
    string: 'addStringOption', integer: 'addIntegerOption', number: 'addNumberOption', boolean: 'addBooleanOption',
    user: 'addUserOption', role: 'addRoleOption', channel: 'addChannelOption', attachment: 'addAttachmentOption'
  }[spec.type] || 'addStringOption';
  return builder[addMethod]((option) => {
    option.setName(spec.name).setDescription(String(spec.description || spec.name).slice(0, 100)).setRequired(Boolean(spec.required));
    if (spec.choices?.length && spec.type === 'string') option.addChoices(...spec.choices.map((value) => ({ name: String(value).slice(0, 100), value: String(value) })));
    if (spec.min !== null && spec.min !== undefined && ['integer', 'number'].includes(spec.type)) option.setMinValue(spec.min);
    if (spec.max !== null && spec.max !== undefined && ['integer', 'number'].includes(spec.type)) option.setMaxValue(spec.max);
    return option;
  });
}

function getOptionValue(options, spec) {
  const getter = {
    string: 'getString', integer: 'getInteger', number: 'getNumber', boolean: 'getBoolean',
    user: 'getUser', role: 'getRole', channel: 'getChannel', attachment: 'getAttachment'
  }[spec.type] || 'getString';
  return typeof options?.[getter] === 'function' ? options[getter](spec.name) : null;
}

function buildApplicationCommand(command) {
  if (command?.data?.toJSON || !command?.name || typeof command.execute !== 'function') {
    return command;
  }

  const description = String(command.description || `Run the ${command.name} command`).slice(0, 100);
  const originalExecute = command.execute;
  const optionSpecs = schemas[command.name] || [
    { name: 'arguments', type: 'string', description: 'Arguments for this command', required: false },
    { name: 'attachment', type: 'attachment', description: 'Optional file used by this command', required: false }
  ];
  const builder = new SlashCommandBuilder()
    .setName(normalizeSlashName(command.name))
    .setDescription(description);
  for (const spec of [...optionSpecs].sort((left, right) => Number(Boolean(right.required)) - Number(Boolean(left.required)))) {
    addOption(builder, spec);
  }
  command.data = builder;
  command.slashOptionSpecs = optionSpecs;

  command.execute = async (target, args = [], client) => {
    if (!target?.isChatInputCommand?.()) {
      return originalExecute(target, args, client);
    }

    if (typeof target.deferReply === 'function' && !target.deferred && !target.replied) {
      await target.deferReply();
    }

    const runtimeClient = client || target.client;
    const guild = target.guild || (target.guildId ? runtimeClient?.guilds?.cache?.get(target.guildId) : null);
    const channel = target.channel || (target.channelId ? runtimeClient?.channels?.cache?.get(target.channelId) : null);
    const users = new Collection();
    const members = new Collection();
    const channels = new Collection();
    const roles = new Collection();
    const attachments = new Collection();
    const argumentValues = [];
    for (const spec of optionSpecs) {
      const value = getOptionValue(target.options, spec);
      if (value === null || value === undefined) continue;
      if (spec.type === 'attachment') {
        attachments.set(value.id, value);
      } else if (spec.type === 'user') {
        users.set(value.id, value);
        const member = guild?.members.cache.get(value.id);
        if (member) members.set(member.id, member);
        argumentValues.push(`<@${value.id}>`);
      } else if (spec.type === 'role') {
        roles.set(value.id, value);
        argumentValues.push(`<@&${value.id}>`);
      } else if (spec.type === 'channel') {
        channels.set(value.id, value);
        argumentValues.push(`<#${value.id}>`);
      } else if (spec.type === 'boolean') {
        if (value) argumentValues.push(spec.name === 'confirm' || spec.name === 'all' ? spec.name : `--${spec.name}`);
      } else {
        argumentValues.push(String(value));
      }
    }
    const argumentText = argumentValues.join(' ');

    let hasReplied = false;
    const reply = (payload) => {
      if (!hasReplied && target.deferred) {
        hasReplied = true;
        return target.editReply(payload);
      }
      if (!hasReplied) {
        hasReplied = true;
        return target.reply(payload);
      }
      return target.followUp(payload);
    };

    const message = {
      author: target.user,
      client: runtimeClient,
      content: argumentText,
      guild,
      member: target.member,
      channel,
      mentions: {
        users,
        members,
        channels,
        roles
      },
      attachments,
      reply,
      delete: () => target.deleteReply?.() || Promise.resolve()
    };

    return originalExecute(message, argumentText.trim() ? argumentText.trim().split(/\s+/) : [], runtimeClient);
  };

  return command;
}

module.exports = { buildApplicationCommand };