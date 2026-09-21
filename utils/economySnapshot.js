const fs = require('fs');
const path = require('path');

function buildEconomySnapshotEntry({ userId, user, baitRow, dailyRow }) {
  const safeUser = user || {};
  const safeBaits = baitRow || {};
  const safeDaily = dailyRow || {};

  return {
    userId,
    coins: Number(safeUser.coins || 0),
    bounty: Number(safeUser.bounty || 0),
    credits: Number(safeUser.credits || 0),
    tokens: Number(safeUser.tokens || 0),
    messageCount: Number(safeUser.messageCount || 0),
    baitInventory: {
      bait_containers: Number(safeBaits.bait_containers || 0),
      common_bait: Number(safeBaits.common_bait || 0),
      uncommon_bait: Number(safeBaits.uncommon_bait || 0),
      rare_bait: Number(safeBaits.rare_bait || 0),
      epic_bait: Number(safeBaits.epic_bait || 0),
      legendary_bait: Number(safeBaits.legendary_bait || 0),
      mythical_bait: Number(safeBaits.mythical_bait || 0),
      owner_bait: Number(safeBaits.owner_bait || 0)
    },
    dailyStreak: Number(safeDaily.dailyStreak || 0),
    lastUpdated: new Date().toISOString()
  };
}

function hasEconomySnapshotData(user = {}, baitRow = {}, dailyRow = {}, extra = {}) {
  const economicFields = [
    Number(user?.coins || 0),
    Number(user?.bounty || 0),
    Number(user?.credits || 0),
    Number(user?.tokens || 0),
    Number(user?.messageCount || 0)
  ];

  const baitValues = Object.values(baitRow || {}).map((value) => Number(value || 0));
  const dailyValue = Number(dailyRow?.dailyStreak || 0);
  const extraValues = Object.values(extra || {}).map((value) => Number(value || 0));

  return [...economicFields, ...baitValues, dailyValue, ...extraValues].some((value) => value > 0);
}

