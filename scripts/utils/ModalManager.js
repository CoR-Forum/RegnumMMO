/**
 * Modal Manager
 * Centralized modal handling for all game modals
 */

class ModalManager {
  constructor() {
    this.modals = new Map();
    this.currentModal = null;
  }

  /**
   * Register a modal with configuration
   * @param {string} id - Modal ID
   * @param {object} config - Modal configuration
   * @param {string} config.modalId - DOM element ID for modal
   * @param {string} config.overlayId - DOM element ID for overlay (optional)
   * @param {string} config.closeButtonId - DOM element ID for close button (optional)
   * @param {boolean} config.playSound - Whether to play sound on show (default: true)
   * @param {string} config.soundFile - Sound file to play (default: 'click.mp3')
   * @param {function} config.onShow - Callback when modal is shown (optional)
   * @param {function} config.onHide - Callback when modal is hidden (optional)
   * @param {boolean} config.closeOnOverlay - Close modal when clicking overlay (default: true)
   * @param {boolean} config.useClass - Use CSS class 'show' instead of display style (default: false)
   */
  register(id, config) {
    const modalElement = document.getElementById(config.modalId);

    if (!modalElement) {
      console.error(`Modal registration failed: ${id} - missing modal element`);
      return;
    }

    const overlayElement = config.overlayId ? document.getElementById(config.overlayId) : null;

    const modalConfig = {
      id,
      modalElement,
      overlayElement,
      closeButtonElement: config.closeButtonId ? document.getElementById(config.closeButtonId) : null,
      playSound: config.playSound !== false,
      soundFile: config.soundFile || 'click.mp3',
      onShow: config.onShow || null,
      onHide: config.onHide || null,
      closeOnOverlay: config.closeOnOverlay !== false,
      useClass: config.useClass || false
    };

    // Setup close button listener
    if (modalConfig.closeButtonElement) {
      modalConfig.closeButtonElement.addEventListener('click', () => this.hide(id));
    }

    // Setup overlay listener (click on modal background)
    if (modalConfig.closeOnOverlay) {
      modalConfig.modalElement.addEventListener('click', (e) => {
        if (e.target === modalConfig.modalElement) {
          this.hide(id);
        }
      });
    }

    this.modals.set(id, modalConfig);
  }

  /**
   * Show a modal
   * @param {string} id - Modal ID
   */
  show(id) {
    const config = this.modals.get(id);
    if (!config) {
      console.error(`Modal not found: ${id}`);
      return;
    }

    // Hide current modal if exists
    if (this.currentModal && this.currentModal !== id) {
      this.hide(this.currentModal);
    }

    // Play sound
    if (config.playSound && window.playSound) {
      window.playSound(config.soundFile);
    }

    // Show modal (either via class or style)
    if (config.useClass) {
      config.modalElement.classList.add('show');
    } else {
      config.modalElement.style.display = 'block';
    }

    // Show overlay if exists
    if (config.overlayElement) {
      config.overlayElement.style.display = 'block';
    }

    // Call onShow callback
    if (config.onShow) {
      config.onShow();
    }

    this.currentModal = id;
  }

  /**
   * Hide a modal
   * @param {string} id - Modal ID
   */
  hide(id) {
    const config = this.modals.get(id);
    if (!config) {
      console.error(`Modal not found: ${id}`);
      return;
    }

    // Hide modal (either via class or style)
    if (config.useClass) {
      config.modalElement.classList.remove('show');
    } else {
      config.modalElement.style.display = 'none';
    }

    // Hide overlay if exists
    if (config.overlayElement) {
      config.overlayElement.style.display = 'none';
    }

    // Call onHide callback
    if (config.onHide) {
      config.onHide();
    }

    if (this.currentModal === id) {
      this.currentModal = null;
    }
  }

  /**
   * Toggle a modal
   * @param {string} id - Modal ID
   */
  toggle(id) {
    const config = this.modals.get(id);
    if (!config) {
      console.error(`Modal not found: ${id}`);
      return;
    }

    if (config.modalElement.style.display === 'block') {
      this.hide(id);
    } else {
      this.show(id);
    }
  }

  /**
   * Check if a modal is currently shown
   * @param {string} id - Modal ID
   * @returns {boolean}
   */
  isShown(id) {
    const config = this.modals.get(id);
    if (!config) return false;
    if (config.useClass) {
      return config.modalElement.classList.contains('show');
    }
    return config.modalElement.style.display === 'block';
  }

  /**
   * Hide all modals
   */
  hideAll() {
    this.modals.forEach((config, id) => {
      this.hide(id);
    });
  }

  /**
   * Get current modal ID
   * @returns {string|null}
   */
  getCurrentModal() {
    return this.currentModal;
  }
}

// Export for use in app.js
window.ModalManager = ModalManager;
