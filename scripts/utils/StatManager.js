/**
 * Stat Manager
 * Centralized management of player stats (health, mana, stamina) display
 */

class StatManager {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.healthRegen = document.getElementById('health-regen');
    this.manaFill = document.getElementById('mana-fill');
    this.manaText = document.getElementById('mana-text');
    this.manaRegen = document.getElementById('mana-regen');
    this.staminaFill = document.getElementById('stamina-fill');
    this.staminaText = document.getElementById('stamina-text');
    this.staminaRegen = document.getElementById('stamina-regen');
  }

  /**
   * Update health display
   * @param {number} current - Current health value
   * @param {number} max - Maximum health value
   * @param {number} regen - Regeneration rate per second (optional)
   */
  updateHealth(current, max, regen = null) {
    if (!this.healthFill || !this.healthText) return;

    const percent = (current / max) * 100;
    this.healthFill.style.width = `${percent}%`;
    this.healthText.textContent = `${Math.round(current)}/${Math.round(max)}`;

    if (regen !== null && this.healthRegen) {
      const sign = regen >= 0 ? '+' : '';
      this.healthRegen.textContent = `(${sign}${regen}/s)`;
    }
  }

  /**
   * Update mana display
   * @param {number} current - Current mana value
   * @param {number} max - Maximum mana value
   * @param {number} regen - Regeneration rate per second (optional)
   */
  updateMana(current, max, regen = null) {
    if (!this.manaFill || !this.manaText) return;

    const percent = (current / max) * 100;
    this.manaFill.style.width = `${percent}%`;
    this.manaText.textContent = `${Math.round(current)}/${Math.round(max)}`;

    if (regen !== null && this.manaRegen) {
      const sign = regen >= 0 ? '+' : '';
      this.manaRegen.textContent = `(${sign}${regen}/s)`;
    }
  }

  /**
   * Update stamina display
   * @param {number} current - Current stamina value
   * @param {number} max - Maximum stamina value
   * @param {number} regen - Regeneration rate per second (optional)
   */
  updateStamina(current, max, regen = null) {
    if (!this.staminaFill || !this.staminaText) return;

    const percent = (current / max) * 100;
    this.staminaFill.style.width = `${percent}%`;
    this.staminaText.textContent = `${Math.round(current)}/${Math.round(max)}`;

    if (regen !== null && this.staminaRegen) {
      const sign = regen >= 0 ? '+' : '';
      this.staminaRegen.textContent = `(${sign}${regen}/s)`;
    }
  }

  /**
   * Update all stats at once
   * @param {object} stats - Stats object
   * @param {object} stats.health - Health stats {current, max, regen}
   * @param {object} stats.mana - Mana stats {current, max, regen}
   * @param {object} stats.stamina - Stamina stats {current, max, regen}
   */
  updateAll(stats) {
    if (stats.health) {
      this.updateHealth(stats.health.current, stats.health.max, stats.health.regen);
    }
    if (stats.mana) {
      this.updateMana(stats.mana.current, stats.mana.max, stats.mana.regen);
    }
    if (stats.stamina) {
      this.updateStamina(stats.stamina.current, stats.stamina.max, stats.stamina.regen);
    }
  }
}

// Export for use in app.js
window.StatManager = StatManager;
