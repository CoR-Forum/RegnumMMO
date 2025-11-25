/**
 * Transaction Manager
 * Centralized management of buy/sell transactions with shop NPCs
 */

class TransactionManager {
  constructor(socket, itemRenderer, showNotification) {
    this.socket = socket;
    this.itemRenderer = itemRenderer;
    this.showNotification = showNotification;
    this.transactionList = [];
    this.currentTransactionTab = 'buy';
    this.currentShopNpcId = null;

    // UI Elements
    this.transactionItems = null;
    this.transactionTabs = null;
  }

  /**
   * Initialize transaction manager with UI elements
   * @param {HTMLElement} transactionItems - Container for transaction items
   * @param {HTMLElement} transactionTabs - Container for transaction tabs
   */
  initialize(transactionItems, transactionTabs) {
    this.transactionItems = transactionItems;
    this.transactionTabs = transactionTabs;

    // Setup tab button listeners
    if (this.transactionTabs) {
      const tabButtons = this.transactionTabs.querySelectorAll('.transaction-tab-button');
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          this.switchTab(button.dataset.tab);
        });
      });
    }
  }

  /**
   * Set current shop NPC ID for transactions
   * @param {number} npcId - NPC ID
   */
  setShopNpcId(npcId) {
    this.currentShopNpcId = npcId;
  }

  /**
   * Switch transaction tab
   * @param {string} tabType - 'buy' or 'sell'
   */
  switchTab(tabType) {
    this.currentTransactionTab = tabType;

    // Update tab button styles
    if (this.transactionTabs) {
      const tabButtons = this.transactionTabs.querySelectorAll('.transaction-tab-button');
      tabButtons.forEach(button => {
        if (button.dataset.tab === tabType) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
    }

    // Refresh display
    this.displayItems();
  }

  /**
   * Add item to transaction list
   * @param {object} itemData - Item data
   * @param {string} dragSource - Source of drag ('shop' or 'inventory')
   */
  addItem(itemData, dragSource) {
    // Auto-switch tab based on item source
    if (itemData.source === 'shop') {
      this.switchTab('buy');
    } else if (itemData.source === 'inventory') {
      this.switchTab('sell');
    }

    // Check if item already exists in transaction list
    const existingIndex = this.transactionList.findIndex(item =>
      item.id === itemData.id && item.source === itemData.source
    );

    if (existingIndex >= 0) {
      // Increase quantity if stackable
      if (itemData.stackable) {
        this.transactionList[existingIndex].quantity =
          Math.min(this.transactionList[existingIndex].quantity + 1, itemData.quantity || 1);
      }
    } else {
      // Add new item
      this.transactionList.push({
        ...itemData,
        quantity: 1,
        transactionType: this.currentTransactionTab
      });
    }

    this.displayItems();

    // Refresh inventory display to hide items in transaction
    if (itemData.source === 'inventory') {
      this.socket.emit('getInventory');
    }
  }

  /**
   * Remove item from transaction list
   * @param {number} index - Index of item to remove
   */
  removeItem(index) {
    this.transactionList.splice(index, 1);
    this.displayItems();

    // Refresh inventory display to show items removed from transaction
    this.socket.emit('getInventory');
  }

  /**
   * Display transaction items in UI
   */
  displayItems() {
    if (!this.transactionItems) return;

    // Clear existing items
    this.transactionItems.innerHTML = '';

    // Filter items for current tab
    const tabItems = this.transactionList.filter(item =>
      item.transactionType === this.currentTransactionTab
    );

    if (tabItems.length === 0) {
      this.transactionItems.innerHTML = '<div style="text-align: center; color: #ccc; padding: 20px;">Drag items here to start a transaction</div>';
      return;
    }

    tabItems.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'transaction-item';

      const price = this.currentTransactionTab === 'buy' ?
        item.price : Math.floor(item.value * 0.5);

      itemDiv.innerHTML = `
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">${item.type} - ${item.rarity}</div>
        </div>
        <div class="item-price">${price}g x${item.quantity}</div>
        <button class="remove-item" data-index="${index}">×</button>
      `;

      // Add remove button handler
      const removeBtn = itemDiv.querySelector('.remove-item');
      removeBtn.addEventListener('click', () => {
        this.removeItem(index);
      });

      this.transactionItems.appendChild(itemDiv);
    });
  }

  /**
   * Get total price for current transaction tab
   * @returns {number} Total price
   */
  getTotal() {
    const tabItems = this.transactionList.filter(item =>
      item.transactionType === this.currentTransactionTab
    );

    return tabItems.reduce((sum, item) => {
      const price = this.currentTransactionTab === 'buy' ?
        item.price : Math.floor(item.value * 0.5);
      return sum + (price * item.quantity);
    }, 0);
  }

  /**
   * Confirm and process transaction
   */
  confirmTransaction() {
    if (this.transactionList.length === 0) {
      this.showNotification('No items in transaction');
      return;
    }

    const tabItems = this.transactionList.filter(item =>
      item.transactionType === this.currentTransactionTab
    );

    if (tabItems.length === 0) {
      this.showNotification('No items in current transaction tab');
      return;
    }

    if (this.currentTransactionTab === 'buy') {
      // Process buy transaction
      const buyData = tabItems.map(item => ({
        itemId: item.item_id,
        quantity: item.quantity
      }));

      this.socket.emit('buyItems', {
        npcId: this.currentShopNpcId,
        items: buyData
      });
    } else if (this.currentTransactionTab === 'sell') {
      // Process sell transaction
      const sellData = tabItems.map(item => ({
        inventoryId: item.id,
        quantity: item.quantity
      }));

      this.socket.emit('sellItems', { items: sellData });
    }
  }

  /**
   * Clear all items from transaction list
   */
  clearAll() {
    this.transactionList = [];
    this.displayItems();

    // Refresh inventory to show items that were in transaction
    this.socket.emit('getInventory');
  }

  /**
   * Get items for specific transaction type
   * @param {string} transactionType - 'buy' or 'sell'
   * @returns {Array} Filtered items
   */
  getItemsByType(transactionType) {
    return this.transactionList.filter(item =>
      item.transactionType === transactionType
    );
  }

  /**
   * Check if item is in transaction list
   * @param {number} itemId - Item ID
   * @param {string} source - Item source
   * @returns {boolean}
   */
  hasItem(itemId, source) {
    return this.transactionList.some(item =>
      item.id === itemId && item.source === source
    );
  }

  /**
   * Get current transaction tab
   * @returns {string} Current tab ('buy' or 'sell')
   */
  getCurrentTab() {
    return this.currentTransactionTab;
  }
}

// Export for use in app.js
window.TransactionManager = TransactionManager;
