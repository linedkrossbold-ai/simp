const { EmbedBuilder } = require('discord.js');

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const rizzes = [
  'I don’t do subtle, but I do do unforgettable—consider this your introduction.',
  'I’m not looking to win you over. I’m looking to make you wish I never stopped.',
  'You’re the only person who could make a perfect line feel like an understatement.',
  'Most people practice their delivery. I already planned the part where you notice.',
  'This isn’t a compliment. It’s me saying you already changed the rules by showing up.',
  'I could say a thousand things, but the one that matters is the one that makes you stay.',
  'I don’t give lines. I give reasons why you should keep paying attention.',
  'If confidence had a shape, it would be this sentence aimed right where you’re listening.',
  'You might think I’m playing with words. I’m actually playing the moment you’ll remember.',
  'I’m not here to impress. I’m here to make you realize you’re the one being noticed.',
  'You’re not the type I chase. You’re the type that makes the whole room move toward me.',
  'The real power move is making you feel the choice before you even take it.',
  'I don’t need a second chance. I just need you to understand this first line.',
  'I came prepared for reactions. What I wasn’t ready for was how naturally you make them happen.',
  'This line isn’t for you. It’s for the part of you that already knows it’s true.',
  'You’re the only variable I didn’t need to calculate. The outcome was obvious the moment you arrived.',
  'Everything else can wait. The only thing worth saying is what you’re already expecting.',
  'You can keep your standards. I already built the sentence to meet them.',
  'I’m not telling you what I want. I’m telling you what you already decided the moment you noticed me.',
  'You’re the one thing I don’t have to sell. I just have to remind you why it belongs here.'
];

module.exports = {
  name: 'rizz',
  aliases: ['smooth', 'charisma'],
  description: 'Send a powerful rizz line to a mentioned user.',
  usage: '~rizz @user',

  async execute(message) {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      const targetMention = targetUser.id === message.author.id ? 'you' : `<@${targetUser.id}>`;
      const line = pick(rizzes).replace(/you/i, targetMention);

      const embed = new EmbedBuilder()
        .setColor('#6A1B9A')
        .setTitle('💎 Rizz Delivered')
        .setDescription(line)
        .setFooter({ text: targetUser.id === message.author.id ? 'Self-rizz engaged.' : `Target: ${targetUser.username}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to run rizz command:', error);
      await message.reply('❌ The rizz overheated. Try again.');
    }
  }
};
