-- Grant permissions for regnum_user to connect from any host
GRANT ALL PRIVILEGES ON regnum_db.* TO 'regnum_user'@'%' IDENTIFIED BY 'regnum_password';
FLUSH PRIVILEGES;
-- ========================================
-- PERFORMANCE INDEXES
-- Add indexes to improve query performance
-- Expected improvement: 10-100x faster queries
-- ========================================

-- Characters table indexes
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON regnum_db.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_realm ON regnum_db.characters(realm);
CREATE INDEX IF NOT EXISTS idx_characters_user_realm ON regnum_db.characters(user_id, realm);

-- Positions table indexes
CREATE INDEX IF NOT EXISTS idx_positions_character_id ON regnum_db.positions(character_id);

-- Player inventory indexes
CREATE INDEX IF NOT EXISTS idx_player_inventory_character ON regnum_db.player_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_item ON regnum_db.player_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_char_tab ON regnum_db.player_inventory(character_id, tab_id);

-- Shop items indexes
CREATE INDEX IF NOT EXISTS idx_shop_items_npc ON regnum_db.shop_items(npc_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_npc_item ON regnum_db.shop_items(npc_id, item_id);

-- NPCs table indexes
CREATE INDEX IF NOT EXISTS idx_npcs_realm ON regnum_db.npcs(realm);
CREATE INDEX IF NOT EXISTS idx_npcs_position ON regnum_db.npcs(x, y);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_forum_userid ON regnum_db.users(forum_userID);
CREATE INDEX IF NOT EXISTS idx_users_username ON regnum_db.users(username);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON regnum_db.sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON regnum_db.sessions(expires);
