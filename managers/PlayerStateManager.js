/**
 * Player State Manager
 * Handles player state updates including regeneration, movement, and visibility
 */

const GAME_CONFIG = require('../constants');
const { getVisibleNPCs } = require('../utils/npc');

class PlayerStateManager {
  constructor(io, npcs, redisClient) {
    this.io = io;
    this.npcs = npcs;
    this.redisClient = redisClient;
  }

  /**
   * Update player regeneration (health, mana, stamina)
   * @param {object} player - Player object
   */
  updateRegeneration(player) {
    const { REGENERATION } = GAME_CONFIG;

    // Determine player state
    const isIdle = Object.keys(player.moving).length === 0;
    const isWalking = !isIdle && !player.moving['shift'];
    const isRunning = player.moving['shift'] && player.character.current_stamina > 0;

    // Regenerate health
    if (player.character.current_health < player.character.max_health) {
      player.character.current_health = Math.min(
        player.character.max_health,
        player.character.current_health + REGENERATION.HEALTH_TICK
      );
    }

    // Regenerate mana
    if (player.character.current_mana < player.character.max_mana) {
      player.character.current_mana = Math.min(
        player.character.max_mana,
        player.character.current_mana + REGENERATION.MANA_TICK
      );
    }

    // Regenerate or drain stamina based on state
    if (isIdle) {
      if (player.character.current_stamina < player.character.max_stamina) {
        player.character.current_stamina = Math.min(
          player.character.max_stamina,
          player.character.current_stamina + REGENERATION.STAMINA_IDLE
        );
      }
    } else if (isWalking) {
      if (player.character.current_stamina < player.character.max_stamina) {
        player.character.current_stamina = Math.min(
          player.character.max_stamina,
          player.character.current_stamina + REGENERATION.STAMINA_WALK
        );
      }
    }

    return { isIdle, isWalking, isRunning };
  }

  /**
   * Send stat updates to client
   * @param {string} socketId - Socket ID
   * @param {object} player - Player object
   * @param {object} playerState - Player state (isIdle, isWalking, isRunning)
   */
  sendStatUpdates(socketId, player, playerState) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const now = Date.now();
    const { STAT_UPDATE } = GAME_CONFIG.UPDATE_INTERVALS;
    const { REGENERATION_DISPLAY } = GAME_CONFIG;

    // Health update
    if (now - player.lastHealthDbUpdate > STAT_UPDATE) {
      player.lastHealthDbUpdate = now;
      socket.emit('healthUpdate', {
        current: player.character.current_health,
        max: player.character.max_health,
        regen: REGENERATION_DISPLAY.HEALTH_PER_SEC
      });
    }

    // Mana update
    if (now - player.lastManaDbUpdate > STAT_UPDATE) {
      player.lastManaDbUpdate = now;
      socket.emit('manaUpdate', {
        current: player.character.current_mana,
        max: player.character.max_mana,
        regen: REGENERATION_DISPLAY.MANA_PER_SEC
      });
    }

    // Stamina update
    if (now - player.lastStaminaDbUpdate > STAT_UPDATE) {
      player.lastStaminaDbUpdate = now;

      let regenRate;
      if (playerState.isIdle) {
        regenRate = REGENERATION_DISPLAY.STAMINA_IDLE_PER_SEC;
      } else if (playerState.isWalking) {
        regenRate = REGENERATION_DISPLAY.STAMINA_WALK_PER_SEC;
      } else {
        regenRate = REGENERATION_DISPLAY.STAMINA_RUN_PER_SEC;
      }

      socket.emit('staminaUpdate', {
        current: player.character.current_stamina,
        max: player.character.max_stamina,
        regen: regenRate
      });
    }
  }

  /**
   * Update player movement
   * @param {string} socketId - Socket ID
   * @param {object} player - Player object
   * @returns {object|null} New position if moved, null otherwise
   */
  updateMovement(socketId, player) {
    if (!player.moving || Object.keys(player.moving).length === 0) {
      return null;
    }

    const { MOVEMENT, MAP } = GAME_CONFIG;
    const isSprintingMoving = player.moving['shift'] && player.character.current_stamina > 0;
    let speed = MOVEMENT.BASE_SPEED;
    if (isSprintingMoving) {
      speed *= MOVEMENT.SPRINT_MULTIPLIER;
    }

    // Calculate movement delta
    let dx = 0, dy = 0;
    if (player.moving['w']) dy -= speed;
    if (player.moving['s']) dy += speed;
    if (player.moving['a']) dx -= speed;
    if (player.moving['d']) dx += speed;

    if (dx === 0 && dy === 0) return null;

    // Calculate new position
    const newPos = {
      x: player.position.x + dx,
      y: player.position.y + dy
    };

    // Clamp to map bounds
    newPos.x = Math.max(MAP.BOUNDS.minX, Math.min(MAP.BOUNDS.maxX, newPos.x));
    newPos.y = Math.max(MAP.BOUNDS.minY, Math.min(MAP.BOUNDS.maxY, newPos.y));

    // Update player position
    player.position = newPos;
    player.lastPos = { ...newPos };
    player.lastTime = Date.now();

    // Drain stamina if sprinting
    if (isSprintingMoving) {
      player.character.current_stamina = Math.max(
        0,
        player.character.current_stamina + GAME_CONFIG.REGENERATION.STAMINA_RUN
      );
    }

    // Broadcast movement
    this.io.emit('playerMoved', { id: socketId, position: newPos });

    // Send to player
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('moved', newPos);
    }

    return newPos;
  }

  /**
   * Update NPC visibility for a player
   * @param {string} socketId - Socket ID
   * @param {object} player - Player object
   * @param {object} newPos - New position (optional, uses player.position if not provided)
   */
  updateVisibility(socketId, player, newPos = null) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const position = newPos || player.position;
    const viewDistance = GAME_CONFIG.VISION.getViewDistance(player.zoom);

    const currentVisible = new Set(
      getVisibleNPCs(this.npcs, position, viewDistance).map(npc => npc.id)
    );

    const previouslyVisible = player.visibleNPCs;
    const newVisible = [...currentVisible].filter(id => !previouslyVisible.has(id));
    const noLongerVisible = [...previouslyVisible].filter(id => !currentVisible.has(id));

    if (newVisible.length > 0) {
      const newNPCs = newVisible.map(id => this.npcs[id]);
      socket.emit('npcs', newNPCs);
    }

    if (noLongerVisible.length > 0) {
      socket.emit('npcsLeft', noLongerVisible);
    }

    player.visibleNPCs = currentVisible;
  }

  /**
   * Sync player state to Redis
   * @param {object} player - Player object
   */
  async syncToRedis(player) {
    try {
      await this.redisClient.set(
        `player:${player.character.id}`,
        JSON.stringify(player)
      );
    } catch (error) {
      console.error('Error syncing to Redis:', error);
    }
  }

  /**
   * Process single player update (called from game loop)
   * @param {string} socketId - Socket ID
   * @param {object} player - Player object
   */
  async processPlayerUpdate(socketId, player) {
    // Update regeneration
    const playerState = this.updateRegeneration(player);

    // Send stat updates to client
    this.sendStatUpdates(socketId, player, playerState);

    // Update movement
    const newPos = this.updateMovement(socketId, player);

    // Update visibility (only if moved)
    if (newPos) {
      this.updateVisibility(socketId, player, newPos);
    }

    // Sync to Redis
    await this.syncToRedis(player);
  }
}

module.exports = PlayerStateManager;
