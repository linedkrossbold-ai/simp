const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
const { getPrefix, getCommandDetails, getCommandsByNames } = require('../utils/helpMenus');

module.exports = {
  name: 'funguide',
  description: 'Show the custom One Piece-style command guide',
  usage: '~funguide',
  data: new SlashCommandBuilder()
    .setName('funguide')
    .setDescription('Show the custom One Piece-style command guide'),

  async execute(target) {
    const PREFIX = getPrefix(target);
    const funCommands = getCommandsByNames(target.client, [
      'blacktea', 'greentea', 'mixtea', 'redtea', 'yellowtea', 'bounty', 'catch', 'caught', 'release', 'daily', 'dailystreak', 'quests', 'openbait', 'baits', 'shop', 'sail', 'fish', 'opencrate', 'give', 'givebounty', 'slot', 'roulette', 'usecoin', 'ping', 'coinleaderboard', 'execute', 'entry', 'rizz', 'rizzline'
    ]);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(funCommands.length / pageSize));
    let currentPage = 0;

    const buildGuideEmbed = (page, selectedCommand = null) => {
      const start = page * pageSize;
      const pageCommands = funCommands.slice(start, start + pageSize);
      const commandList = pageCommands.map((command) => `\`${PREFIX}${command.name}\``).join(' • ');
      const details = selectedCommand ? getCommandDetails(selectedCommand, PREFIX) : null;

      return new EmbedBuilder()
        .setColor('#F2C94C')
        .setTitle('🏴‍☠️ One Piece Fun Guide')
        .setDescription(`Page ${page + 1}/${totalPages}. Choose a command below to view its details. Prefix: \`${PREFIX}\``)
        .addFields(
          { name: '⚓ Commands', value: commandList || 'No commands available.', inline: false },
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
      const pageCommands = funCommands.slice(start, start + pageSize);
      const buttons = pageCommands.map((command) => new ButtonBuilder()
        .setCustomId(`help_select_${command.name}`)
        .setLabel(command.name)
        .setStyle(command.name === selectedCommandName ? ButtonStyle.Success : ButtonStyle.Primary));

      // Discord limits 5 components per ActionRow; split into rows of up to 5 buttons
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        const slice = buttons.slice(i, i + 5);
        rows.push(new ActionRowBuilder().addComponents(slice));
      }

      return rows;
    };

    const buildNavRow = (page) => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('help_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('help_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );

    let selectedCommand = funCommands[0] || null;
    const initialEmbed = buildGuideEmbed(currentPage, selectedCommand);
    const commandRows = buildCommandRow(currentPage, selectedCommand?.name);
    const navRow = buildNavRow(currentPage);
    const reply = await target.reply({ embeds: [initialEmbed], components: [...commandRows, navRow] });

    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== target.author?.id && interaction.user.id !== target.user?.id) {
        await interaction.reply({ content: 'Only the command author can inspect details.', ephemeral: true });
        return;
      }

        if (interaction.customId === 'help_prev') {
        currentPage = Math.max(0, currentPage - 1);
        selectedCommand = funCommands[currentPage * pageSize] || selectedCommand;
        const updatedEmbed = buildGuideEmbed(currentPage, selectedCommand);
          await interaction.update({ embeds: [updatedEmbed], components: [...buildCommandRow(currentPage, selectedCommand?.name), buildNavRow(currentPage)] });
        return;
      }

        if (interaction.customId === 'help_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        selectedCommand = funCommands[currentPage * pageSize] || selectedCommand;
        const updatedEmbed = buildGuideEmbed(currentPage, selectedCommand);
        await interaction.update({ embeds: [updatedEmbed], components: [...buildCommandRow(currentPage, selectedCommand?.name), buildNavRow(currentPage)] });
        return;
      }

      const commandName = interaction.customId.replace('help_select_', '');
      const clickedCommand = funCommands.find((command) => command.name === commandName);
      if (!clickedCommand) return;

      // Toggle: deselect if the same command is clicked again
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
