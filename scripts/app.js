"use strict";

/**
 * Regnum Online Bare Map
 * A simple Leaflet-based map for the Regnum Online MMORPG
 */
class RegnumMap {
  static MAP_SETTINGS = Object.freeze({
    gameDimensions: [6157, 6192],
    imageDimensions: [6157, 6192], // Match game dimensions for 1:1 mapping
    initialZoom: 7,
    maxZoom: 9,
    minZoom: 1,
    // Settings for non-admin users (3 zoom levels)
    normalUserMaxZoom: 9,
    normalUserMinZoom: 7,
    normalUserInitialZoom: 9, // Most zoomed in as default
    tilePath: 'https://maps.cor-forum.de/tiles/{z}/{x}/{y}.png',
    attribution: `
      Contribute on <a href="https://github.com/CoR-Forum/RegnumMMO" target="_blank">GitHub</a>
    `.trim()
  });

  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.rasterCoords = null;
    this.socket = null;
    this.players = {}; // { id: { marker, character } }
    this.npcs = {}; // { id: { marker, npc } }
    this.currentPlayer = null;
    this.playerSpeed = 0; // Will be set by server
    this.latency = 0;
    this.currentShopNpcId = null;
    this.isMoving = false;
    this.footstepInterval = null;
    this.nextStepSound = 'step1';
    this.init();
    this.initUI();
  }

  init() {
    try {
      this.createMap();
      this.setupTileLayer();
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }

  createMap() {
    const { gameDimensions, imageDimensions, initialZoom, maxZoom, minZoom, normalUserMaxZoom, normalUserMinZoom, normalUserInitialZoom } = RegnumMap.MAP_SETTINGS;
    
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.isAdmin;
    
    // Set zoom limits based on admin status
    const mapMinZoom = isAdmin ? minZoom : normalUserMinZoom;
    const mapMaxZoom = isAdmin ? maxZoom : normalUserMaxZoom;
    // Default to normalUserInitialZoom (9) for all users initially
    const mapInitialZoom = normalUserInitialZoom;
    
    this.map = L.map(this.containerId, {
      crs: L.CRS.Simple,
      minZoom: mapMinZoom,
      maxZoom: mapMaxZoom,
      dragging: isAdmin, // Only allow dragging for admin users
      scrollWheelZoom: true, // Allow scroll wheel zoom for all users
      doubleClickZoom: true, // Allow double-click zoom for all users
      boxZoom: isAdmin, // Only allow box zoom for admin users
      touchZoom: true // Allow touch zoom for all users
    });

    this.rasterCoords = new L.RasterCoords(this.map, imageDimensions);
    this.map.setMaxBounds(null); // Allow free panning beyond map bounds
    
    // 1:1 mapping - no scaling needed
    this.scaleX = 1;
    this.scaleY = 1;
    
    const centerCoords = this.toLatLng([gameDimensions[0] / 2, gameDimensions[1] / 2]);
    this.map.setView(centerCoords, mapInitialZoom);
  }

  setupTileLayer() {
    const { tilePath, attribution, maxZoom, minZoom } = RegnumMap.MAP_SETTINGS;
    
    L.tileLayer(tilePath, {
      attribution,
      noWrap: true,
      minZoom,
      maxZoom,
      keepBuffer: 8,
      updateWhenIdle: false,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII='
    }).addTo(this.map);

    // Add static map markers
    this.addStaticMarkers();
  }

  addStaticMarkers() {
    // Marker 1: Example location
    const marker1 = L.marker(this.toLatLng([2998.2917480469, 2963.8518066406])).addTo(this.map);
    marker1.bindPopup("2998.2917480469, 2963.8518066406");

    // Marker 2: Another example location
    const marker2 = L.marker(this.toLatLng([3746.0209960938, 2191.4299316406])).addTo(this.map);
    marker2.bindPopup("3746.0209960938, 2191.4299316406");

    // Marker 3: Third example location
    const marker3 = L.marker(this.toLatLng([4908.4072265625, 1669.7856445313])).addTo(this.map);
    marker3.bindPopup("4908.4072265625, 1669.7856445313");

    // Marker 4: Fourth example location
    const marker4 = L.marker(this.toLatLng([2632.6618652344, 3177.3698730469])).addTo(this.map);
    marker4.bindPopup("2632.6618652344, 3177.3698730469");

    // Marker 5: Fifth example location
    const marker5 = L.marker(this.toLatLng([2451.1330566406, 3987.1953125])).addTo(this.map);
    marker5.bindPopup("2451.1330566406, 3987.1953125");

    const marker6 = L.marker(this.toLatLng([6126, 6190])).addTo(this.map);
    marker6.bindPopup("6157, 6192");

    const marker7 = L.marker(this.toLatLng([8862, 8879])).addTo(this.map);
    marker7.bindPopup("8862, 8879");
  }

  toLatLng = (coords) => {
    if (!this.rasterCoords) {
      throw new Error('RasterCoords not initialized');
    }
    
    // Scale game coordinates to tile map coordinates
    const imageX = coords[0] * this.scaleX;
    const imageY = coords[1] * this.scaleY;
    
    return this.rasterCoords.unproject([imageX, imageY]);
  };

  initUI() {
    // Login elements
    this.loginBtn = document.getElementById('login-btn');
    this.loginModal = document.getElementById('login-modal');
    this.closeModal = document.getElementById('close-modal');
    this.submitLogin = document.getElementById('submit-login');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.loginMessage = document.getElementById('login-message');

    this.checkLoginStatus();
    if (this.loginBtn) this.loginBtn.addEventListener('click', () => this.handleLoginBtnClick());
    this.setupModalCloseHandlers(this.loginModal, this.hideLoginModal, 'close-modal');
    if (this.submitLogin) this.submitLogin.addEventListener('click', () => this.handleLogin());

    // Character elements
    this.characterModal = document.getElementById('character-modal');
    this.closeCharacterModal = document.getElementById('close-character-modal');
    this.characterList = document.getElementById('character-list');
    this.charName = document.getElementById('char-name-input');
    this.charRealm = document.getElementById('char-realm');
    this.charRealmText = document.getElementById('char-realm-text');
    this.charRace = document.getElementById('char-race');
    this.charClass = document.getElementById('char-class');
    this.createCharacterBtn = document.getElementById('create-character');
    this.characterMessage = document.getElementById('character-message');

    this.setupModalCloseHandlers(this.characterModal, this.hideCharacterModal, 'close-character-modal');
    if (this.createCharacterBtn) this.createCharacterBtn.addEventListener('click', () => this.createCharacter());
    if (this.charRace) this.charRace.addEventListener('change', () => this.populateClasses());

    // Character info elements
    this.characterInfo = document.getElementById('character-info');
    this.charNameDisplay = document.getElementById('char-name');
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.healthRegen = document.getElementById('health-regen');
    this.manaFill = document.getElementById('mana-fill');
    this.manaText = document.getElementById('mana-text');
    this.manaRegen = document.getElementById('mana-regen');
    this.staminaFill = document.getElementById('stamina-fill');
    this.staminaText = document.getElementById('stamina-text');
    this.staminaRegen = document.getElementById('stamina-regen');
    this.locationDisplay = document.getElementById('location-display');
    this.zoomDisplay = document.getElementById('zoom-display');
    this.latencyDisplay = document.getElementById('latency-display');
    this.goldDisplay = document.getElementById('gold-display');
    this.switchCharacterBtn = document.getElementById('switch-character-btn');

    if (this.switchCharacterBtn) this.switchCharacterBtn.addEventListener('click', () => this.switchCharacter());

    // Shop and inventory elements
    this.shopModal = document.getElementById('shop-modal');
    this.closeShopModal = document.getElementById('close-shop-modal');
    this.shopTitle = document.getElementById('shop-title');
    this.shopItems = document.getElementById('shop-items');
    this.transactionTabs = document.getElementById('transaction-tabs');
    this.transactionItems = document.getElementById('transaction-items');
    this.confirmTransaction = document.getElementById('confirm-transaction');
    this.clearTransaction = document.getElementById('clear-transaction');
    this.currentTransactionTab = 'buy';
    this.transactionList = []; // Array to hold items for transaction

    // Inventory elements
    this.inventoryModal = document.getElementById('inventory-modal');
    this.closeInventoryModal = document.getElementById('close-inventory-modal');
    this.inventoryTabs = document.getElementById('inventory-tabs');
    this.inventoryItems = document.getElementById('inventory-items');
    this.inventoryBtn = document.getElementById('inventory-btn');
    this.currentInventoryTab = 1; // Default to tab 1
    
    // NPC Interaction Modal
    this.npcModal = document.getElementById('npc-modal');
    this.closeNpcModal = document.getElementById('close-npc-modal');
    this.npcNameTitle = document.getElementById('npc-name-title');
    this.npcOptionsList = document.getElementById('npc-options-list');
    this.npcMessage = document.getElementById('npc-message');
    this.currentNpcId = null;
    this.currentNpcData = null;

    // Notification Modal
    this.notificationModal = document.getElementById('notification-modal');
    this.closeNotificationModal = document.getElementById('close-notification-modal');
    this.notificationMessage = document.getElementById('notification-message');
    this.notificationOkBtn = document.getElementById('notification-ok-btn');

    // Window dragging functionality
    this.draggedWindow = null;
    this.dragOffset = { x: 0, y: 0 };

    this.setupModalCloseHandlers(this.shopModal, this.hideShopModal, 'close-shop-modal');
    if (this.confirmTransaction) this.confirmTransaction.addEventListener('click', () => this.confirmTransactionAction());
    if (this.clearTransaction) this.clearTransaction.addEventListener('click', () => this.clearTransactionList());
    
    // Inventory event listeners
    this.setupModalCloseHandlers(this.inventoryModal, this.hideInventoryModal, 'close-inventory-modal');
    if (this.inventoryBtn) this.inventoryBtn.addEventListener('click', () => this.showInventoryModal());
    
    // NPC modal event listeners
    this.setupModalCloseHandlers(this.npcModal, this.hideNpcModal, 'close-npc-modal');
    
    // Notification modal event listeners
    this.setupModalCloseHandlers(this.notificationModal, this.hideNotificationModal, 'close-notification-modal');
    if (this.notificationOkBtn) this.notificationOkBtn.addEventListener('click', () => this.hideNotificationModal());
    
  // Initialize admin panel
  this.initAdminPanel();

  // Window dragging event listeners (call after admin panel elements exist)
  this.setupWindowDragging();
    
    // Inventory tab switching
    if (this.inventoryTabs) {
      this.inventoryTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
          const tabId = parseInt(e.target.dataset.tab);
          this.switchInventoryTab(tabId);
        }
      });
      
      // Add drag and drop for tabs
      const tabButtons = this.inventoryTabs.querySelectorAll('.tab-button');
      tabButtons.forEach(button => {
        button.addEventListener('dragover', (e) => {
          e.preventDefault();
          button.classList.add('drag-over');
        });
        
        button.addEventListener('dragleave', (e) => {
          button.classList.remove('drag-over');
        });
        
        button.addEventListener('drop', (e) => {
          e.preventDefault();
          button.classList.remove('drag-over');
          const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
          const targetTab = parseInt(button.dataset.tab);
          if (targetTab !== itemData.tab_id) {
            this.moveItemToTab(itemData, targetTab);
          }
        });
      });
    }
    
    // Transaction tab switching
    if (this.transactionTabs) {
      this.transactionTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('transaction-tab-button')) {
          const tabType = e.target.dataset.tab;
          this.switchTransactionTab(tabType);
        }
      });
    }
    
    // Add drag and drop for transaction area
    if (this.transactionItems) {
      this.transactionItems.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.transactionItems.classList.add('drag-over');
      });
      
      this.transactionItems.addEventListener('dragleave', (e) => {
        this.transactionItems.classList.remove('drag-over');
      });
      
      this.transactionItems.addEventListener('drop', (e) => {
        e.preventDefault();
        this.transactionItems.classList.remove('drag-over');
        const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
        this.addItemToTransaction(itemData, e.target === this.transactionItems ? 'unknown' : 'shop');
      });
    }
    
    // Inventory tab switching and drag/drop
    if (this.inventoryTabs) {
      this.inventoryTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
          const tabId = parseInt(e.target.dataset.tab);
          this.switchInventoryTab(tabId);
        }
      });
      
      // Add drag and drop for tabs
      const tabButtons = this.inventoryTabs.querySelectorAll('.tab-button');
      tabButtons.forEach(button => {
        button.addEventListener('dragover', (e) => {
          e.preventDefault();
          button.classList.add('drag-over');
        });
        
        button.addEventListener('dragleave', (e) => {
          button.classList.remove('drag-over');
        });
        
        button.addEventListener('drop', (e) => {
          e.preventDefault();
          button.classList.remove('drag-over');
          const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
          const targetTab = parseInt(button.dataset.tab);
          if (targetTab !== itemData.tab_id) {
            this.moveItemToTab(itemData, targetTab);
          }
        });
      });
    }

    // Realm selection elements
    this.realmModal = document.getElementById('realm-modal');
    this.closeRealmModal = document.getElementById('close-realm-modal');
    this.realmOptions = document.querySelectorAll('.realm-option');

    this.setupModalCloseHandlers(this.realmModal, this.hideRealmModal, 'close-realm-modal');
    this.realmOptions.forEach(option => {
      if (option) option.addEventListener('click', () => this.selectRealm(option.dataset.realm));
    });
  }

  checkLoginStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.success && user.token) {
      // Validate session with server
      fetch('/api/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: user.token })
      })
        .then(r => r.json())
        .then(data => {
          if (data.valid) {
            this.updateLoginBtn(true, user.username);
            // Store admin status
            user.isAdmin = data.isAdmin;
            localStorage.setItem('user', JSON.stringify(user));
            // Update map dragging based on admin status
            this.checkAdminStatus();
            this.checkExistingCharacters();
          } else {
            // Session invalid, clear local storage
            localStorage.removeItem('user');
            localStorage.removeItem('character');
            this.updateLoginBtn(false);
            this.showLoginModal();
          }
        })
        .catch(err => {
          console.error('Session validation error:', err);
          // On error, assume invalid and clear
          localStorage.removeItem('user');
          localStorage.removeItem('character');
          this.updateLoginBtn(false);
          this.showLoginModal();
        });
    } else {
      this.updateLoginBtn(false);
      this.showLoginModal();
    }
  }

  updateLoginBtn(isLoggedIn, username = '') {
    if (!this.loginBtn) return;
    if (isLoggedIn) {
      this.loginBtn.textContent = `Logged in as ${username}`;
      this.loginBtn.style.background = '#4CAF50';
    } else {
      this.loginBtn.textContent = 'Login';
      this.loginBtn.style.background = '#333';
    }
  }

  handleLoginBtnClick() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.success) {
      this.checkExistingCharacters();
    } else {
      this.showLoginModal();
    }
  }

  logout() {
    const { normalUserMaxZoom, normalUserMinZoom } = RegnumMap.MAP_SETTINGS;
    
    localStorage.removeItem('user');
    localStorage.removeItem('character');
    this.hideCharacterInfo();
    this.hideCharacterModal();
    this.updateLoginBtn(false);
    // Set to normal user restrictions for logged out users
    if (this.map) {
      if (this.map.dragging) this.map.dragging.disable();
      if (this.map.scrollWheelZoom) this.map.scrollWheelZoom.enable();
      if (this.map.doubleClickZoom) this.map.doubleClickZoom.enable();
      if (this.map.boxZoom) this.map.boxZoom.disable();
      if (this.map.touchZoom) this.map.touchZoom.enable();
      // Set restricted zoom limits
      this.map.setMinZoom(normalUserMinZoom);
      this.map.setMaxZoom(normalUserMaxZoom);
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    // Stop footstep sounds
    this.stopFootstepSounds();
    // Clear players
    Object.keys(this.players).forEach(id => this.removePlayer(id));
    this.currentPlayer = null;
    // Clear NPCs
    Object.keys(this.npcs).forEach(id => this.removeNPC(id));
    alert('Logged out successfully.');
  }

  // Generic modal close handler setup
  setupModalCloseHandlers(modalElement, hideFunction, closeButtonId = null) {
    if (!modalElement) return;

    // Overlay click handler
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) hideFunction.call(this);
    });

    // Close button handler (if provided)
    if (closeButtonId) {
      const closeBtn = document.getElementById(closeButtonId);
      if (closeBtn) closeBtn.addEventListener('click', () => hideFunction.call(this));
    }
  }

  showLoginModal() {
    if (this.loginModal) {
      this.loginModal.classList.add('show');
    }
  }

  hideLoginModal() {
    if (this.loginModal) {
      this.loginModal.classList.remove('show');
    }
  }

  async handleLogin() {
    if (!this.usernameInput || !this.passwordInput || !this.loginMessage) return;
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    if (!username || !password) {
      this.loginMessage.textContent = 'Please enter username and password.';
      return;
    }

    this.loginMessage.textContent = 'Logging in...';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        this.loginMessage.textContent = 'Login successful!';
        // Store user data including admin status
        localStorage.setItem('user', JSON.stringify(data));
        this.updateLoginBtn(true, data.username);
        // Update map dragging based on admin status
        this.checkAdminStatus();
        setTimeout(async () => {
          this.hideLoginModal();
          await this.checkExistingCharacters();
        }, 1000);
      } else {
        this.loginMessage.textContent = data.error || 'Login failed.';
      }
    } catch (error) {
      console.error('Login error:', error);
      this.loginMessage.textContent = 'An error occurred. Please try again.';
    }
  }

  populateRaces(realm = null) {
    const selectedRealm = realm || this.charRealm.value;
    if (!this.gameData) {
      fetch('/api/game-data').then(r => r.json()).then(data => {
        this.gameData = data;
        this.populateRaces(realm);
      }).catch(error => console.error('Error loading game data:', error));
      return;
    }
    this.charRace.innerHTML = '<option value="">Select Race</option>';
    this.charClass.innerHTML = '<option value="">Select Class</option>';
    if (this.gameData && this.gameData.races[selectedRealm]) {
      this.gameData.races[selectedRealm].forEach(race => {
        const option = document.createElement('option');
        option.value = race;
        option.textContent = race;
        this.charRace.appendChild(option);
      });
    }
  }

  populateClasses() {
    const selectedRace = this.charRace.value;
    this.charClass.innerHTML = '<option value="">Select Class</option>';
    if (this.gameData && this.gameData.classes[selectedRace]) {
      this.gameData.classes[selectedRace].forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        this.charClass.appendChild(option);
      });
    }
  }

  showCharacterModal() {
    this.loadCharacters();
    // Sync hidden realm input and visible display
    const realmInput = this.charRealm;
    const realmText = this.charRealmText;
    if (this.selectedRealm) {
      if (realmInput) realmInput.value = this.selectedRealm;
      if (realmText) realmText.textContent = this.selectedRealm;
      this.populateRaces(this.selectedRealm);
    } else {
      if (realmInput) realmInput.value = '';
      if (realmText) realmText.textContent = 'Not selected';
    }
    if (this.characterModal) {
      this.characterModal.classList.add('show');
    }
  }

  hideCharacterModal() {
    if (this.characterModal) {
      this.characterModal.classList.remove('show');
    }
  }

  async loadCharacters() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !this.characterList) return;
    try {
      const response = await fetch(`/api/characters`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const characters = await response.json();
      this.characterList.innerHTML = '';
      // Add logout button
      const logoutDiv = document.createElement('div');
      logoutDiv.className = 'logout-button-container';
      const logoutBtn = document.createElement('button');
      logoutBtn.textContent = 'Logout';
      logoutBtn.addEventListener('click', () => this.logout());
      logoutDiv.appendChild(logoutBtn);
      this.characterList.appendChild(logoutDiv);
      if (characters.length > 0 && !this.selectedRealm) {
        characters.sort((a, b) => b.id - a.id); // Sort by id descending
        this.selectedRealm = characters[0].realm;
        const realmInput = this.charRealm;
        const realmText = this.charRealmText;
        if (realmInput) realmInput.value = this.selectedRealm;
        if (realmText) realmText.textContent = this.selectedRealm;
        this.populateRaces(this.selectedRealm);
      }
      characters.forEach(char => {
        const div = document.createElement('div');
        div.className = 'character-item';
        div.textContent = `${char.name} (Lv.${char.level}) - ${char.realm} ${char.race} ${char.class}`;
        div.addEventListener('click', () => this.selectCharacter(char));
        this.characterList.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  }



  showRealmModal() {
    if (this.realmModal) {
      this.realmModal.classList.add('show');
    }
  }

  hideRealmModal() {
    if (this.realmModal) {
      this.realmModal.classList.remove('show');
    }
  }

  selectRealm(realm) {
    this.selectedRealm = realm;
    this.hideRealmModal();
    this.showCharacterModal();
  }

  async checkExistingCharacters() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    try {
      const response = await fetch(`/api/characters`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const characters = await response.json();
      if (characters.length > 0) {
        // Set selected realm to the realm of the most recent character (highest id) and skip realm modal
        characters.sort((a, b) => b.id - a.id); // Sort by id descending
        this.selectedRealm = characters[0].realm;
        const realmInput = this.charRealm;
        const realmText = this.charRealmText;
        if (realmInput) realmInput.value = this.selectedRealm;
        if (realmText) realmText.textContent = this.selectedRealm;
        this.populateRaces(this.selectedRealm);
        this.showCharacterModal();
      } else {
        // No characters -> pick realm first
        this.showRealmModal();
      }
    } catch (error) {
      console.error('Error checking characters:', error);
      this.showRealmModal(); // Default to realm selection on error
    }
  }

  updateCharacterInfo(character) {
    if (!this.charNameDisplay || !this.healthFill || !this.healthText || !this.manaFill || !this.manaText || !this.staminaFill || !this.staminaText || !this.characterInfo) return;
    this.charNameDisplay.textContent = `${character.name} (Lv.${character.level})`;
    this.healthFill.style.width = `${(character.current_health / character.max_health) * 100}%`;
    this.healthText.textContent = `${character.current_health}/${character.max_health}`;
    this.manaFill.style.width = `${(character.current_mana / character.max_mana) * 100}%`;
    this.manaText.textContent = `${character.current_mana}/${character.max_mana}`;
    this.staminaFill.style.width = `${(character.current_stamina / character.max_stamina) * 100}%`;
    this.staminaText.textContent = `${character.current_stamina}/${character.max_stamina}`;
    if (this.goldDisplay) this.goldDisplay.textContent = `Gold: ${character.gold || 0}`;
    this.characterInfo.style.display = 'block';
    
    // Show inventory button when character is active
    if (this.inventoryBtn) this.inventoryBtn.style.display = 'block';
  }

  updateLocationDisplay(position) {
    if (this.locationDisplay) this.locationDisplay.textContent = `Location: X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}`;
  }

  updateZoomDisplay(zoom) {
    if (this.zoomDisplay) this.zoomDisplay.textContent = `Zoom: ${zoom}`;
  }

  updateLatencyDisplay(latency) {
    if (this.latencyDisplay) this.latencyDisplay.textContent = `Latency: ${latency} ms`;
  }

  startLatencyMeasurement() {
    setInterval(() => {
      const start = Date.now();
      this.socket.emit('ping', start);
    }, 1000);
  }

  hideCharacterInfo() {
    if (this.characterInfo) this.characterInfo.style.display = 'none';
    
    // Hide inventory button when character is not active
    if (this.inventoryBtn) this.inventoryBtn.style.display = 'none';
  }

  switchCharacter() {
    // Clear selected character
    localStorage.removeItem('character');
    this.hideCharacterInfo();
    // Disconnect socket if connected
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    // Stop footstep sounds
    this.stopFootstepSounds();
    // Clear players
    Object.keys(this.players).forEach(id => this.removePlayer(id));
    this.currentPlayer = null;
    // Clear NPCs
    Object.keys(this.npcs).forEach(id => this.removeNPC(id));
    // Show character modal
    this.showCharacterModal();
  }

  selectCharacter(char) {
    localStorage.setItem('character', JSON.stringify(char));
    this.updateCharacterInfo(char);
    this.hideCharacterModal();
    // Connect to game
    this.connectSocket(char.id);
  }

  connectSocket(characterId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) {
      alert('Not logged in');
      return;
    }
    this.socket = io({ auth: { token: user.token } });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket.emit('join', { characterId });
      this.startLatencyMeasurement();
    });

    this.socket.on('pong', (start) => {
      this.latency = Date.now() - start;
      this.updateLatencyDisplay(this.latency);
    });

    this.socket.on('joined', (data) => {
      console.log('Joined game', data);
      this.currentPlayer = data.character;
      this.playerSpeed = data.speed;
      if (this.healthRegen) this.healthRegen.textContent = `(+${data.healthRegen}/s)`;
      if (this.manaRegen) this.manaRegen.textContent = `(+${data.manaRegen}/s)`;
      if (this.staminaRegen) this.staminaRegen.textContent = `(+${data.staminaRegen}/s)`;
      this.addPlayer(this.socket.id, data.character, data.position, true);
      
      // Use server-provided zoom level or fallback to current map zoom
      const zoomLevel = data.zoom || this.map.getZoom();
      
      this.map.setView(this.toLatLng([data.position.x, data.position.y]), zoomLevel);
      // Update location display with server position
      this.updateLocationDisplay(data.position);
      this.updateZoomDisplay(this.map.getZoom());
      this.initMovement();
    });

    this.socket.on('existingPlayers', (players) => {
      players.forEach(p => this.addPlayer(p.id, p.character, p.position));
    });

    this.socket.on('npcs', (npcs) => {
      npcs.forEach(npc => this.addNPC(npc.id, npc));
    });

    this.socket.on('playerJoined', (data) => {
      this.addPlayer(data.id, data.character, data.position);
    });

    this.socket.on('playerMoved', (data) => {
      this.updatePlayerPosition(data.id, data.position);
    });

    this.socket.on('moved', (newPos) => {
      this.updatePlayerPosition(this.socket.id, newPos);
      // Update location display with server position
      this.updateLocationDisplay(newPos);
    });

    this.socket.on('playerLeft', (id) => {
      this.removePlayer(id);
    });

    this.socket.on('npcMoved', (data) => {
      console.log('NPC moved', data);
      this.updateNPCPosition(data.id, data.position);
    });

    this.socket.on('npcMessage', (data) => {
      const npc = this.npcs[data.npcId];
      if (npc) {
        this.showNpcModal(data.npcId, {
          ...npc.npc,
          message: data.message
        });
      }
    });

    this.socket.on('npcsLeft', (npcIds) => {
      npcIds.forEach(id => this.removeNPC(id));
    });

    this.socket.on('error', (msg) => {
      this.showNotification('Error: ' + msg);
    });

    this.socket.on('logout', () => {
      this.logout();
    });

    this.socket.on('teleport', (position) => {
      this.moveToPosition(position.x, position.y);
    });

    this.socket.on('staminaUpdate', (data) => {
      if (this.staminaFill) this.staminaFill.style.width = `${(data.current / data.max) * 100}%`;
      if (this.staminaText) this.staminaText.textContent = `${Math.round(data.current)}/${data.max}`;
      if (this.staminaRegen) this.staminaRegen.textContent = `(${data.regen >= 0 ? '+' : ''}${data.regen}/s)`;
    });

    this.socket.on('healthUpdate', (data) => {
      if (this.healthFill) this.healthFill.style.width = `${(data.current / data.max) * 100}%`;
      if (this.healthText) this.healthText.textContent = `${Math.round(data.current)}/${data.max}`;
      if (this.healthRegen) this.healthRegen.textContent = `(+${data.regen}/s)`;
    });

    this.socket.on('openShop', (data) => {
      this.showShopModal(data.npcId, data.npcName);
    });

    this.socket.on('shopItems', (data) => {
      this.displayShopItems(data.npcId, data.items);
    });

    this.socket.on('itemPurchased', (data) => {
      this.showNotification(`Purchased ${data.quantity}x ${data.itemName}!`);
      // Refresh inventory
      this.socket.emit('getInventory');
    });

    this.socket.on('inventoryUpdate', (inventory) => {
      this.displayInventoryItems(inventory);
    });

    this.socket.on('goldUpdate', (data) => {
      if (this.goldDisplay) this.goldDisplay.textContent = `Gold: ${data.gold}`;
    });

    this.socket.on('itemSold', (data) => {
      this.showNotification(`Sold ${data.quantity}x ${data.itemName} for ${data.goldEarned} gold!`);
    });

    this.socket.on('transactionComplete', (data) => {
      // Clear the transaction list after successful transaction
      this.clearTransactionList();
      
      // Play sound and show orange text
      this.playSound(data.type);
      this.showTransactionMessage(data);
    });
  }

  addPlayer(id, character, position, isCurrent = false) {
    const latLng = this.toLatLng([position.x, position.y]);
    const userIcon = L.icon({
      iconUrl: 'https://img.icons8.com/material-outlined/24/user.png',
      iconSize: [16, 16],
      iconAnchor: [8, 16]
    });
    const marker = L.marker(latLng, { icon: userIcon }).addTo(this.map);
    marker.bindPopup(`${character.name} (Lv.${character.level}) (${character.race} ${character.class})`);
    marker.bindTooltip(`${character.name} (Lv.${character.level})`, { permanent: true, direction: 'top', offset: [0, -16] });
    if (isCurrent) {
      marker.setIcon(L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [20, 32], iconAnchor: [10, 32] }));
    }
    this.players[id] = { marker, character, position };
  }

  addNPC(id, npc) {
    const latLng = this.toLatLng([npc.position.x, npc.position.y]);
    
    // Different icons based on NPC features
    let iconUrl = 'https://img.icons8.com/material-outlined/24/person-male.png'; // default
    
    if (npc.has_shop) iconUrl = 'https://img.icons8.com/material-outlined/24/shop.png';
    else if (npc.has_guard_duties) iconUrl = 'https://img.icons8.com/material-outlined/24/shield.png';
    else if (npc.has_healing) iconUrl = 'https://img.icons8.com/material-outlined/24/medical-heart.png';
    else if (npc.has_blacksmith) iconUrl = 'https://img.icons8.com/material-outlined/24/anvil.png';
    else if (npc.has_quests) iconUrl = 'https://img.icons8.com/material-outlined/24/quest.png';
    
    const npcIcon = L.icon({
      iconUrl: iconUrl,
      iconSize: [20, 20],
      iconAnchor: [10, 20]
    });
    
    const marker = L.marker(latLng, { icon: npcIcon }).addTo(this.map);
    
    // Display title or default to "NPC"
    const displayTitle = npc.title || 'NPC';
    marker.bindPopup(`${npc.name} (${displayTitle})<br>Level ${npc.level} - ${npc.realm}`);
    marker.bindTooltip(`${npc.name} (Lv.${npc.level})`, { permanent: true, direction: 'top', offset: [0, -20] });
    
    marker.on('click', () => this.socket.emit('interactNPC', id));
    this.npcs[id] = { marker, npc, position: npc.position };
  }

  updatePlayerPosition(id, position) {
    if (this.players[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.players[id].position = position;
      if (id === this.socket.id) {
        // Location display is now updated by the 'moved' event handler
        this.map.panTo(latLng);
        this.players[id].marker.setLatLng(latLng); // Keep marker centered
      } else {
        this.animateMarker(this.players[id].marker, this.players[id].marker.getLatLng(), latLng, 200);
      }
    }
  }

  updateNPCPosition(id, position) {
    if (this.npcs[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.npcs[id].position = position;
      this.animateMarker(this.npcs[id].marker, this.npcs[id].marker.getLatLng(), latLng, 200);
    }
  }

  animateMarker(marker, fromLatLng, toLatLng, duration) {
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * progress;
      const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * progress;
      marker.setLatLng([lat, lng]);
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  removePlayer(id) {
    if (this.players[id]) {
      this.map.removeLayer(this.players[id].marker);
      delete this.players[id];
    }
  }

  removeNPC(id) {
    if (this.npcs[id]) {
      this.map.removeLayer(this.npcs[id].marker);
      delete this.npcs[id];
    }
  }

  initMovement() {
    this.keys = {};
    document.addEventListener('keydown', (e) => {
      if (!this.keys[e.key.toLowerCase()]) {
        this.keys[e.key.toLowerCase()] = true;
        this.socket.emit('keyDown', { key: e.key.toLowerCase() });
        
        // Start footstep sounds if movement key pressed and not already moving
        if (this.isMovementKey(e.key.toLowerCase()) && !this.isMoving) {
          this.startFootstepSounds();
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.socket.emit('keyUp', { key: e.key.toLowerCase() });
      
      // Stop footstep sounds if no movement keys are pressed
      if (!this.isAnyMovementKeyPressed()) {
        this.stopFootstepSounds();
      }
    });
    this.map.on('zoomend', () => {
      const zoom = this.map.getZoom();
      this.updateZoomDisplay(zoom);
      if (this.socket) this.socket.emit('zoomChanged', zoom);
    });
  }

  isMovementKey(key) {
    return ['w', 'a', 's', 'd'].includes(key.toLowerCase());
  }

  isAnyMovementKeyPressed() {
    return ['w', 'a', 's', 'd'].some(key => this.keys[key]);
  }

  startFootstepSounds() {
    this.isMoving = true;
    this.nextStepSound = 'step1';
    
    // Play first step immediately
    this.playSound(this.nextStepSound);
    this.nextStepSound = 'step2';
    
    // Set up interval for alternating steps (adjust timing based on walking speed)
    this.footstepInterval = setInterval(() => {
      this.playSound(this.nextStepSound);
      this.nextStepSound = this.nextStepSound === 'step1' ? 'step2' : 'step1';
    }, 400); // 400ms between steps - adjust for walking cadence
  }

  stopFootstepSounds() {
    this.isMoving = false;
    if (this.footstepInterval) {
      clearInterval(this.footstepInterval);
      this.footstepInterval = null;
    }
  }

  moveToPosition(x, y) {
    // Clamp to map bounds
    x = Math.max(0, Math.min(6157, x));
    y = Math.max(0, Math.min(6192, y));
    this.socket.emit('move', { x, y });
    // Don't update local position - wait for server confirmation
  }

  async createCharacter() {
    if (!this.charName || !this.charRealm || !this.charRace || !this.charClass || !this.characterMessage) return;
    const user = JSON.parse(localStorage.getItem('user'));
    const name = this.charName.value.trim();
    // Realm is enforced: prefer selectedRealm, fall back to hidden input
    const realm = this.selectedRealm || (this.charRealm && this.charRealm.value);
    const race = this.charRace.value;
    const cls = this.charClass.value;

    if (!name || !realm || !race || !cls) {
      this.characterMessage.textContent = 'All fields are required.';
      return;
    }

    this.characterMessage.textContent = 'Creating character...';

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        credentials: 'include',
        body: JSON.stringify({ name, realm, race, class: cls })
      });
      const data = await response.json();
      if (data.success) {
        this.characterMessage.textContent = 'Character created!';
        this.loadCharacters();
        this.charName.value = '';
        this.charRace.innerHTML = '<option value="">Select Race</option>';
        this.charClass.innerHTML = '<option value="">Select Class</option>';
      } else {
        this.characterMessage.textContent = data.error || 'Error creating character.';
      }
    } catch (error) {
      console.error('Error creating character:', error);
      this.characterMessage.textContent = 'An error occurred.';
    }
  }

  // Public API methods
  getMap() {
    return this.map;
  }

  showShopModal(npcId, npcName) {
    if (this.shopModal && this.shopTitle) {
      this.shopTitle.textContent = `${npcName}'s Shop`;
      this.shopModal.style.display = 'block';
      this.currentShopNpcId = npcId;
      // Request shop items
      this.socket.emit('getShopItems', npcId);
      // Play open sound
      this.playSound('open');
    }
  }

  hideShopModal() {
    if (this.shopModal) {
      this.shopModal.style.display = 'none';
      this.currentShopNpcId = null;
      this.clearTransactionList();
      
      // Refresh inventory to show items that were in transaction
      this.socket.emit('getInventory');
      
      // Play close sound
      this.playSound('close');
    }
  }

  displayShopItems(npcId, items) {
    if (!this.shopItems) return;
    this.shopItems.innerHTML = '';
    if (items.length === 0) {
      this.shopItems.innerHTML = '<p>No items available in this shop.</p>';
      return;
    }
    
    items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'shop-item';
      itemDiv.draggable = true;
      itemDiv.innerHTML = `
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">${item.type} - ${item.rarity}</div>
        </div>
        <div class="item-price">${item.price} gold</div>
      `;
      
      // Add drag start handler
      itemDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          ...item,
          source: 'shop',
          item_id: item.item_id,
          price: item.price
        }));
        itemDiv.classList.add('dragging');
      });
      
      itemDiv.addEventListener('dragend', (e) => {
        itemDiv.classList.remove('dragging');
      });
      
      this.shopItems.appendChild(itemDiv);
    });
  }

  showInventoryModal() {
    if (this.inventoryModal) {
      this.inventoryModal.style.display = 'block';
      // Request inventory
      this.socket.emit('getInventory');
      // Play open sound
      this.playSound('open');
    }
  }

  hideInventoryModal() {
    if (this.inventoryModal) {
      this.inventoryModal.style.display = 'none';
      // Play close sound
      this.playSound('close');
    }
  }

  // NPC Modal Methods
  showNpcModal(npcId, npcData) {
    if (!this.npcModal || !npcData) return;
    
    this.currentNpcId = npcId;
    this.currentNpcData = npcData;
    
    // Set NPC name/title
    if (this.npcNameTitle) {
      this.npcNameTitle.textContent = npcData.title || 'NPC';
    }
    
    // Clear previous options
    if (this.npcOptionsList) {
      this.npcOptionsList.innerHTML = '';
    }
    
    // Set default message
    if (this.npcMessage) {
      this.npcMessage.textContent = npcData.message || 'Hello there! How can I help you?';
    }
    
    // Add options based on NPC features
    this.addNpcOptions(npcData);
    
    // Show modal
    this.npcModal.style.display = 'block';
  }
  
  hideNpcModal() {
    if (this.npcModal) {
      this.npcModal.style.display = 'none';
    }
    this.currentNpcId = null;
    this.currentNpcData = null;
  }
  
  addNpcOptions(npcData) {
    if (!this.npcOptionsList || !npcData) return;
    
    const options = [];
    
    // Add options based on features
    if (npcData.has_shop) {
      options.push({ text: 'Shop', action: () => this.openNpcShop(npcData) });
    }
    
    if (npcData.has_quests) {
      options.push({ text: 'Quests', action: () => this.showNpcQuests(npcData) });
    }
    
    if (npcData.has_guard_duties) {
      options.push({ text: 'Guard Duty', action: () => this.showGuardInfo(npcData) });
    }
    
    if (npcData.has_training) {
      options.push({ text: 'Training', action: () => this.showTrainingOptions(npcData) });
    }
    
    // Add a "Talk" option if no specific features
    if (options.length === 0) {
      options.push({ text: 'Talk', action: () => this.showNpcDialogue(npcData) });
    }
    
    // Create option buttons
    options.forEach(option => {
      const button = document.createElement('button');
      button.className = 'npc-option-btn';
      button.textContent = option.text;
      button.addEventListener('click', option.action);
      this.npcOptionsList.appendChild(button);
    });
  }
  
  openNpcShop(npcData) {
    // Hide NPC modal and show shop modal
    const npcId = this.currentNpcId; // Store before hiding modal
    this.hideNpcModal();
    this.showShopModal(npcId, npcData.name);
  }
  
  showNpcQuests(npcData) {
    if (this.npcMessage) {
      this.npcMessage.textContent = 'I have some quests for you. Which one interests you?';
    }
    // TODO: Implement quest system
    this.showNotification('Quest system coming soon!');
  }
  
  showGuardInfo(npcData) {
    if (this.npcMessage) {
      this.npcMessage.textContent = 'I am here to protect this area. Everything is peaceful for now.';
    }
  }
  
  showTrainingOptions(npcData) {
    if (this.npcMessage) {
      this.npcMessage.textContent = 'I can help you improve your skills. What would you like to train?';
    }
    // TODO: Implement training system
    this.showNotification('Training system coming soon!');
  }
  
  showNpcDialogue(npcData) {
    if (this.npcMessage) {
      this.npcMessage.textContent = npcData.message || 'Hello! Nice to meet you.';
    }
  }

  // Notification Modal Methods
  showNotification(message) {
    if (!this.notificationModal || !this.notificationMessage) return;
    
    this.notificationMessage.textContent = message;
    this.notificationModal.style.display = 'block';
  }
  
  hideNotificationModal() {
    if (this.notificationModal) {
      this.notificationModal.style.display = 'none';
    }
  }

  displayInventoryItems(inventory) {
    if (!this.inventoryItems) return;
    
    // Clear existing items
    this.inventoryItems.innerHTML = '';
    
    // Filter items for current tab
    let tabItems = inventory.filter(item => item.tab_id === this.currentInventoryTab);
    
    // Filter out items that are currently in the transaction list (sell tab)
    const transactionSellItems = this.transactionList.filter(item => item.transactionType === 'sell');
    const transactionItemIds = new Set(transactionSellItems.map(item => item.id));
    tabItems = tabItems.filter(item => !transactionItemIds.has(item.id));
    
    if (tabItems.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'inventory-item';
      emptyDiv.innerHTML = '<div class="item-info"><div class="item-name">No items in this tab</div></div>';
      this.inventoryItems.appendChild(emptyDiv);
      return;
    }
    
    // Display items as list
    tabItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'inventory-item';
      itemDiv.draggable = true;
      itemDiv.innerHTML = `
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">${item.type} - ${item.rarity}</div>
        </div>
        <div class="item-quantity">${item.stackable ? 'x' + item.quantity : ''}</div>
      `;
      
      // Add drag start handler
      itemDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          ...item,
          source: 'inventory'
        }));
        itemDiv.classList.add('dragging');
      });
      
      itemDiv.addEventListener('dragend', (e) => {
        itemDiv.classList.remove('dragging');
      });
      
      // Add right-click handler for item actions
      itemDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showItemContextMenu(e, item);
      });
      
      this.inventoryItems.appendChild(itemDiv);
    });
  }

  switchInventoryTab(tabId) {
    this.currentInventoryTab = tabId;
    
    // Update tab button styles
    const tabButtons = this.inventoryTabs.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      if (parseInt(button.dataset.tab) === tabId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Refresh inventory display
    this.socket.emit('getInventory');
  }

  moveItemToTab(item, targetTab) {
    // Move item to new tab
    this.socket.emit('moveItemToTab', {
      inventoryId: item.id,
      toTab: targetTab
    });
  }

  showItemContextMenu(e, item) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.item-context-menu');
    if (existingMenu) existingMenu.remove();

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'item-context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    menu.style.background = '#333';
    menu.style.border = '1px solid #555';
    menu.style.borderRadius = '4px';
    menu.style.padding = '5px';
    menu.style.zIndex = '1002';

    // Drop option
    const dropOption = document.createElement('div');
    dropOption.textContent = 'Drop';
    dropOption.style.padding = '5px 10px';
    dropOption.style.cursor = 'pointer';
    dropOption.style.color = '#fff';
    dropOption.addEventListener('mouseenter', () => dropOption.style.background = '#555');
    dropOption.addEventListener('mouseleave', () => dropOption.style.background = 'transparent');
    dropOption.addEventListener('click', () => {
      this.dropItem(item.id, 1);
      menu.remove();
    });
    menu.appendChild(dropOption);

    // Add to document
    document.body.appendChild(menu);

    // Remove menu when clicking elsewhere
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 10);
  }

  switchTransactionTab(tabType) {
    this.currentTransactionTab = tabType;
    
    // Update tab button styles
    const tabButtons = this.transactionTabs.querySelectorAll('.transaction-tab-button');
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabType) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Filter and display transaction items for current tab
    this.displayTransactionItems();
  }

  addItemToTransaction(itemData, dragSource) {
    // Auto-switch tab based on item source
    if (itemData.source === 'shop') {
      this.switchTransactionTab('buy');
    } else if (itemData.source === 'inventory') {
      this.switchTransactionTab('sell');
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
    
    this.displayTransactionItems();
    
    // Refresh inventory display to hide items in transaction
    if (itemData.source === 'inventory') {
      this.socket.emit('getInventory');
    }
  }

  displayTransactionItems() {
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
        this.removeItemFromTransaction(index);
      });
      
      this.transactionItems.appendChild(itemDiv);
    });
  }

  removeItemFromTransaction(index) {
    this.transactionList.splice(index, 1);
    this.displayTransactionItems();
    
    // Refresh inventory display to show items removed from transaction
    this.socket.emit('getInventory');
  }

  confirmTransactionAction() {
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

  clearTransactionList() {
    this.transactionList = [];
    this.displayTransactionItems();
    
    // Refresh inventory to show items that were in transaction
    this.socket.emit('getInventory');
  }

  playSound(soundTypeOrUrl) {
    try {
      let soundUrl;
      
      // If it's a direct URL, use it
      if (soundTypeOrUrl.startsWith('http')) {
        soundUrl = soundTypeOrUrl;
      } else {
        // Otherwise treat it as a sound type
        const soundUrls = {
          'buy': 'https://cor-forum.de/regnum/datengrab/res/SOUND/50855-Ui%20item%20buy%201.ogg',
          'sell': 'https://cor-forum.de/regnum/datengrab/res/SOUND/50853-Ui%20item%20sell%201.ogg',
          'drop': 'https://cor-forum.de/regnum/datengrab/res/SOUND/50854-Ui%20item%20destroy%201.ogg',
          'open': 'https://cor-forum.de/regnum/datengrab/res/SOUND/50848-Ui%20widget%20click%205.ogg',
          'close': 'https://cor-forum.de/regnum/datengrab/res/SOUND/50847-Ui%20widget%20click%206.ogg',
          'step1': 'https://cor-forum.de/regnum/datengrab/res/SOUND/56098-Movement%20step%20generic%201.ogg',
          'step2': 'https://cor-forum.de/regnum/datengrab/res/SOUND/56099-Movement%20step%20generic%202.ogg'
        };
        soundUrl = soundUrls[soundTypeOrUrl] || soundUrls['sell'];
      }
      
      const audio = new Audio(soundUrl);
      audio.volume = 0.3; // Set volume to 30% to not be too loud
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.log('Audio playback error:', error);
    }
  }

  dropItem(inventoryId, quantity = 1) {
    this.socket.emit('dropItem', { inventoryId, quantity });
    
    // Play drop sound
    this.playSound('drop');
  }

  showTransactionMessage(data) {
    if (!this.transactionItems) return;
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'transaction-message';
    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '50%';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translate(-50%, -50%)';
    messageDiv.style.color = '#ff8c00'; // Orange color
    messageDiv.style.fontSize = '16px';
    messageDiv.style.fontWeight = 'bold';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.zIndex = '1005';
    messageDiv.style.pointerEvents = 'none';
    
    if (data.type === 'buy') {
      messageDiv.textContent = `Purchase completed! Total cost: ${data.totalCost} gold`;
    } else if (data.type === 'sell') {
      messageDiv.textContent = `Sale completed! Total earned: ${data.totalGoldEarned} gold`;
    }
    
    // Add to transaction items container
    this.transactionItems.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }
  

  setupWindowDragging() {
    const windows = [this.shopModal, this.inventoryModal, this.adminModal, this.npcModal, this.notificationModal];
    
    windows.forEach(window => {
      if (!window) return;
      
      const header = window.querySelector('.window-header');
      if (!header) return;
      
      header.addEventListener('mousedown', (e) => {
        this.draggedWindow = window;
        const rect = window.getBoundingClientRect();
        
        // Calculate drag offset BEFORE changing positioning
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        // Ensure the window has absolute positioning
        if (window.style.position !== 'absolute' && window.style.position !== 'fixed') {
          window.style.position = 'absolute';
          // Set the current visual position and remove any transforms
          window.style.left = rect.left + 'px';
          window.style.top = rect.top + 'px';
          window.style.transform = 'none';
        }
        
        // Bring window to front
        window.style.zIndex = '1004';
        
        document.addEventListener('mousemove', this.handleWindowDrag);
        document.addEventListener('mouseup', this.handleWindowDragEnd);
        
        e.preventDefault();
      });
    });
  }

  handleWindowDrag = (e) => {
    if (!this.draggedWindow) return;
    
    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;
    
    // Less aggressive clamping - allow some movement outside viewport but prevent complete disappearance
    const minX = -this.draggedWindow.offsetWidth + 50;
    const maxX = window.innerWidth - 50;
    const minY = -this.draggedWindow.offsetHeight + 50;
    const maxY = window.innerHeight - 50;
    
    const clampedX = Math.max(minX, Math.min(newX, maxX));
    const clampedY = Math.max(minY, Math.min(newY, maxY));
    
    this.draggedWindow.style.left = clampedX + 'px';
    this.draggedWindow.style.top = clampedY + 'px';
  };

  handleWindowDragEnd = () => {
    if (this.draggedWindow) {
      // Reset z-index to normal
      this.draggedWindow.style.zIndex = '1002';
      this.draggedWindow = null;
    }
    
    document.removeEventListener('mousemove', this.handleWindowDrag);
    document.removeEventListener('mouseup', this.handleWindowDragEnd);
  };

  // Admin Panel Methods
  initAdminPanel() {
    // Admin elements
    this.adminBtn = document.getElementById('admin-btn');
    this.adminModal = document.getElementById('admin-modal');
    this.adminTabs = document.getElementById('admin-tabs');
    this.adminPanelContent = document.getElementById('admin-panel-content');
    this.npcEditModal = document.getElementById('npc-edit-modal');
    this.itemEditModal = document.getElementById('item-edit-modal');
    this.shopItemEditModal = document.getElementById('shop-item-edit-modal');

    // Check if user is admin and show/hide admin button
    this.checkAdminStatus();

    if (this.adminBtn) this.adminBtn.addEventListener('click', () => this.showAdminModal());
    this.setupModalCloseHandlers(this.adminModal, this.hideAdminModal, 'close-admin-modal');

    // Tab switching
    if (this.adminTabs) {
      this.adminTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('admin-tab-button')) {
          const tabName = e.target.dataset.tab;
          this.switchAdminTab(tabName);
        }
      });
    }

    // Edit modal close handlers
    if (this.npcEditModal) this.npcEditModal.addEventListener('click', (e) => {
      if (e.target === this.npcEditModal) this.hideNpcEditModal();
    });
    const closeNpcEditModalBtn = document.getElementById('close-npc-edit-modal');
    if (closeNpcEditModalBtn) closeNpcEditModalBtn.addEventListener('click', () => this.hideNpcEditModal());

    if (this.itemEditModal) this.itemEditModal.addEventListener('click', (e) => {
      if (e.target === this.itemEditModal) this.hideItemEditModal();
    });
    const closeItemEditModalBtn = document.getElementById('close-item-edit-modal');
    if (closeItemEditModalBtn) closeItemEditModalBtn.addEventListener('click', () => this.hideItemEditModal());

    if (this.shopItemEditModal) this.shopItemEditModal.addEventListener('click', (e) => {
      if (e.target === this.shopItemEditModal) this.hideShopItemEditModal();
    });
    const closeShopItemEditModalBtn = document.getElementById('close-shop-item-edit-modal');
    if (closeShopItemEditModalBtn) closeShopItemEditModalBtn.addEventListener('click', () => this.hideShopItemEditModal());

    // Form submission handlers
    const npcForm = document.getElementById('npc-edit-form');
    if (npcForm) npcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveNpc();
    });

    const itemForm = document.getElementById('item-edit-form');
    if (itemForm) itemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveItem();
    });

    const shopItemForm = document.getElementById('shop-item-edit-form');
    if (shopItemForm) shopItemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveShopItem();
    });

    // Delete button handlers
    const deleteNpcBtn = document.getElementById('delete-npc-btn');
    if (deleteNpcBtn) deleteNpcBtn.addEventListener('click', () => {
      const npcId = document.getElementById('npc-edit-form')['npc-id'].value;
      if (npcId) this.deleteNpc(npcId);
    });

    const deleteItemBtn = document.getElementById('delete-item-btn');
    if (deleteItemBtn) deleteItemBtn.addEventListener('click', () => {
      const itemId = document.getElementById('item-edit-form')['item-id'].value;
      if (itemId) this.deleteItem(itemId);
    });

    const deleteShopItemBtn = document.getElementById('delete-shop-item-btn');
    if (deleteShopItemBtn) deleteShopItemBtn.addEventListener('click', () => {
      const shopItemId = document.getElementById('shop-item-edit-form')['shop-item-id'].value;
      if (shopItemId) this.deleteShopItem(shopItemId);
    });

    // Create button handlers
    const createNpcBtn = document.getElementById('create-npc-btn');
    if (createNpcBtn) createNpcBtn.addEventListener('click', () => this.showNpcEditModal());

    const createItemBtn = document.getElementById('create-item-btn');
    if (createItemBtn) createItemBtn.addEventListener('click', () => this.showItemEditModal());
  }

  checkAdminStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    const { maxZoom, minZoom, normalUserMaxZoom, normalUserMinZoom } = RegnumMap.MAP_SETTINGS;
    
    if (user && user.isAdmin) {
      if (this.adminBtn) this.adminBtn.style.display = 'block';
      // Enable map dragging and full zoom range for admins
      if (this.map) {
        if (this.map.dragging) this.map.dragging.enable();
        if (this.map.scrollWheelZoom) this.map.scrollWheelZoom.enable();
        if (this.map.doubleClickZoom) this.map.doubleClickZoom.enable();
        if (this.map.boxZoom) this.map.boxZoom.enable();
        if (this.map.touchZoom) this.map.touchZoom.enable();
        // Set admin zoom limits
        this.map.setMinZoom(minZoom);
        this.map.setMaxZoom(maxZoom);
      }
    } else {
      if (this.adminBtn) this.adminBtn.style.display = 'none';
      // Disable map dragging but allow limited zooming for non-admins
      if (this.map) {
        if (this.map.dragging) this.map.dragging.disable();
        if (this.map.scrollWheelZoom) this.map.scrollWheelZoom.enable();
        if (this.map.doubleClickZoom) this.map.doubleClickZoom.enable();
        if (this.map.boxZoom) this.map.boxZoom.disable();
        if (this.map.touchZoom) this.map.touchZoom.enable();
        // Set restricted zoom limits for normal users (3 levels: 7, 8, 9)
        this.map.setMinZoom(normalUserMinZoom);
        this.map.setMaxZoom(normalUserMaxZoom);
        // Zoom level will be controlled by server
      }
    }
  }

  showAdminModal() {
    if (this.adminModal) {
      this.adminModal.classList.add('show');
      this.switchAdminTab('npcs'); // Default to NPCs tab
    }
  }

  hideAdminModal() {
    if (this.adminModal) {
      this.adminModal.classList.remove('show');
    }
  }

  switchAdminTab(tabName) {
    // Update tab button styles
    const tabButtons = this.adminTabs.querySelectorAll('.admin-tab-button');
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Show/hide tab content
    const tabContents = this.adminPanelContent.querySelectorAll('.admin-tab-content');
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Load data for the selected tab
    this.loadAdminData(tabName);
  }

  async loadAdminData(tabName) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    try {
      let response;
      switch (tabName) {
        case 'npcs':
          response = await fetch('/api/admin/npcs', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          const npcs = await response.json();
          this.displayNpcs(npcs);
          break;
        case 'shops':
          response = await fetch('/api/admin/shops', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          const shops = await response.json();
          this.displayShops(shops);
          break;
        case 'players':
          response = await fetch('/api/admin/players', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          const players = await response.json();
          this.displayPlayers(players);
          break;
        case 'items':
          response = await fetch('/api/admin/items', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          const items = await response.json();
          this.displayItems(items);
          break;
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }

  displayNpcs(npcs) {
    const container = document.getElementById('npcs-list');
    if (!container) return;

    container.innerHTML = '';

    if (npcs.length === 0) {
      container.innerHTML = '<p>No NPCs found.</p>';
      return;
    }

    npcs.forEach(npc => {
      const npcDiv = document.createElement('div');
      npcDiv.className = 'npc-item';
      npcDiv.innerHTML = `
        <div class="npc-info">
          <div class="npc-name">${npc.name}</div>
          <div class="npc-details">Level ${npc.level} - ${npc.realm} - ${npc.title || 'Citizen'}</div>
        </div>
        <div class="npc-actions">
          <button class="edit-btn" data-id="${npc.id}">Edit</button>
          <button class="delete-btn" data-id="${npc.id}">Delete</button>
        </div>
      `;

      // Add event listeners
      const editBtn = npcDiv.querySelector('.edit-btn');
      const deleteBtn = npcDiv.querySelector('.delete-btn');

      editBtn.addEventListener('click', () => this.showNpcEditModal(npc));
      deleteBtn.addEventListener('click', () => this.deleteNpc(npc.id));

      container.appendChild(npcDiv);
    });
  }

  displayShops(shops) {
    const container = document.getElementById('shops-list');
    if (!container) return;

    container.innerHTML = '';

    if (shops.length === 0) {
      container.innerHTML = '<p>No shops found.</p>';
      return;
    }

    shops.forEach(shop => {
      const shopDiv = document.createElement('div');
      shopDiv.className = 'shop-item';
      shopDiv.innerHTML = `
        <div class="shop-info">
          <div class="shop-name">${shop.name}</div>
          <div class="shop-details">NPC ID: ${shop.npc_id} - ${shop.shop_type}</div>
        </div>
        <div class="shop-actions">
          <button class="edit-btn" data-id="${shop.id}">Edit Items</button>
        </div>
      `;

      // Add event listeners
      const editBtn = shopDiv.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => this.showShopEditModal(shop));

      container.appendChild(shopDiv);
    });
  }

  displayPlayers(players) {
    const container = document.getElementById('players-list');
    if (!container) return;

    container.innerHTML = '';

    if (players.length === 0) {
      container.innerHTML = '<p>No players found.</p>';
      return;
    }

    players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-item';
      playerDiv.innerHTML = `
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-details">Level ${player.level} - ${player.realm} ${player.race} ${player.class}</div>
        </div>
        <div class="player-actions">
          <button class="edit-btn" data-id="${player.id}">Edit</button>
          <button class="delete-btn" data-id="${player.id}">Delete</button>
        </div>
      `;

      // Add event listeners
      const editBtn = playerDiv.querySelector('.edit-btn');
      const deleteBtn = playerDiv.querySelector('.delete-btn');

      editBtn.addEventListener('click', () => this.showPlayerEditModal(player));
      deleteBtn.addEventListener('click', () => this.deletePlayer(player.id));

      container.appendChild(playerDiv);
    });
  }

  displayItems(items) {
    const container = document.getElementById('items-list');
    if (!container) return;

    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p>No items found.</p>';
      return;
    }

    items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'item-item';
      itemDiv.innerHTML = `
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">${item.type} - ${item.rarity}</div>
        </div>
        <div class="item-actions">
          <button class="edit-btn" data-id="${item.id}">Edit</button>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
        </div>
      `;

      // Add event listeners
      const editBtn = itemDiv.querySelector('.edit-btn');
      const deleteBtn = itemDiv.querySelector('.delete-btn');

      editBtn.addEventListener('click', () => this.showItemEditModal(item));
      deleteBtn.addEventListener('click', () => this.deleteItem(item.id));

      container.appendChild(itemDiv);
    });
  }

  showNpcEditModal(npc = null) {
    if (!this.npcEditModal) return;

    const form = document.getElementById('npc-edit-form');
    if (!form) return;

    // Populate form with NPC data or clear for new NPC
    if (npc && typeof npc === 'object') {
      // Support both DB rows (x,y) and objects with position { x, y }
      const posX = (npc.position && npc.position.x) ?? npc.x ?? '';
      const posY = (npc.position && npc.position.y) ?? npc.y ?? '';
      const npcTitle = npc.title ?? '';

      form['npc-id'].value = npc.id ?? '';
      form['npc-name'].value = npc.name ?? '';
      form['npc-level'].value = npc.level ?? '';
      form['npc-realm'].value = npc.realm ?? '';
      form['npc-title'].value = npcTitle;
      form['npc-x'].value = posX;
      form['npc-y'].value = posY;
      form['npc-roaming-type'].value = npc.roaming_type || 'static';
      form['npc-roaming-radius'].value = npc.roaming_radius || 0;
      form['npc-roaming-speed'].value = npc.roaming_speed || 0;
      document.getElementById('npc-has-shop').checked = !!(npc.has_shop);
      document.getElementById('npc-has-quests').checked = !!(npc.has_quests);
      document.getElementById('npc-has-guard-duties').checked = !!(npc.has_guard_duties);
      document.getElementById('npc-has-healing').checked = !!(npc.has_healing);
      document.getElementById('npc-has-blacksmith').checked = !!(npc.has_blacksmith);
      document.querySelector('#npc-edit-modal .window-title').textContent = 'Edit NPC';
      document.getElementById('delete-npc-btn').style.display = 'block';
    } else {
      form.reset();
      form['npc-id'].value = '';
      document.querySelector('#npc-edit-modal .window-title').textContent = 'Create NPC';
      document.getElementById('delete-npc-btn').style.display = 'none';
    }

    this.npcEditModal.classList.add('show');
  }

  hideNpcEditModal() {
    if (this.npcEditModal) {
      this.npcEditModal.classList.remove('show');
    }
  }

  showItemEditModal(item = null) {
    if (!this.itemEditModal) return;

    const form = document.getElementById('item-edit-form');
    if (!form) return;

    // Populate form with item data or clear for new item
    if (item) {
      form['item-id'].value = item.id;
      form['item-name'].value = item.name;
      form['item-type'].value = item.type;
      form['item-rarity'].value = item.rarity;
      form['item-value'].value = item.value;
      form['item-stackable'].checked = item.stackable;
      document.getElementById('item-edit-title').textContent = 'Edit Item';
      document.getElementById('delete-item-btn').style.display = 'block';
    } else {
      form.reset();
      form['item-id'].value = '';
      document.getElementById('item-edit-title').textContent = 'Create Item';
      document.getElementById('delete-item-btn').style.display = 'none';
    }

    this.itemEditModal.classList.add('show');
  }

  hideItemEditModal() {
    if (this.itemEditModal) {
      this.itemEditModal.classList.remove('show');
    }
  }

  showShopItemEditModal(shopItem = null, shopId = null) {
    if (!this.shopItemEditModal) return;

    const form = document.getElementById('shop-item-edit-form');
    if (!form) return;

    // Populate form with shop item data or clear for new shop item
    if (shopItem) {
      form['shop-item-id'].value = shopItem.id;
      form['shop-item-npc'].value = shopItem.npc_id || shopId;
      form['shop-item-item'].value = shopItem.item_id;
      form['shop-item-quantity'].value = shopItem.quantity || 1;
      form['shop-item-price'].value = shopItem.price;
      form['shop-id'].value = shopId;
      document.getElementById('shop-item-edit-title').textContent = 'Edit Shop Item';
      document.getElementById('delete-shop-item-btn').style.display = 'block';
    } else {
      form.reset();
      form['shop-item-id'].value = '';
      form['shop-id'].value = shopId;
      document.getElementById('shop-item-edit-title').textContent = 'Add Shop Item';
      document.getElementById('delete-shop-item-btn').style.display = 'none';
    }

    this.shopItemEditModal.classList.add('show');
  }

  hideShopItemEditModal() {
    if (this.shopItemEditModal) {
      this.shopItemEditModal.classList.remove('show');
    }
  }

  showShopEditModal(shop) {
    // For now, just show a simple alert. In a full implementation, this would show shop items
    alert(`Shop management for ${shop.name} - NPC ID: ${shop.npc_id}`);
    // TODO: Implement shop item management
  }

  showPlayerEditModal(player) {
    // For now, just show a simple alert. In a full implementation, this would allow editing player stats
    alert(`Player management for ${player.name} - Level ${player.level}`);
    // TODO: Implement player editing
  }

  async saveNpc() {
    const form = document.getElementById('npc-edit-form');
    if (!form) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    const npcData = {
      id: form['npc-id'].value || null,
      name: form['npc-name'].value,
      level: parseInt(form['npc-level'].value),
      realm: form['npc-realm'].value,
      title: form['npc-title'].value,
      position: {
        x: parseFloat(form['npc-x'].value),
        y: parseFloat(form['npc-y'].value)
      },
      roaming_type: form['npc-roaming-type'].value,
      roaming_radius: parseInt(form['npc-roaming-radius'].value) || 0,
      roaming_speed: parseFloat(form['npc-roaming-speed'].value) || 0,
      has_shop: document.getElementById('npc-has-shop').checked,
      has_quests: document.getElementById('npc-has-quests').checked,
      has_guard_duties: document.getElementById('npc-has-guard-duties').checked,
      has_healing: document.getElementById('npc-has-healing').checked,
      has_blacksmith: document.getElementById('npc-has-blacksmith').checked
    };

    try {
      const method = npcData.id ? 'PUT' : 'POST';
      const url = npcData.id ? `/api/admin/npcs/${npcData.id}` : '/api/admin/npcs';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(npcData)
      });

      if (response.ok) {
        this.hideNpcEditModal();
        this.loadAdminData('npcs');
        alert('NPC saved successfully!');
      } else {
        const error = await response.json();
        alert('Error saving NPC: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving NPC:', error);
      alert('Error saving NPC');
    }
  }

  async deleteNpc(npcId) {
    if (!confirm('Are you sure you want to delete this NPC?')) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    try {
      const response = await fetch(`/api/admin/npcs/${npcId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });

      if (response.ok) {
        this.loadAdminData('npcs');
        alert('NPC deleted successfully!');
      } else {
        const error = await response.json();
        alert('Error deleting NPC: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting NPC:', error);
      alert('Error deleting NPC');
    }
  }

  async saveItem() {
    const form = document.getElementById('item-edit-form');
    if (!form) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    const itemData = {
      id: form['item-id'].value || null,
      name: form['item-name'].value,
      type: form['item-type'].value,
      rarity: form['item-rarity'].value,
      value: parseInt(form['item-value'].value),
      stackable: form['item-stackable'].checked
    };

    try {
      const method = itemData.id ? 'PUT' : 'POST';
      const url = itemData.id ? `/api/admin/items/${itemData.id}` : '/api/admin/items';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        this.hideItemEditModal();
        this.loadAdminData('items');
        alert('Item saved successfully!');
      } else {
        const error = await response.json();
        alert('Error saving item: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Error saving item');
    }
  }

  async deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    try {
      const response = await fetch(`/api/admin/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });

      if (response.ok) {
        this.loadAdminData('items');
        alert('Item deleted successfully!');
      } else {
        const error = await response.json();
        alert('Error deleting item: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item');
    }
  }

  async saveShopItem() {
    const form = document.getElementById('shop-item-edit-form');
    if (!form) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    const shopItemData = {
      id: form['shop-item-id'].value || null,
      item_id: parseInt(form['shop-item-item'].value),
      price: parseInt(form['shop-item-price'].value),
      shop_id: parseInt(form['shop-id'].value)
    };

    try {
      const method = shopItemData.id ? 'PUT' : 'POST';
      const url = shopItemData.id ? `/api/admin/shop-items/${shopItemData.id}` : '/api/admin/shop-items';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(shopItemData)
      });

      if (response.ok) {
        this.hideShopItemEditModal();
        this.loadAdminData('shops');
        alert('Shop item saved successfully!');
      } else {
        const error = await response.json();
        alert('Error saving shop item: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving shop item:', error);
      alert('Error saving shop item');
    }
  }

  async deleteShopItem(shopItemId) {
    if (!confirm('Are you sure you want to delete this shop item?')) return;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.token) return;

    try {
      const response = await fetch(`/api/admin/shop-items/${shopItemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });

      if (response.ok) {
        this.hideShopItemEditModal();
        this.loadAdminData('shops');
        alert('Shop item deleted successfully!');
      } else {
        const error = await response.json();
        alert('Error deleting shop item: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting shop item:', error);
      alert('Error deleting shop item');
    }
  }
}

// Initialize the map when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.regnumMap = new RegnumMap();
  } catch (error) {
    console.error('Failed to initialize Regnum Map:', error);
  }
});
