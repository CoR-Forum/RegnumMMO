-- Database Performance Indexes
-- This file adds indexes to improve query performance for the Regnum Online database
-- Expected performance improvement: 10-100x faster queries for frequently accessed data

-- Characters table indexes
-- Speeds up character lookups by user (used in character selection)
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);

-- Speeds up character lookups by realm (used in realm filtering)
CREATE INDEX IF NOT EXISTS idx_characters_realm ON characters(realm);

-- Composite index for user+realm lookups (used to check "one character per realm" rule)
CREATE INDEX IF NOT EXISTS idx_characters_user_realm ON characters(user_id, realm);

-- Positions table indexes
-- Speeds up position lookups by character (used in every player join and movement sync)
CREATE INDEX IF NOT EXISTS idx_positions_character_id ON positions(character_id);

-- Player inventory indexes
-- Speeds up inventory queries by character (used in inventory display, buy/sell operations)
CREATE INDEX IF NOT EXISTS idx_player_inventory_character ON player_inventory(character_id);

-- Speeds up inventory queries by item (used in stackable item checks)
CREATE INDEX IF NOT EXISTS idx_player_inventory_item ON player_inventory(item_id);

-- Composite index for character+tab lookups (used in tab switching)
CREATE INDEX IF NOT EXISTS idx_player_inventory_char_tab ON player_inventory(character_id, tab_id);

-- Shop items indexes
-- Speeds up shop queries by NPC (used when opening shop)
CREATE INDEX IF NOT EXISTS idx_shop_items_npc ON shop_items(npc_id);

-- Speeds up shop item validation (used in buy operations)
CREATE INDEX IF NOT EXISTS idx_shop_items_npc_item ON shop_items(npc_id, item_id);

-- NPCs table indexes
-- Speeds up NPC queries by realm (used in realm-specific NPC filtering)
CREATE INDEX IF NOT EXISTS idx_npcs_realm ON npcs(realm);

-- Speeds up NPC queries by position (used in spatial queries for visibility)
CREATE INDEX IF NOT EXISTS idx_npcs_position ON npcs(x, y);

-- Users table indexes
-- Speeds up user lookups by forum ID (used in authentication)
CREATE INDEX IF NOT EXISTS idx_users_forum_userid ON users(forum_userID);

-- Speeds up user lookups by username (used in login)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Sessions table indexes (if exists)
-- Speeds up session validation (used in every authenticated request)
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Speeds up session cleanup (used in expired session removal)
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- Display index creation results
SELECT 'Database indexes created successfully!' as status;
SELECT
  TABLE_NAME as 'table',
  INDEX_NAME as 'index',
  COLUMN_NAME as 'columns'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('characters', 'positions', 'player_inventory', 'shop_items', 'npcs', 'users', 'sessions')
ORDER BY TABLE_NAME, INDEX_NAME;