async function saveEconomySnapshotToFile({ db, filePath, includeOnlyWithData = true }) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT u.userId, u.coins, u.bounty, u.credits, u.tokens, u.messageCount, b.bait_containers, b.common_bait, b.uncommon_bait, b.rare_bait, b.epic_bait, b.legendary_bait, b.mythical_bait, b.owner_bait, d.dailyStreak
       FROM users u
       LEFT JOIN baits b ON b.userId = u.userId
       LEFT JOIN daily_rewards d ON d.userId = u.userId
       ORDER BY u.userId ASC`,
      [],
      (err, resultRows) => {
        if (err) return reject(err);
        resolve(resultRows || []);
      }
    );
  });

  const entries = [];
  for (const row of rows) {
    const user = {
      coins: row.coins,
      bounty: row.bounty,
      credits: row.credits,
      tokens: row.tokens,
      messageCount: row.messageCount
    };
    const baitRow = {
      bait_containers: row.bait_containers,
      common_bait: row.common_bait,
      uncommon_bait: row.uncommon_bait,
      rare_bait: row.rare_bait,
      epic_bait: row.epic_bait,
      legendary_bait: row.legendary_bait,
      mythical_bait: row.mythical_bait,
      owner_bait: row.owner_bait
    };
    const dailyRow = { dailyStreak: row.dailyStreak };

    if (includeOnlyWithData && !hasEconomySnapshotData(user, baitRow, dailyRow)) {
      continue;
    }

    entries.push(buildEconomySnapshotEntry({ userId: row.userId, user, baitRow, dailyRow }));
  }

  const outputDir = path.dirname(filePath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2));
  return entries;
}

function normalizeSnapshotEntry(entry = {}) {
  const baitInventory = entry.baitInventory || entry.baits || entry.inventory || {};
  const userId = entry.userId || entry.user_id || entry.id;

  if (!userId) {
    return null;
  }

  return {
    userId,
    coins: Number(entry.coins ?? entry.coinBalance ?? entry.coin ?? 0),
    bounty: Number(entry.bounty ?? 0),
    credits: Number(entry.credits ?? 0),
    tokens: Number(entry.tokens ?? 0),
    messageCount: Number(entry.messageCount ?? entry.messages ?? 0),
    baitInventory: {
      bait_containers: Number(baitInventory.bait_containers ?? baitInventory.baitContainers ?? 0),
      common_bait: Number(baitInventory.common_bait ?? baitInventory.commonBait ?? 0),
      uncommon_bait: Number(baitInventory.uncommon_bait ?? baitInventory.uncommonBait ?? 0),
      rare_bait: Number(baitInventory.rare_bait ?? baitInventory.rareBait ?? 0),
      epic_bait: Number(baitInventory.epic_bait ?? baitInventory.epicBait ?? 0),
      legendary_bait: Number(baitInventory.legendary_bait ?? baitInventory.legendaryBait ?? 0),
      mythical_bait: Number(baitInventory.mythical_bait ?? baitInventory.mythicalBait ?? 0),
      owner_bait: Number(baitInventory.owner_bait ?? baitInventory.ownerBait ?? 0)
    },
    dailyStreak: Number(entry.dailyStreak ?? entry.daily_streak ?? entry.streak ?? 0)
  };
}

function getTableColumns(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).map((row) => row.name));
    });
  });
}

async function restoreEconomySnapshotFromFile({ db, filePath }) {
  if (!db || !filePath) {
    throw new Error('restoreEconomySnapshotFromFile requires a database connection and file path');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];

  const normalizedEntries = entries.map(normalizeSnapshotEntry).filter(Boolean);
  if (normalizedEntries.length === 0) {
    return 0;
  }

  const userColumns = await getTableColumns(db, 'users');
  const baitColumns = await getTableColumns(db, 'baits');
  const dailyColumns = await getTableColumns(db, 'daily_rewards');
  const hasUsersLastUpdated = userColumns.includes('lastUpdated');
  const hasBaitsLastUpdated = baitColumns.includes('lastUpdated');
  const hasDailyLastDaily = dailyColumns.includes('lastDaily');

  const tasks = normalizedEntries.map(async (entry) => {
    await new Promise((resolve, reject) => {
      const userQuery = hasUsersLastUpdated
        ? `INSERT OR REPLACE INTO users (userId, credits, tokens, coins, messageCount, bounty, lastUpdated)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        : `INSERT OR REPLACE INTO users (userId, credits, tokens, coins, messageCount, bounty)
           VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(userQuery, [entry.userId, entry.credits, entry.tokens, entry.coins, entry.messageCount, entry.bounty], (err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve, reject) => {
      const baitQuery = hasBaitsLastUpdated
          ? `INSERT OR REPLACE INTO baits (userId, bait_containers, common_bait, uncommon_bait, rare_bait, epic_bait, legendary_bait, mythical_bait, owner_bait, lastUpdated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          : `INSERT OR REPLACE INTO baits (userId, bait_containers, common_bait, uncommon_bait, rare_bait, epic_bait, legendary_bait, mythical_bait, owner_bait)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          db.run(baitQuery, [entry.userId, entry.baitInventory.bait_containers, entry.baitInventory.common_bait, entry.baitInventory.uncommon_bait, entry.baitInventory.rare_bait, entry.baitInventory.epic_bait, entry.baitInventory.legendary_bait, entry.baitInventory.mythical_bait, entry.baitInventory.owner_bait], (err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve, reject) => {
      const dailyQuery = hasDailyLastDaily
        ? `INSERT OR REPLACE INTO daily_rewards (userId, dailyStreak, lastDaily)
           VALUES (?, ?, CURRENT_TIMESTAMP)`
        : `INSERT OR REPLACE INTO daily_rewards (userId, dailyStreak)
           VALUES (?, ?)`;
      db.run(dailyQuery, [entry.userId, entry.dailyStreak], (err) => (err ? reject(err) : resolve()));
    });
  });

  await Promise.all(tasks);
  return normalizedEntries.length;
}

module.exports = {
  buildEconomySnapshotEntry,
  hasEconomySnapshotData,
  saveEconomySnapshotToFile,
  restoreEconomySnapshotFromFile
};
