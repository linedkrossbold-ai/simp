const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
const { getPrefix, isCmdhelpVisibleCommand, getHelpCategory } = require('../utils/helpMenus');

module.exports = {
  name: 'cmdhelp',
  description: 'Show the main command help menu',
  aliases: ['help'],
  data: new SlashCommandBuilder()
    .setName('cmdhelp')
    .setDescription('Show the main command help menu'),

  async execute(target) {
    const PREFIX = getPrefix(target);
    const commands = [...new Set([...target.client.commands.values()])].filter(isCmdhelpVisibleCommand);
    const groups = new Map([['General', []], ['Fun', []], ['Moderation', []], ['Server Managing', []]]);
    for (const command of commands) {
      const category = getHelpCategory(command);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(command);
    }
    const availableGroups = [...groups.entries()].filter(([, entries]) => entries.length);
    const buildEmbed = (selected = null) => {
      if (!selected) {
        return new EmbedBuilder()
          .setColor('#8E44AD')
          .setTitle('Commands')
          .setDescription('Information\n\nCommands: **' + commands.length + '**\nGuilds: **' + (target.client.guilds?.cache?.size || 0) + '**\nUsers: **' + (target.client.guilds?.cache?.reduce((total, guild) => total + (guild.memberCount || 0), 0) || 0) + '**')
          .addFields({ name: 'Modules', value: 'Choose a module below to browse its commands.', inline: false })
          .setTimestamp();
      }

      const lines = selected[1].map((command) => `**${PREFIX}${command.name}**${command.aliases?.length ? ` (${command.aliases.map((alias) => `${PREFIX}${alias}`).join(', ')})` : ''}\n${command.description || 'No description provided.'}`);
      return new EmbedBuilder()
        .setColor('#8E44AD')
        .setTitle(selected[0])
        .setDescription(lines.join('\n\n').slice(0, 4000) || 'No commands found.')
        .setFooter({ text: `Prefix: ${PREFIX} | Aliases are shown beside every command` })
        .setTimestamp();
    };

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_module_select')
      .setPlaceholder('Modules')
      .addOptions([{ label: 'Overview', value: 'overview', description: 'Bot information and statistics' }, ...availableGroups.map(([name, entries]) => ({ label: name, value: name.toLowerCase(), description: `${entries.length} commands` }))]);
    const reply = await target.reply({ embeds: [buildEmbed()], components: [new ActionRowBuilder().addComponents(menu)] });
    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== (target.author?.id || target.user?.id)) return interaction.reply({ content: 'Only the command author can use this menu.', ephemeral: true });
      const selected = interaction.values[0] === 'overview' ? null : availableGroups.find(([name]) => name.toLowerCase() === interaction.values[0]);
      await interaction.update({ embeds: [buildEmbed(selected)], components: [new ActionRowBuilder().addComponents(menu)] });
    });
  }
};
