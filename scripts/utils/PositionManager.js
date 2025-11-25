/**
 * Position Manager
 * Centralized management of entity position updates and marker animations
 */

class PositionManager {
  constructor(map, toLatLng) {
    this.map = map;
    this.toLatLng = toLatLng;
  }

  /**
   * Update entity position (player or NPC)
   * @param {object} entity - Entity object with marker, healthBarMarker, and position
   * @param {object} newPosition - New position {x, y}
   * @param {boolean} isCurrentPlayer - Whether this is the current player
   * @param {function} socketId - Socket ID (for current player check)
   */
  updateEntityPosition(entity, newPosition, isCurrentPlayer = false) {
    if (!entity) return;

    const latLng = this.toLatLng([newPosition.x, newPosition.y]);
    entity.position = newPosition;

    if (isCurrentPlayer) {
      // Current player: instant update and pan map
      this.map.panTo(latLng);
      entity.marker.setLatLng(latLng);
      if (entity.healthBarMarker) {
        entity.healthBarMarker.setLatLng(latLng);
      }
    } else {
      // Other players/NPCs: animated movement
      this.animateMarker(entity.marker, entity.marker.getLatLng(), latLng, 200);
      if (entity.healthBarMarker) {
        this.animateMarker(entity.healthBarMarker, entity.healthBarMarker.getLatLng(), latLng, 200);
      }
    }
  }

  /**
   * Animate marker movement
   * @param {object} marker - Leaflet marker
   * @param {object} fromLatLng - Starting position
   * @param {object} toLatLng - Ending position
   * @param {number} duration - Animation duration in milliseconds
   */
  animateMarker(marker, fromLatLng, toLatLng, duration) {
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);

      const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * progress;
      const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * progress;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Update player position with automatic current player detection
   * @param {object} players - Players map
   * @param {string} playerId - Player ID to update
   * @param {object} newPosition - New position {x, y}
   * @param {string} currentPlayerId - Current player's ID
   */
  updatePlayer(players, playerId, newPosition, currentPlayerId) {
    if (players[playerId]) {
      const isCurrentPlayer = playerId === currentPlayerId;
      this.updateEntityPosition(players[playerId], newPosition, isCurrentPlayer);
    }
  }

  /**
   * Update NPC position
   * @param {object} npcs - NPCs map
   * @param {string} npcId - NPC ID to update
   * @param {object} newPosition - New position {x, y}
   */
  updateNPC(npcs, npcId, newPosition) {
    if (npcs[npcId]) {
      this.updateEntityPosition(npcs[npcId], newPosition, false);
    }
  }

  /**
   * Batch update multiple entity positions
   * @param {Array} updates - Array of {entity, position, isCurrentPlayer}
   */
  batchUpdate(updates) {
    updates.forEach(update => {
      this.updateEntityPosition(update.entity, update.position, update.isCurrentPlayer);
    });
  }
}

// Export for use in app.js
window.PositionManager = PositionManager;
