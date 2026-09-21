const { getBannedImages } = require('../database');

const HASH_SIZE = 16;
const MAX_DISTANCE = 48;

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed with status ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function createImageHash(input) {
  const { Jimp, intToRGBA } = require('jimp');
  const image = await Jimp.read(input);
  image.resize({ w: HASH_SIZE, h: HASH_SIZE }).greyscale();
  const pixels = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      pixels.push(intToRGBA(image.getPixelColor(x, y)).r);
    }
  }
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  return pixels.map((value) => value >= average ? '1' : '0').join('');
}

function hashDistance(left, right) {
  if (!left || !right || left.length !== right.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

async function findBannedImage(guildId, url) {
  const currentHash = await createImageHash(await downloadImage(url));
  const bannedImages = await getBannedImages(guildId);
  return bannedImages.find((image) => hashDistance(currentHash, image.imageHash) <= MAX_DISTANCE) || null;
}

function isImageAttachment(attachment) {
  const contentType = String(attachment?.contentType || '').toLowerCase();
  const name = String(attachment?.name || attachment?.url || '').toLowerCase();
  return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(name);
}

module.exports = { createImageHash, findBannedImage, isImageAttachment, hashDistance };
