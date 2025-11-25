/**
 * Item Renderer
 * Centralized item rendering for shop and inventory with drag-drop support
 */

class ItemRenderer {
  constructor() {
    this.rarityColors = {
      'common': '#ffffff',
      'uncommon': '#1eff00',
      'rare': '#0070dd',
      'epic': '#a335ee',
      'legendary': '#ff8000'
    };
  }

  /**
   * Render a shop item
   * @param {object} item - Item data
   * @param {object} callbacks - Event callbacks {onDragStart, onDragEnd}
   * @returns {HTMLElement} Item div element
   */
  renderShopItem(item, callbacks = {}) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'shop-item';
    itemDiv.draggable = true;

    const rarityColor = this.rarityColors[item.rarity.toLowerCase()] || this.rarityColors.common;

    itemDiv.innerHTML = `
      <div class="item-info">
        <div class="item-name" style="color: ${rarityColor}">${item.name}</div>
        <div class="item-details">${item.type} - ${item.rarity}</div>
      </div>
      <div class="item-price">${item.price} gold</div>
    `;

    // Drag event handlers
    itemDiv.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        ...item,
        source: 'shop',
        item_id: item.item_id,
        price: item.price
      }));
      itemDiv.classList.add('dragging');
      if (callbacks.onDragStart) callbacks.onDragStart(item, e);
    });

    itemDiv.addEventListener('dragend', (e) => {
      itemDiv.classList.remove('dragging');
      if (callbacks.onDragEnd) callbacks.onDragEnd(item, e);
    });

    return itemDiv;
  }

  /**
   * Render an inventory item
   * @param {object} item - Item data
   * @param {object} callbacks - Event callbacks {onDragStart, onDragEnd, onDrop}
   * @returns {HTMLElement} Item div element
   */
  renderInventoryItem(item, callbacks = {}) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'inventory-item';
    itemDiv.draggable = true;

    const rarityColor = this.rarityColors[item.rarity.toLowerCase()] || this.rarityColors.common;
    const quantityDisplay = item.stackable && item.quantity > 1 ? ` (x${item.quantity})` : '';

    itemDiv.innerHTML = `
      <div class="item-info">
        <div class="item-name" style="color: ${rarityColor}">${item.name}${quantityDisplay}</div>
        <div class="item-details">${item.type} - ${item.rarity}</div>
        ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
      </div>
      <div class="item-value">${item.value} gold</div>
    `;

    // Add drop area for this item
    const dropArea = document.createElement('div');
    dropArea.className = 'item-drop-area';
    dropArea.textContent = 'Drop to discard';
    itemDiv.appendChild(dropArea);

    // Drag event handlers
    itemDiv.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        ...item,
        source: 'inventory'
      }));
      itemDiv.classList.add('dragging');
      if (callbacks.onDragStart) callbacks.onDragStart(item, e);
    });

    itemDiv.addEventListener('dragend', (e) => {
      itemDiv.classList.remove('dragging');
      if (callbacks.onDragEnd) callbacks.onDragEnd(item, e);
    });

    // Drop event for discarding
    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('drag-over');
      const draggedItem = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (callbacks.onDrop) callbacks.onDrop(draggedItem, item, e);
    });

    return itemDiv;
  }

  /**
   * Render a transaction item (buy/sell list)
   * @param {object} item - Item data
   * @param {string} transactionType - 'buy' or 'sell'
   * @param {function} onRemove - Callback when remove button clicked
   * @returns {HTMLElement} Item div element
   */
  renderTransactionItem(item, transactionType, onRemove) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'transaction-item';

    const rarityColor = this.rarityColors[item.rarity?.toLowerCase()] || this.rarityColors.common;
    const price = transactionType === 'buy' ? item.price : Math.floor(item.value * 0.5);
    const totalPrice = price * item.quantity;

    itemDiv.innerHTML = `
      <div class="item-info">
        <div class="item-name" style="color: ${rarityColor}">${item.name}</div>
        <div class="item-quantity">Quantity: ${item.quantity}</div>
      </div>
      <div class="item-total">
        ${totalPrice} gold
        <button class="remove-item-btn">×</button>
      </div>
    `;

    // Remove button handler
    const removeBtn = itemDiv.querySelector('.remove-item-btn');
    removeBtn.addEventListener('click', () => {
      if (onRemove) onRemove(item);
    });

    return itemDiv;
  }

  /**
   * Render a list of shop items
   * @param {HTMLElement} container - Container element
   * @param {Array} items - Array of item data
   * @param {object} callbacks - Event callbacks
   */
  renderShopItems(container, items, callbacks = {}) {
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p>No items available in this shop.</p>';
      return;
    }

    items.forEach(item => {
      const itemElement = this.renderShopItem(item, callbacks);
      container.appendChild(itemElement);
    });
  }

  /**
   * Render a list of inventory items
   * @param {HTMLElement} container - Container element
   * @param {Array} items - Array of item data
   * @param {object} callbacks - Event callbacks
   */
  renderInventoryItems(container, items, callbacks = {}) {
    container.innerHTML = '';

    if (items.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'inventory-item';
      emptyDiv.innerHTML = '<div class="item-info"><div class="item-name">No items in this tab</div></div>';
      container.appendChild(emptyDiv);
      return;
    }

    items.forEach(item => {
      const itemElement = this.renderInventoryItem(item, callbacks);
      container.appendChild(itemElement);
    });
  }

  /**
   * Render transaction list
   * @param {HTMLElement} container - Container element
   * @param {Array} items - Array of transaction items
   * @param {string} transactionType - 'buy' or 'sell'
   * @param {function} onRemove - Callback when item removed
   */
  renderTransactionList(container, items, transactionType, onRemove) {
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-transaction">No items in transaction</p>';
      return;
    }

    items.forEach(item => {
      const itemElement = this.renderTransactionItem(item, transactionType, onRemove);
      container.appendChild(itemElement);
    });

    // Add total at bottom
    const total = items.reduce((sum, item) => {
      const price = transactionType === 'buy' ? item.price : Math.floor(item.value * 0.5);
      return sum + (price * item.quantity);
    }, 0);

    const totalDiv = document.createElement('div');
    totalDiv.className = 'transaction-total';
    totalDiv.innerHTML = `<strong>Total: ${total} gold</strong>`;
    container.appendChild(totalDiv);
  }
}

// Export for use in app.js
window.ItemRenderer = ItemRenderer;
