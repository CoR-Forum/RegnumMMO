/**
 * Drag and Drop Manager
 * Centralized drag-drop functionality for windows, items, and tabs
 */

class DragDropManager {
  constructor() {
    this.draggedWindow = null;
    this.dragOffset = { x: 0, y: 0 };
    this.draggableWindows = new Map();
  }

  /**
   * Make a window draggable by its header
   * @param {HTMLElement} windowElement - The window element to make draggable
   * @param {HTMLElement} headerElement - The header element to drag by
   * @param {object} options - Optional configuration
   */
  makeWindowDraggable(windowElement, headerElement, options = {}) {
    if (!windowElement || !headerElement) return;

    const config = {
      containment: options.containment || null,
      onDragStart: options.onDragStart || null,
      onDrag: options.onDrag || null,
      onDragEnd: options.onDragEnd || null
    };

    const handleMouseDown = (e) => {
      if (e.target.classList.contains('window-close')) return;

      this.draggedWindow = windowElement;
      const rect = windowElement.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;

      windowElement.style.cursor = 'grabbing';
      if (config.onDragStart) config.onDragStart(e, windowElement);

      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!this.draggedWindow || this.draggedWindow !== windowElement) return;

      let newX = e.clientX - this.dragOffset.x;
      let newY = e.clientY - this.dragOffset.y;

      // Apply containment if specified
      if (config.containment) {
        const bounds = config.containment.getBoundingClientRect();
        const winRect = windowElement.getBoundingClientRect();

        newX = Math.max(bounds.left, Math.min(newX, bounds.right - winRect.width));
        newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - winRect.height));
      }

      windowElement.style.left = `${newX}px`;
      windowElement.style.top = `${newY}px`;

      if (config.onDrag) config.onDrag(e, windowElement, { x: newX, y: newY });
    };

    const handleMouseUp = (e) => {
      if (this.draggedWindow === windowElement) {
        windowElement.style.cursor = 'grab';
        if (config.onDragEnd) config.onDragEnd(e, windowElement);
        this.draggedWindow = null;
      }
    };

    headerElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    headerElement.style.cursor = 'grab';

    // Store for cleanup
    this.draggableWindows.set(windowElement, {
      header: headerElement,
      listeners: { handleMouseDown, handleMouseMove, handleMouseUp }
    });
  }

  /**
   * Make an element draggable
   * @param {HTMLElement} element - Element to make draggable
   * @param {object} data - Data to transfer on drag
   * @param {object} callbacks - Event callbacks
   */
  makeDraggable(element, data, callbacks = {}) {
    if (!element) return;

    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify(data));
      element.classList.add('dragging');
      if (callbacks.onDragStart) callbacks.onDragStart(data, e);
    });

    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      if (callbacks.onDragEnd) callbacks.onDragEnd(data, e);
    });
  }

  /**
   * Make an element a drop zone
   * @param {HTMLElement} element - Element to make a drop zone
   * @param {function} onDrop - Callback when item dropped
   * @param {object} options - Optional configuration
   */
  makeDropZone(element, onDrop, options = {}) {
    if (!element) return;

    const config = {
      dragOverClass: options.dragOverClass || 'drag-over',
      acceptFilter: options.acceptFilter || null, // Function to filter acceptable drops
      preventDefault: options.preventDefault !== false
    };

    element.addEventListener('dragover', (e) => {
      if (config.preventDefault) e.preventDefault();
      element.classList.add(config.dragOverClass);
    });

    element.addEventListener('dragleave', (e) => {
      element.classList.remove(config.dragOverClass);
    });

    element.addEventListener('drop', (e) => {
      if (config.preventDefault) e.preventDefault();
      element.classList.remove(config.dragOverClass);

      try {
        const draggedData = JSON.parse(e.dataTransfer.getData('text/plain'));

        // Check if drop is acceptable
        if (config.acceptFilter && !config.acceptFilter(draggedData)) {
          return;
        }

        if (onDrop) onDrop(draggedData, e);
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    });
  }

  /**
   * Make inventory tab dropable for items
   * @param {HTMLElement} tabElement - Tab button element
   * @param {function} onDrop - Callback when item dropped (receives itemData and targetTab)
   */
  makeTabDroppable(tabElement, onDrop) {
    if (!tabElement) return;

    this.makeDropZone(tabElement, (draggedData, e) => {
      const targetTab = parseInt(tabElement.dataset.tab);
      if (targetTab && draggedData.tab_id !== targetTab) {
        if (onDrop) onDrop(draggedData, targetTab);
      }
    }, {
      acceptFilter: (data) => data.source === 'inventory' && data.tab_id !== undefined
    });
  }

  /**
   * Setup drag-drop for multiple tabs
   * @param {NodeList|Array} tabButtons - Array or NodeList of tab button elements
   * @param {function} onDrop - Callback when item dropped on tab
   */
  setupTabDropZones(tabButtons, onDrop) {
    tabButtons.forEach(button => {
      this.makeTabDroppable(button, onDrop);
    });
  }

  /**
   * Cleanup window draggable listeners
   * @param {HTMLElement} windowElement - Window element to cleanup
   */
  cleanup(windowElement) {
    const data = this.draggableWindows.get(windowElement);
    if (data) {
      const { header, listeners } = data;
      header.removeEventListener('mousedown', listeners.handleMouseDown);
      document.removeEventListener('mousemove', listeners.handleMouseMove);
      document.removeEventListener('mouseup', listeners.handleMouseUp);
      this.draggableWindows.delete(windowElement);
    }
  }
}

// Export for use in app.js
window.DragDropManager = DragDropManager;
