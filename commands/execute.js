const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits
} = require('discord.js');
const { setExecutedNickname, getConfig, setConfig } = require('../database');
const { authorizeOwnerCommand, isOwner } = require('../utils/owner');

const EXECUTED_ROLE_NAME = '☠️ 𝕖𝕩𝕖𝕔𝕥𝕖𝕕';
const EXECUTED_NICK_PREFIX = '☠️ 𝕖𝕩𝕖𝕔𝕦𝕥𝕖𝕕';
const EXECUTED_NICK_FULL_PREFIX = `${EXECUTED_NICK_PREFIX} `;

function formatVoteList(voterIds) {
  const count = voterIds?.size || 0;
  if (count === 0) {
    return 'No votes yet.';
  }

  const mentions = Array.from(voterIds)
    .slice(0, 10)
    .map((id) => `<@${id}>`)
    .join('\n');
  const moreText = count > 10 ? `\n+${count - 10} more` : '';

  return `**${count} vote${count === 1 ? '' : 's'}**\n${mentions}${moreText}`;
}

function buildResultEmbed(target, outcome, votesFor, votesAgainst, yesIds, noIds) {
  const description = outcome === 'execute'
    ? `No one remembers this, but ${target} has been claimed by the seas, and their name now belongs to the tide.`
    : `The judgment was denied. ${target} remains among the living, and the sea keeps its silence.`;

  return new EmbedBuilder()
    .setColor(outcome === 'execute' ? '#8B0000' : '#2E8B57')
    .setTitle(outcome === 'execute' ? '⚖️ Sentence Carried Out' : '⚖️ Sentence Denied')
    .setDescription(description)
    .addFields(
      { name: 'Executed Member', value: `${target}`, inline: true },
      { name: 'Execute', value: formatVoteList(yesIds), inline: false },
      { name: 'Spare', value: formatVoteList(noIds), inline: false },
      { name: 'For', value: `${votesFor}`, inline: true },
      { name: 'Against', value: `${votesAgainst}`, inline: true }
    )
    .setTimestamp();
}

function buildTrialEmbed(callerMention, target, remainingMs, yesIds, noIds) {
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return new EmbedBuilder()
    .setColor('#800000')
    .setTitle(`⚖️ Execution Trial — ${remainingSeconds}s left`)
    .setDescription(`${callerMention} has called for judgment on ${target}.

Should this soul be claimed by the sea?`)
    .addFields(
      { name: 'Judge', value: `${callerMention}`, inline: true },
      { name: 'Executed Member', value: `${target}`, inline: true },
      { name: 'Target', value: `${target.tag}`, inline: true },
      { name: 'Time Remaining', value: `${remainingSeconds}s`, inline: true },
      { name: 'Execute', value: formatVoteList(yesIds), inline: false },
      { name: 'Spare', value: formatVoteList(noIds), inline: false }
    )
    .setFooter({ text: 'The judge and executed member cannot vote. Everyone else may vote once.' })
    .setTimestamp();
}

