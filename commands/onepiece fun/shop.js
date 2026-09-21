const { EmbedBuilder } = require('discord.js');
const { ensureUser, getBounty, addBounty, ensureBaits, getBaits, addBait } = require('../../database');

const SHOP_ITEMS = {
  commonbait: { name: 'Common Bait', type: 'common_bait', price: 1000 },
  common_bait: { name: 'Common Bait', type: 'common_bait', price: 1000 },
  uncommonbait: { name: 'Uncommon Bait', type: 'uncommon_bait', price: 5000 },
  uncommon_bait: { name: 'Uncommon Bait', type: 'uncommon_bait', price: 5000 },
  rarebait: { name: 'Rare Bait', type: 'rare_bait', price: 10000 },
  rare_bait: { name: 'Rare Bait', type: 'rare_bait', price: 10000 },
  epicbait: { name: 'Epic Bait', type: 'epic_bait', price: 20000 },
  epic_bait: { name: 'Epic Bait', type: 'epic_bait', price: 20000 },
  legendarybait: { name: 'Legendary Bait', type: 'legendary_bait', price: 50000 },
  legendary_bait: { name: 'Legendary Bait', type: 'legendary_bait', price: 50000 },
  mythicbait: { name: 'Mythical Bait', type: 'mythical_bait', price: 100000 },
  mythical_bait: { name: 'Mythical Bait', type: 'mythical_bait', price: 100000 },
  ownerbait: { name: 'Owner Bait', type: 'owner_bait', price: 150000 },
  owner_bait: { name: 'Owner Bait', type: 'owner_bait', price: 150000 },
  container: { name: 'Bait Container', type: 'bait_containers', price: 8067 },
  containers: { name: 'Bait Container', type: 'bait_containers', price: 8067 },
  baitcontainer: { name: 'Bait Container', type: 'bait_containers', price: 8067 },
  bait_containers: { name: 'Bait Container', type: 'bait_containers', price: 8067 },
};

function formatBounty(amount) {
  return `${amount.toLocaleString()} 🏴‍☠️`;
}

function getShopEmbed(target, bounty, inventory) {
  return new EmbedBuilder()
    .setColor('#D4AF37')
    .setTitle('🏪 Bounty Shop')
    .setDescription('Spend bounty on bait, containers, and special rewards.')
    .addFields(
      { name: 'Common Bait', value: `Price: **${formatBounty(1000)}**\nYou Own: **${inventory.common_bait || 0}**`, inline: true },
      { name: 'Uncommon Bait', value: `Price: **${formatBounty(5000)}**\nYou Own: **${inventory.uncommon_bait || 0}**`, inline: true },
      { name: 'Rare Bait', value: `Price: **${formatBounty(10000)}**\nYou Own: **${inventory.rare_bait || 0}**`, inline: true },
      { name: 'Epic Bait', value: `Price: **${formatBounty(20000)}**\nYou Own: **${inventory.epic_bait || 0}**`, inline: true },
      { name: 'Legendary Bait', value: `Price: **${formatBounty(50000)}**\nYou Own: **${inventory.legendary_bait || 0}**`, inline: true },
      { name: 'Mythical Bait', value: `Price: **${formatBounty(100000)}**\nYou Own: **${inventory.mythical_bait || 0}**`, inline: true },
      { name: 'Bait Container', value: `Price: **${formatBounty(8067)}**\nYou Own: **${inventory.bait_containers || 0}**`, inline: true },
      { name: 'Owner Bait', value: `Price: **${formatBounty(150000)}**\nYou Own: **${inventory.owner_bait || 0}**`, inline: true },
      { name: 'Your Bounty', value: formatBounty(bounty), inline: true },
      { name: 'Buy Command', value: '`~shop buy <item> [amount]`', inline: false }
    )
    .setFooter({ text: `Shop opened for ${target.username}` })
    .setTimestamp();
}

async function purchaseItem(buyer, itemKey, amount) {
  const item = SHOP_ITEMS[itemKey];
  if (!item) {
    return { ok: false, error: '❌ That item is not available in the shop.' };
  }

  await ensureUser(buyer.id);
  await ensureBaits(buyer.id);

  const buyAmount = Number.isInteger(amount) && amount > 0 ? amount : 1;
  const totalCost = item.price * buyAmount;
  const bounty = await getBounty(buyer.id);

  if (bounty < totalCost) {
    return { ok: false, error: `❌ You need ${formatBounty(totalCost)} but only have ${formatBounty(bounty)}.` };
  }

  await addBounty(buyer.id, -totalCost);
  await addBait(buyer.id, item.type, buyAmount);

  const updatedBounty = await getBounty(buyer.id);
  const inventory = await getBaits(buyer.id);
  const inventoryValue = item.type === 'bait_containers' ? inventory.bait_containers || 0 : inventory[item.type] || 0;

  const embed = new EmbedBuilder()
    .setColor('#32CD32')
    .setTitle('✅ Purchase Complete')
    .addFields(
      { name: 'Item', value: `${item.name} x${buyAmount}`, inline: true },
      { name: 'Spent', value: formatBounty(totalCost), inline: true },
      { name: 'Remaining Bounty', value: formatBounty(updatedBounty), inline: true },
      { name: 'Inventory', value: `${inventoryValue}`, inline: true }
    )
    .setTimestamp();

  return { ok: true, embed, item };
}

module.exports = {
  name: 'shop',
  aliases: ['market', 'store'],
  description: 'Open the bounty shop and buy bait or containers',
  usage: '~shop buy <item> [amount]',

  async execute(message, args) {
    try {
      if (!message.guild) {
        return message.reply('❌ This command can only be used in a server.');
      }

      await ensureUser(message.author.id);
      await ensureBaits(message.author.id);

      if (args[0]?.toLowerCase() === 'buy') {
        const itemKey = String(args[1] || '').toLowerCase();
        const amount = Number.parseInt(args[2], 10) || 1;

        if (!SHOP_ITEMS[itemKey]) {
          return message.reply('❌ Use one of: `commonbait`, `uncommonbait`, `rarebait`, `epicbait`, `legendarybait`, `mythicalbait`, `ownerbait`, or `container`.');
        }

        const result = await purchaseItem(message.author, itemKey, amount);
        if (!result.ok) {
          return message.reply(result.error);
        }

        await message.reply({ embeds: [result.embed] });

        return;
      }

      const bounty = await getBounty(message.author.id);
      const inventory = await getBaits(message.author.id);
      return message.reply({ embeds: [getShopEmbed(message.author, bounty, inventory)] });
    } catch (error) {
      console.error('Failed to open bounty shop:', error);
      await message.reply('❌ An error occurred while opening the bounty shop.');
    }
  }
};