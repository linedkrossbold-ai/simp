const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/owner');
const { getPrefix, getAdminCommands, getNonAdminOwnerCommands, getCommandDetails, isKingflexCommand } = require('../utils/helpMenus');

module.exports = {
  name: 'kingflex',
  description: 'List every bot owner-only command',
  ownerOnly: true,
  usage: '~kingflex',
  data: new SlashCommandBuilder()
    .setName('kingflex')
    .setDescription('List every bot owner-only command'),

  async execute(target, args, client) {
    if (!isOwner(target.user?.id || target.author?.id)) {
      return target.reply('❌ Only a bot owner can use this command.');
    }

    const PREFIX = getPrefix(target);
    const activeClient = client || target.client;
    const adminCommands = getAdminCommands(activeClient).filter(isKingflexCommand);
    const otherCommands = getNonAdminOwnerCommands(activeClient).filter(isKingflexCommand);

    if (!adminCommands.length && !otherCommands.length) {
      return target.reply('❌ No owner-only commands found.');
    }

    const allCommands = [...adminCommands, ...otherCommands];
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(allCommands.length / pageSize));
    let currentPage = 0;

    const buildGuideEmbed = (page, selectedCommand = null) => {
      const start = page * pageSize;
      const pageCommands = allCommands.slice(start, start + pageSize);
      const commandList = pageCommands.map((command) => `\`${PREFIX}${command.name}\``).join(' • ');
      const details = selectedCommand ? getCommandDetails(selectedCommand, PREFIX) : null;

      return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('👑 Kingflex - Owner Commands')
        .setDescription(`Page ${page + 1}/${totalPages}. Select an owner-only command to inspect its details. Prefix: \`${PREFIX}\``)
        .addFields(
          { name: '🔑 Owner Commands', value: commandList || 'No owner-only commands available.', inline: false },
          {
            name: details ? `ℹ️ ${details.name}` : 'ℹ️ Command Details',
            value: details
              ? [
                  `**Description:** ${details.description}`,
                  `**Usage:** ${details.usage}`,
                  `**Requirements:** ${details.requirements.length ? details.requirements.join(', ') : 'None'}`,
                  details.aliases.length ? `**Aliases:** ${details.aliases.join(', ')}` : ''
                ].filter(Boolean).join('\n')
              : 'Select a command to see details.',
            inline: false
          }
        )
        .setFooter({ text: 'Use the buttons to browse pages and inspect a command.' })
        .setTimestamp();
    };

    const buildCommandRow = (page, selectedCommandName = null) => {
      const start = page * pageSize;
      const pageCommands = allCommands.slice(start, start + pageSize);
      const buttons = pageCommands.map((command) => new ButtonBuilder()
        .setCustomId(`owner_help_${command.name}`)
        .setLabel(command.name)
        .setStyle(command.name === selectedCommandName ? ButtonStyle.Success : ButtonStyle.Primary));

      // Split buttons into rows of up to 5 components
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }

      return rows;
    };

    const buildNavRow = (page) => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('owner_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('owner_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );

    let selectedCommand = allCommands[0] || null;
    const initialEmbed = buildGuideEmbed(currentPage, selectedCommand);
    const commandRows = buildCommandRow(currentPage, selectedCommand?.name);
    const navRow = buildNavRow(currentPage);
    const reply = await target.reply({ embeds: [initialEmbed], components: [...commandRows, navRow] });

    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== target.user?.id && interaction.user.id !== target.author?.id) {
        await interaction.reply({ content: 'Only the command author can inspect details.', ephemeral: true });
        return;
      }

        if (interaction.customId === 'owner_prev') {
        currentPage = Math.max(0, currentPage - 1);
        selectedCommand = allCommands[currentPage * pageSize] || selectedCommand;
        const updatedEmbed = buildGuideEmbed(currentPage, selectedCommand);
        await interaction.update({ embeds: [updatedEmbed], components: [...buildCommandRow(currentPage, selectedCommand?.name), buildNavRow(currentPage)] });
        return;
      }

        if (interaction.customId === 'owner_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        selectedCommand = allCommands[currentPage * pageSize] || selectedCommand;
        const updatedEmbed = buildGuideEmbed(currentPage, selectedCommand);
        await interaction.update({ embeds: [updatedEmbed], components: [...buildCommandRow(currentPage, selectedCommand?.name), buildNavRow(currentPage)] });
        return;
      }

      const commandName = interaction.customId.replace('owner_help_', '');
      const clickedCommand = allCommands.find((command) => command.name === commandName);
      if (!clickedCommand) return;

      // Toggle selection off if the same command is clicked again
      if (selectedCommand && selectedCommand.name === clickedCommand.name) {
        selectedCommand = null;
      } else {
        selectedCommand = clickedCommand;
      }

      const updatedEmbed = buildGuideEmbed(currentPage, selectedCommand);
      await interaction.update({ embeds: [updatedEmbed], components: [...buildCommandRow(currentPage, selectedCommand?.name), buildNavRow(currentPage)] });
    });
  }
};
