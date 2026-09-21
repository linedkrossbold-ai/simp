const { EmbedBuilder } = require('discord.js');

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const rizzlines = [
  'If being smooth was a crime, you would already be doing life with no parole.',
  'Do you have a map? Because I just got lost in the world you created when you walked in.',
  'I don’t normally use pickup lines, but for you I’d rewrite the whole script.',
  'You don’t need a spotlight. Your presence already rewrites the scene.',
  'My words are dangerous, but your smile is the only thing that could handle them.',
  'I came to win. You just became the reason I want to stay even after the victory.',
  'Call it fate or strategy, but every sentence I build is designed to bring me closer to you.',
  'I don’t chase. I just make the world line up so you feel like the one who came to me.',
  'Most people gamble with luck. I’m putting everything on the certainty of your attention.',
  'I’m not here to impress you. I’m here to make you realize I already planned for this moment.',
  'You’re the only thing in the room I can’t afford to miss. That’s the definition of a winning hand.',
  'I don’t need subtlety. I need you to see how well I can handle the inevitable.',
  'Legends are written about people who take risks. I’m making this one about the risk of ignoring you.',
  'Everyone else is noise. You’re the moment I decided I didn’t want to waste.',
  'You don’t have to say yes. You just have to know I already chose you long before the line landed.',
  'The real power move is not speaking. The real play is doing it with a sentence that leaves no choice.',
  'I could tell you a thousand times I’m serious, but I’d rather show you in the way these words land.',
  'This is not a line. This is the result of me sharpening every second, so it hits exactly where you notice.',
  'I’m not trying to make you fall. I’m trying to make you decide that staying is the better move.',
  'Call it chemistry or code, but the moment you appear, everything I say becomes undeniable.'
];

module.exports = {
  name: 'rizzline',
  description: 'Show the most diabolical, best-of-the-best rizzline.',
  usage: '~rizzline [@user]',

  async execute(message) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      const targetMention = targetUser.id === message.author.id ? 'you' : `<@${targetUser.id}>`;
      const line = pick(rizzlines).replace(/you/i, targetMention);

      const embed = new EmbedBuilder()
        .setColor('#8E24AA')
        .setTitle('💘 Diabolical Rizzline')
        .setDescription(line)
        .setFooter({ text: targetUser.id === message.author.id ? 'Self-rizz activated.' : `Target: ${targetUser.username}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to run rizzline command:', error);
      await message.reply('❌ The rizz was too powerful to handle. Try again.');
    }
  }
};
