const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { ensureUser, getBounty, addBounty } = require('../../database');

function parseAmount(input) {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.replace(/,/g, '').trim().toLowerCase();

  if (normalized === 'all') {
    return 'all';
  }

  const match = normalized.match(/^([0-9]*\.?[0-9]+)\s*([km])?$/);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;

  switch (match[2]) {
    case 'k':
      return Math.floor(value * 1000);
    case 'm':
      return Math.floor(value * 1000000);
    default:
      return Math.floor(value);
  }
}

module.exports = {
  name: 'roulette',
  aliases: ['wheel'],
  description: 'Challenge another member to a 50/50 bounty duel or gamble alone',
  usage: '~roulette [@user] <amount|all>',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ This command can only be used in a server.');
    }

    const mention = message.mentions.users.first();
    let amountArg;
    let opponent = null;

    if (mention) {
      opponent = mention;
      amountArg = args.slice(1).join(' ').trim();
    } else {
      amountArg = args[0];
    }

    await ensureUser(message.author.id);
    const authorBounty = await getBounty(message.author.id);
    const parsedAmount = parseAmount(amountArg);

    const amount = parsedAmount === 'all' ? authorBounty : parsedAmount;
    if (!Number.isInteger(amount) || amount < 1) {
      return message.reply('❌ Please enter a valid bounty amount to gamble. Use numbers like `1000`, `1.5k`, `2m`, or `all`.');
    }

    if (authorBounty < amount) {
      return message.reply(`❌ You do not have enough bounty. You have ${authorBounty} but tried to gamble ${amount}.`);
    }

    if (!opponent || opponent.id === message.author.id) {
      const win = Math.random() < 0.5;
      const embed = new EmbedBuilder().setTimestamp();

      if (win) {
        await addBounty(message.author.id, amount);
        embed
          .setColor('#00FF00')
          .setTitle('🎲 Roulette Win')
          .setDescription(`You survived the spin and won ${amount.toLocaleString()} bounty!`)
          .addFields(
            { name: 'Result', value: 'Win', inline: true },
            { name: 'Bounty Change', value: `+${amount.toLocaleString()} 🏴‍☠️`, inline: true }
          );
      } else {
        await addBounty(message.author.id, -amount);
        embed
          .setColor('#FF4500')
          .setTitle('💥 Roulette Lose')
          .setDescription(`Bad luck! You lost ${amount.toLocaleString()} bounty.`)
          .addFields(
            { name: 'Result', value: 'Lose', inline: true },
            { name: 'Bounty Change', value: `-${amount.toLocaleString()} 🏴‍☠️`, inline: true }
          );
      }

      return message.reply({ embeds: [embed] });
    }

    if (opponent.bot) {
      return message.reply('❌ You cannot challenge a bot to roulette.');
    }

    await ensureUser(opponent.id);
    const opponentBounty = await getBounty(opponent.id);
    if (opponentBounty < amount) {
      return message.reply(`❌ ${opponent.username} does not have enough bounty to accept this challenge.`);
    }

    const challengeEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎲 Roulette Challenge')
      .setDescription(`${message.author} has challenged ${opponent} to a 50/50 roulette duel for ${amount.toLocaleString()} bounty each.`)
      .addFields(
        { name: 'Challenger', value: `${message.author.tag}`, inline: true },
        { name: 'Opponent', value: `${opponent.tag}`, inline: true },
        { name: 'Staked Amount', value: `${amount.toLocaleString()} bounty`, inline: true }
      )
      .setFooter({ text: 'Opponent: accept or decline within 30 seconds.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_roulette')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('decline_roulette')
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

    const challengeMessage = await message.reply({ embeds: [challengeEmbed], components: [row] });

    try {
      const interaction = await challengeMessage.awaitMessageComponent({
        filter: (button) => button.user.id === opponent.id,
        componentType: ComponentType.Button,
        time: 30000
      });

      const disabledRow = new ActionRowBuilder().addComponents(
        row.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
      );

      if (interaction.customId === 'decline_roulette') {
        await interaction.update({
          embeds: [challengeEmbed.setColor('#FF4500').setTitle('❌ Challenge Declined').setDescription(`${opponent} declined the roulette challenge.`)],
          components: [disabledRow]
        });
        return;
      }

      const challengerWon = Math.random() < 0.5;
      const winner = challengerWon ? message.author : opponent;
      const loser = challengerWon ? opponent : message.author;

      await addBounty(winner.id, amount);
      await addBounty(loser.id, -amount);

      const winnerTotal = await getBounty(winner.id);
      const loserTotal = await getBounty(loser.id);

      const resultEmbed = new EmbedBuilder()
        .setColor(challengerWon ? '#00FF00' : '#FF4500')
        .setTitle('🎲 Roulette Duel Result')
        .setDescription(`${winner} survived the roulette spin and wins ${amount.toLocaleString()} bounty from ${loser}!`)
        .addFields(
          { name: 'Winner', value: `${winner.tag}`, inline: true },
          { name: 'Loser', value: `${loser.tag}`, inline: true },
          { name: 'Amount Exchanged', value: `+${amount.toLocaleString()} / -${amount.toLocaleString()}`, inline: false },
          { name: `${winner.username} Total`, value: `${winnerTotal.toLocaleString()} bounty`, inline: true },
          { name: `${loser.username} Total`, value: `${loserTotal.toLocaleString()} bounty`, inline: true }
        )
        .setTimestamp();

      await interaction.update({ embeds: [resultEmbed], components: [disabledRow] });
    } catch (error) {
      const disabledRow = new ActionRowBuilder().addComponents(
        row.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
      );
      await challengeMessage.edit({
        embeds: [challengeEmbed.setColor('#808080').setTitle('⌛ Challenge Timed Out').setDescription(`No response from ${opponent} in 30 seconds.`)],
        components: [disabledRow]
      }).catch(() => {});
    }
  }
};