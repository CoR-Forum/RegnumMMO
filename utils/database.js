/**
 * Database Utility Functions
 * Centralized database query functions to reduce duplication
 */

/**
 * Get player inventory with item details
 * @param {number} characterId - The character ID
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<Array>} Inventory items with details
 */
async function getPlayerInventory(characterId, db) {
  const [inventory] = await db.promise().query(`
    SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
    FROM player_inventory pi
    JOIN items i ON pi.item_id = i.id
    WHERE pi.character_id = ?
    ORDER BY pi.tab_id
  `, [characterId]);

  return inventory;
}

/**
 * Validate and fetch shop item details
 * @param {number} npcId - The NPC shop ID
 * @param {number} itemId - The item ID
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<object|null>} Shop item details or null if not found
 */
async function validateAndFetchShopItem(npcId, itemId, db) {
  const [shopItem] = await db.promise().query(`
    SELECT si.price, si.quantity as stock, i.name, i.value, i.stackable
    FROM shop_items si
    JOIN items i ON si.item_id = i.id
    WHERE si.npc_id = ? AND si.item_id = ?
  `, [npcId, itemId]);

  return shopItem?.[0] || null;
}

/**
 * Sync player data to database
 * @param {number} characterId - The character ID
 * @param {object} player - Player object with position and stats
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<void>}
 */
async function syncPlayerToDB(characterId, player, db) {
  try {
    await db.promise().query(
      'INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)',
      [characterId, player.position.x, player.position.y]
    );

    await db.promise().query(
      'UPDATE characters SET current_health = ?, current_mana = ?, current_stamina = ? WHERE id = ?',
      [
        Math.round(player.character.current_health),
        Math.round(player.character.current_mana),
        Math.round(player.character.current_stamina),
        characterId
      ]
    );
  } catch (error) {
    console.error('Error syncing player to DB:', error);
    throw error;
  }
}

/**
 * Get shop items for an NPC
 * @param {number} npcId - The NPC shop ID
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<Array>} Shop items with details
 */
async function getShopItems(npcId, db) {
  const [shopItems] = await db.promise().query(`
    SELECT si.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement
    FROM shop_items si
    JOIN items i ON si.item_id = i.id
    WHERE si.npc_id = ? AND si.quantity > 0
  `, [npcId]);

  return shopItems;
}

/**
 * Get character gold amount
 * @param {number} characterId - The character ID
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<number>} Gold amount
 */
async function getCharacterGold(characterId, db) {
  const [result] = await db.promise().query(
    'SELECT gold FROM characters WHERE id = ?',
    [characterId]
  );

  return result[0]?.gold || 0;
}

/**
 * Update character gold amount
 * @param {number} characterId - The character ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @param {object} db - MySQL database connection pool
 * @returns {Promise<number>} New gold amount
 */
async function updateCharacterGold(characterId, amount, db) {
  await db.promise().query(
    'UPDATE characters SET gold = gold + ? WHERE id = ?',
    [amount, characterId]
  );

  return await getCharacterGold(characterId, db);
}

module.exports = {
  getPlayerInventory,
  validateAndFetchShopItem,
  syncPlayerToDB,
  getShopItems,
  getCharacterGold,
  updateCharacterGold
};
