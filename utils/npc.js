/**
 * NPC Utility Functions
 * Centralized NPC interaction and message handling
 */

const GAME_CONFIG = require('../constants');

/**
 * Build NPC greeting message
 * @param {object} npc - The NPC object
 * @param {string} greeting - The greeting text
 * @param {string} followUp - Optional follow-up text
 * @returns {string} Formatted NPC message
 */
function buildNPCMessage(npc, greeting, followUp = '') {
  let message = `${greeting} I am ${npc.name}`;
  if (npc.title) {
    message += `, ${npc.title}`;
  }
  message += ` ${npc.realm.startsWith('of') ? '' : 'of '}${npc.realm}.`;

  if (followUp) {
    message += ` ${followUp}`;
  }

  return message;
}

/**
 * Get NPC interaction type based on features
 * @param {object} npc - The NPC object
 * @returns {string} Interaction type
 */
function getNPCInteractionType(npc) {
  if (npc.has_shop) return 'shop';
  if (npc.has_guard_duties) return 'guard';
  if (npc.has_healing) return 'healer';
  if (npc.has_blacksmith) return 'blacksmith';
  if (npc.has_quests) return 'quests';
  return 'default';
}

/**
 * NPC interaction configuration
 */
const NPC_INTERACTIONS = {
  default: {
    greeting: 'Hello,',
    followUp: ''
  },
  shop: {
    greeting: 'Greetings traveler!',
    followUp: 'Would you like to see my wares?'
  },
  quests: {
    greeting: 'Ah, an adventurer!',
    followUp: 'I have quests that need doing. Are you interested?'
  },
  guard: {
    greeting: 'Halt!',
    followUp: 'State your business.'
  },
  healer: {
    greeting: 'Welcome, weary traveler.',
    followUp: 'I can mend your wounds for a small fee.'
  },
  blacksmith: {
    greeting: 'The forge calls!',
    followUp: 'Need your weapons repaired or upgraded?'
  }
};

/**
 * Handle NPC interaction
 * @param {object} npc - The NPC object
 * @param {object} socket - Socket.io socket object
 */
function handleNPCInteraction(npc, socket) {
  const interactionType = getNPCInteractionType(npc);
  const config = NPC_INTERACTIONS[interactionType] || NPC_INTERACTIONS.default;

  const message = buildNPCMessage(npc, config.greeting, config.followUp);

  socket.emit('npcMessage', {
    npcId: npc.id,
    message: message
  });
}

/**
 * Get visible NPCs from a position
 * @param {object} npcs - NPCs object (id -> npc)
 * @param {object} position - Position object {x, y}
 * @param {number} viewDistance - View distance
 * @returns {Array} Array of visible NPCs
 */
function getVisibleNPCs(npcs, position, viewDistance) {
  const visible = [];
  Object.values(npcs).forEach(npc => {
    const dist = Math.sqrt(
      (npc.position.x - position.x) ** 2 +
      (npc.position.y - position.y) ** 2
    );
    if (dist <= viewDistance) {
      visible.push(npc);
    }
  });
  return visible;
}

/**
 * Check if player is near any merchant NPC
 * @param {object} npcs - NPCs object (id -> npc)
 * @param {object} playerPosition - Player position {x, y}
 * @param {number} interactionDistance - Interaction distance (default from config)
 * @returns {boolean} True if near a merchant
 */
function isNearMerchant(npcs, playerPosition, interactionDistance = GAME_CONFIG.INTERACTION.NPC_DISTANCE) {
  for (const npc of Object.values(npcs)) {
    if (npc.has_shop) {
      const distance = Math.sqrt(
        Math.pow(npc.position.x - playerPosition.x, 2) +
        Math.pow(npc.position.y - playerPosition.y, 2)
      );
      if (distance <= interactionDistance) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  buildNPCMessage,
  getNPCInteractionType,
  handleNPCInteraction,
  getVisibleNPCs,
  isNearMerchant,
  NPC_INTERACTIONS
};
