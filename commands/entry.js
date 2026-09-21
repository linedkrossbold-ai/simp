const { EmbedBuilder } = require('discord.js');
const { isOwner } = require('../utils/owner');

function buildEntryAnnouncement(customText) {
  const headline = String(customText || 'The King has arrived! Make way for the king!').trim();

  return [
    '👑👑👑',
    '🎺🥁🥁🎺',
    `**${headline}**`,
    '🟥 Red carpet rolling... 🧑‍🎤',
    '🎭 The court rises. The drums thunder. All eyes turn. 👑',
    '✨ Let the grand procession begin.'
  ].join('\n');
}

module.exports = {
  name: 'entry',
  aliases: ['royalentry', 'kingentry'],
  description: 'Owner-only royal entrance announcement with dramatic flair',
  usage: '~entry [message]',
  ownerOnly: true,

  async execute(message, args) {
    try {
      if (!isOwner(message.author.id)) {
        return message.reply('❌ Only the owner can use this command.');
      }

      // Parse flags: --fast, --confetti, --autodelete <seconds>
      const argv = [...args];
      let fast = false;
      let confetti = false;
      let autodeleteSeconds = 0;

      // collect positional text parts
      const textParts = [];
      for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--fast') {
          fast = true;
          continue;
        }
        if (a === '--confetti') {
          confetti = true;
          continue;
        }
        if (a === '--autodelete') {
          const next = argv[i + 1];
          const n = parseInt(next, 10);
          if (!Number.isNaN(n) && n > 0) {
            autodeleteSeconds = n;
            i++; // consume
            continue;
          }
        }
        textParts.push(a);
      }

      const customText = textParts.join(' ').trim();
      const headline = customText || undefined;

      // Initial embed (preparation)
      const prepping = new EmbedBuilder()
        .setColor('#6B3E26')
        .setTitle('👑 Royal Entrance — Preparations')
        .setDescription('The court readies itself. Drummers warm up. Await the entrance...')
        .setTimestamp();

      const msg = await message.reply({ embeds: [prepping], allowedMentions: { parse: [] } });

      // delays (ms)
      const delays = fast ? { fanfare: 700, carpet: 1400, final: 2200 } : { fanfare: 1500, carpet: 3500, final: 6000 };

      // Step 1: Fanfare
      setTimeout(async () => {
        try {
          const fanfare = EmbedBuilder.from(prepping)
            .setColor('#D4AF37')
            .setTitle('🎺 A Royal Fanfare')
            .setDescription('🎺🥁 The trumpets sound! The drums roll — the palace stirs with excitement.')
            .setTimestamp();
          await msg.edit({ embeds: [fanfare] });
        } catch (err) {
          console.error('Failed fanfare edit:', err);
        }
      }, delays.fanfare);

      // Step 2: Red carpet
      setTimeout(async () => {
        try {
          const carpet = new EmbedBuilder()
            .setColor('#C62828')
            .setTitle('🟥 Red Carpet')
            .setDescription('🧾 The red carpet is rolled out. Heralds shout. Torches blaze. The crowd leans forward.')
            .setTimestamp();
          await msg.edit({ embeds: [carpet] });
        } catch (err) {
          console.error('Failed red carpet edit:', err);
        }
      }, delays.carpet);

      // Step 3: Final entrance
      setTimeout(async () => {
        try {
          const finalText = buildEntryAnnouncement(headline);
          const finalEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('👑 Royal Entrance')
            .setDescription(finalText)
            .setTimestamp();

          // if confetti, attach a celebratory GIF link in the embed footer
          if (confetti) {
            finalEmbed.setFooter({ text: '🎉 Confetti!', iconURL: 'https://i.imgur.com/3M3XK2G.gif' });
          }

          await msg.edit({ embeds: [finalEmbed] });

          // autodelete if requested
          if (autodeleteSeconds > 0) {
            setTimeout(() => {
              msg.delete().catch(() => {});
            }, autodeleteSeconds * 1000);
          }
        } catch (err) {
          console.error('Failed final entrance edit:', err);
        }
      }, delays.final);

    } catch (error) {
      console.error(error);
      await message.reply('❌ An error occurred while making the royal entrance.');
    }
  }
};

module.exports.buildEntryAnnouncement = buildEntryAnnouncement;
