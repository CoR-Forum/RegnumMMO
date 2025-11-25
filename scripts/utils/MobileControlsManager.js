/**
 * MobileControlsManager
 * Handles touch-based joystick controls and mobile interactions
 */
class MobileControlsManager {
  constructor(socket) {
    this.socket = socket;
    this.joystickActive = false;
    this.joystickBase = null;
    this.joystickStick = null;
    this.joystickMaxDistance = 50;
    this.currentKeys = { w: false, a: false, s: false, d: false };
    this.touchId = null;
    this.mobileControls = null;
    this.inventoryBtn = null;
    this.interactBtn = null;

    this.init();
  }

  init() {
    // Check if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);

    if (!isMobile && !(navigator.maxTouchPoints > 0)) {
      return; // Not a mobile device
    }

    this.mobileControls = document.getElementById('mobile-controls');
    this.joystickBase = document.querySelector('.joystick-base');
    this.joystickStick = document.querySelector('.joystick-stick');
    this.inventoryBtn = document.getElementById('mobile-inventory-btn');
    this.interactBtn = document.getElementById('mobile-interact-btn');

    if (!this.mobileControls || !this.joystickBase || !this.joystickStick) {
      console.warn('Mobile controls elements not found');
      return;
    }

    // Show mobile controls
    this.mobileControls.style.display = 'block';

    this.setupJoystick();
    this.setupActionButtons();
  }

  setupJoystick() {
    // Touch start
    this.joystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.touchId = touch.identifier;
      this.joystickActive = true;
      this.updateJoystick(touch);
    }, { passive: false });

    // Touch move
    this.joystickBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.joystickActive) return;

      const touch = Array.from(e.touches).find(t => t.identifier === this.touchId);
      if (touch) {
        this.updateJoystick(touch);
      }
    }, { passive: false });

    // Touch end
    const touchEnd = () => {
      if (!this.joystickActive) return;
      this.joystickActive = false;
      this.touchId = null;
      this.resetJoystick();
    };

    this.joystickBase.addEventListener('touchend', touchEnd);
    this.joystickBase.addEventListener('touchcancel', touchEnd);
  }

  updateJoystick(touch) {
    const rect = this.joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate offset from center
    let offsetX = touch.clientX - centerX;
    let offsetY = touch.clientY - centerY;

    // Calculate distance from center
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    // Clamp to max distance
    if (distance > this.joystickMaxDistance) {
      const angle = Math.atan2(offsetY, offsetX);
      offsetX = Math.cos(angle) * this.joystickMaxDistance;
      offsetY = Math.sin(angle) * this.joystickMaxDistance;
    }

    // Update stick position
    this.joystickStick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

    // Determine which keys should be pressed based on offset
    this.updateMovementKeys(offsetX, offsetY);
  }

  updateMovementKeys(offsetX, offsetY) {
    const threshold = 15; // Minimum offset to trigger movement
    const newKeys = {
      w: offsetY < -threshold,
      s: offsetY > threshold,
      a: offsetX < -threshold,
      d: offsetX > threshold
    };

    // Emit key changes to server
    Object.keys(newKeys).forEach(key => {
      if (newKeys[key] !== this.currentKeys[key]) {
        if (newKeys[key]) {
          this.socket.emit('keyDown', { key });
        } else {
          this.socket.emit('keyUp', { key });
        }
      }
    });

    this.currentKeys = newKeys;
  }

  resetJoystick() {
    // Reset stick position
    this.joystickStick.style.transform = 'translate(-50%, -50%)';

    // Release all keys
    Object.keys(this.currentKeys).forEach(key => {
      if (this.currentKeys[key]) {
        this.socket.emit('keyUp', { key });
      }
    });

    this.currentKeys = { w: false, a: false, s: false, d: false };
  }

  setupActionButtons() {
    if (this.inventoryBtn) {
      this.inventoryBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.openInventory();
      });

      this.inventoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openInventory();
      });
    }

    if (this.interactBtn) {
      this.interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        // Find nearby NPCs and interact with closest one
        this.interactWithNearestNPC();
      });

      this.interactBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.interactWithNearestNPC();
      });
    }
  }

  openInventory() {
    const inventoryModal = document.getElementById('inventory-modal');
    if (inventoryModal && window.regnumMap) {
      window.regnumMap.showInventoryModal();
    }
  }

  interactWithNearestNPC() {
    // This will be handled by the server - emit interact event
    if (this.socket) {
      this.socket.emit('interactNearest');
    }
  }

  destroy() {
    if (this.mobileControls) {
      this.mobileControls.style.display = 'none';
    }
    this.resetJoystick();
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileControlsManager;
}
