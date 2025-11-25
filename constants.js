/**
 * Game Configuration Constants
 * Centralized configuration for the Regnum Online MMORPG
 */

const GAME_CONFIG = {
  // Movement constants
  MOVEMENT: {
    BASE_SPEED: 0.3,
    SPRINT_MULTIPLIER: 20,
    MOVEMENT_KEYS: ['w', 'a', 's', 'd', 'shift']
  },

  // Map configuration
  MAP: {
    BOUNDS: { minX: 0, maxX: 6144, minY: 0, maxY: 6144 },
    DEFAULT_POS: { x: 238, y: 5370 },
    REALM_START_POSITIONS: {
      'Syrtis': { x: 238, y: 5370 },
      'Ignis': { x: 4992, y: 582 },
      'Alsius': { x: 1502, y: 332 }
    }
  },

  // Vision and zoom
  VISION: {
    VIEW_DISTANCE: 1000, // Base NPC visibility distance
    INITIAL_ZOOM: 9,
    // Calculate view distance based on zoom level
    getViewDistance: (zoom) => 100 * Math.pow(2, 9 - zoom)
  },

  // Regeneration rates (per 20ms tick)
  REGENERATION: {
    HEALTH_TICK: 0.005,    // Health per tick
    MANA_TICK: 0.005,      // Mana per tick
    STAMINA_IDLE: 0.04,    // Stamina when idle
    STAMINA_WALK: 0.02,    // Stamina when walking
    STAMINA_RUN: -0.02     // Stamina drain when running
  },

  // Regeneration display rates (per second for UI)
  REGENERATION_DISPLAY: {
    HEALTH_PER_SEC: 0.25,
    MANA_PER_SEC: 0.25,
    STAMINA_IDLE_PER_SEC: 2.0,
    STAMINA_WALK_PER_SEC: 1.0,
    STAMINA_RUN_PER_SEC: -1.0
  },

  // Interaction
  INTERACTION: {
    NPC_DISTANCE: 50,           // Distance for NPC interaction
    MERCHANT_SELL_DISTANCE: 50  // Distance to sell items
  },

  // Update intervals (milliseconds)
  UPDATE_INTERVALS: {
    PLAYER_MOVEMENT: 20,       // Player update loop (50 FPS)
    NPC_MOVEMENT: 1000,        // NPC update loop (1 FPS)
    REDIS_DB_SYNC: 10000,      // Redis to DB sync (every 10 seconds)
    STAT_UPDATE: 1000          // Stat update broadcasts (every second)
  }
};

module.exports = GAME_CONFIG;