module.exports = {
  name: 'execute',
  aliases: ['judge'],
  description: 'Start a 1-minute live vote on whether to execute a mentioned user',
  usage: '~execute @user',

  async execute(message, args) {
    try {
      // Support both message-based and interaction-based invocations
      const invokerUser = message?.author || message?.user || (message?.member && message.member.user) || null;
      const invokerId = invokerUser?.id;

      // Determine target user: prefer mentions, then slash options, then args parsing
      let target = message.mentions?.users?.first?.() || null;
      if (!target && message.options && typeof message.options.getUser === 'function') {
        target = message.options.getUser('user') || null;
      }
      if (!target && Array.isArray(args) && args.length) {
        // try parse mention or id from args[0]
        const m = args[0];
        const idMatch = m && m.match && m.match(/^<@!?([0-9]+)>$/);
        const id = idMatch ? idMatch[1] : (m && /^[0-9]+$/.test(m) ? m : null);
        if (id && message.client) {
          target = await message.client.users.fetch(id).catch(() => null);
        }
      }

      if (!target) {
        return message.reply('❌ Please mention a user to judge.');
      }

      if (!message.guild) {
        return message.reply('❌ This command can only be used in a server.');
      }

      if (target.id === invokerId) {
        return message.reply('❌ You cannot vote on your own execution.');
      }

      const targetMember = await message.guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) {
        return message.reply('❌ Could not find that member in this server.');
      }

      if (isOwner(target.id)) {
        return message.reply('❌ This member cannot be executed.');
      }

      if (!(await authorizeOwnerCommand(message, { commandName: 'execute', requiredPermissions: [PermissionFlagsBits.ManageGuild], requireApproval: true }))) {
        return null;
      }

      const embed = new EmbedBuilder()
        .setColor('#800000')
        .setTitle('⚖️ Execution Trial')
        .setDescription(`${message.author} has called for judgment on ${target}.\n\nShould this soul be claimed by the sea? Everyone else may vote using the buttons below.`)
        .addFields(
          { name: 'Judge', value: `${invokerUser}`, inline: true },
          { name: 'Executed Member', value: `${target}`, inline: true },
          { name: 'Target', value: `${target.tag}`, inline: true },
          { name: 'Time Limit', value: '1 minute', inline: true },
          { name: 'Voting Rules', value: 'The judge and executed member cannot vote. Every other member can vote once.', inline: false }
        )
        .setFooter({ text: 'The vote will close automatically after 1 minute.' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('execute_yes')
          .setLabel('Execute')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('execute_no')
          .setLabel('Spare')
          .setStyle(ButtonStyle.Success)
      );

      const votes = new Map();
      votes.set('yes', new Set());
      votes.set('no', new Set());

      const getVoteSet = (store, key) => {
        if (store instanceof Map) return store.get(key);
        if (store && typeof store === 'object') return store[key];
        return null;
      };

      function buildExecutedNickname(displayName) {
        const baseName = String(displayName || '').trim();
        const full = baseName ? `${EXECUTED_NICK_FULL_PREFIX}${baseName}` : EXECUTED_NICK_PREFIX;
        return full.length > 32 ? EXECUTED_NICK_PREFIX : full;
      }

      async function findOrCreateExecutedRole(guild) {
        if (!guild) return null;
        const existing = guild.roles.cache.find((role) => role.name === EXECUTED_ROLE_NAME);
        if (existing) return existing;
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return null;

        return guild.roles.create({
          name: EXECUTED_ROLE_NAME,
          permissions: [],
          color: 'DarkRed',
          mentionable: false,
          reason: 'Created executed role for execution command'
        }).catch(() => null);
      }

      const buildCurrentEmbed = (remainingMs) => buildTrialEmbed(
        `${invokerUser || message.author || message.user}`,
        target,
        remainingMs,
        getVoteSet(votes, 'yes'),
        getVoteSet(votes, 'no')
      );

      const trialMessage = await message.reply({ embeds: [buildCurrentEmbed(60000)], components: [row] });
      const duration = 60000;
      const endTime = Date.now() + duration;
      const updateLiveEmbed = async (remainingMs) => {
        try {
          await trialMessage.edit({ embeds: [buildCurrentEmbed(remainingMs)], components: [row] });
        } catch (err) {
          // ignore edit failures, may happen if message is deleted or identical content
        }
      };

      const timer = setInterval(async () => {
        const remainingMs = endTime - Date.now();
        if (remainingMs <= 0) {
          clearInterval(timer);
          return;
        }
        await updateLiveEmbed(remainingMs);
      }, 1000);

      const collector = trialMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: duration
      });

      collector.on('collect', async (interaction) => {
        try {
          const interUser = interaction.user || interaction.member?.user;
          if (!interUser) {
            await interaction.reply({ content: 'Unable to identify voter.', ephemeral: true });
            return;
          }

          if (interUser.id === invokerId || interUser.id === target.id || interUser.bot) {
            await interaction.reply({ content: 'Only other members may vote.', ephemeral: true });
            return;
          }

          const choice = interaction.customId === 'execute_yes' ? 'yes' : 'no';
          const otherChoice = choice === 'yes' ? 'no' : 'yes';

          const choiceSet = getVoteSet(votes, choice);
          const otherSet = getVoteSet(votes, otherChoice);

          if (!choiceSet || !otherSet) {
            await interaction.reply({ content: '❌ Voting state is invalid.', ephemeral: true });
            return;
          }

          if (choiceSet.has(interUser.id)) {
            await interaction.reply({ content: 'You have already voted.', ephemeral: true });
            return;
          }

          choiceSet.add(interUser.id);
          otherSet.delete(interUser.id);

          await interaction.reply({ content: `Your vote has been recorded: **${choice === 'yes' ? 'Execute' : 'Spare'}**`, ephemeral: true });
          await updateLiveEmbed(endTime - Date.now());
        } catch (err) {
          console.error('Error handling vote interaction:', err);
          try { await interaction.reply({ content: '❌ An error occurred while recording your vote.', ephemeral: true }); } catch (e) {}
        }
      });

      collector.on('end', async () => {
        clearInterval(timer);
        const yesSet = getVoteSet(votes, 'yes');
        const noSet = getVoteSet(votes, 'no');
        const votesFor = yesSet ? yesSet.size : 0;
        const votesAgainst = noSet ? noSet.size : 0;
        const outcome = votesFor > votesAgainst ? 'execute' : 'spare';

        if (outcome === 'execute') {
          try {
            const executedName = buildExecutedNickname(targetMember.displayName || targetMember.user.username);
            await setExecutedNickname(message.guild.id, targetMember.id, executedName).catch(() => {});
            await targetMember.setNickname(executedName).catch(() => {});
            const executedRole = await findOrCreateExecutedRole(message.guild);
            const permissionRoles = targetMember.roles.cache
              .filter((role) => role.id !== message.guild.id && !role.managed && role.permissions.bitfield !== 0n)
              .map((role) => role.id);
            await setConfig(`executedroles:${message.guild.id}:${targetMember.id}`, JSON.stringify(permissionRoles)).catch(() => {});
            const botHighestRole = message.guild.members.me?.roles.highest;
            for (const roleId of permissionRoles) {
              const role = message.guild.roles.cache.get(roleId);
              if (role && botHighestRole && role.position < botHighestRole.position) {
                await targetMember.roles.remove(role, 'Removed permission-bearing roles after execution vote').catch(() => {});
              }
            }
            if (executedRole && !targetMember.roles.cache.has(executedRole.id)) {
              await targetMember.roles.add(executedRole, 'Assigned executed role after execution vote').catch(() => {});
            }
          } catch (error) {
            console.error('Failed to apply executed lock or role:', error);
          }
        }

        const finalEmbed = buildResultEmbed(target, outcome, votesFor, votesAgainst, yesSet, noSet);

        try {
          await trialMessage.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
        } catch (error) {
          console.error(error);
        }
      });
    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while starting the execution trial.');
    }
  }
};
