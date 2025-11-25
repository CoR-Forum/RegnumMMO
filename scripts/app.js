"use strict";

/**
 * Regnum Online Bare Map
 * A simple Leaflet-based map for the Regnum Online MMORPG
 */
class RegnumMap {
  static MAP_SETTINGS = Object.freeze({
    gameDimensions: [6144, 6144],
    imageDimensions: [18432, 18432], // 3x resolution for better zoom detail
    initialZoom: 7,
    maxZoom: 9,
    minZoom: 1,
    // Settings for non-admin users (3 zoom levels)
    normalUserMaxZoom: 9,
    normalUserMinZoom: 7,
    normalUserInitialZoom: 9, // Most zoomed in as default
    tilePath: 'https://maps.cor-forum.de/gamemap-tiles/{z}/{x}/{y}.png?=v1',
    attribution: `
      Contribute to RegnumMMO on <a href="https://github.com/CoR-Forum/RegnumMMO" target="_blank">GitHub</a>
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
    this.regionLayers = null;
    this.regionData = null;
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
      this.setupRegionLayers();
      this.loadRegionData();
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

    // Scale factor: imageDimensions / gameDimensions = 18432 / 6144 = 3.0
    this.scaleX = imageDimensions[0] / gameDimensions[0];
    this.scaleY = imageDimensions[1] / gameDimensions[1];
    
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

  setupRegionLayers() {
    if (!this.map) return;
    this.regionLayers = {
      world: L.layerGroup().addTo(this.map),
      islands: L.layerGroup().addTo(this.map),
      areas: L.layerGroup().addTo(this.map)
    };
  }

  async loadRegionData() {
    try {
      const res = await fetch('/api/regions');
      if (!res.ok) throw new Error(`Failed to load regions: ${res.status}`);
      this.regionData = await res.json();
      this.renderRegionOverlays(this.regionData);
    } catch (error) {
      console.warn('Could not load region data:', error);
    }
  }

  renderRegionOverlays(data) {
    if (!data || !this.regionLayers) return;
    Object.values(this.regionLayers).forEach(layer => layer.clearLayers());

    if (data.worldBorder?.points?.length) {
      this.drawRegionPolygon(
        data.worldBorder.points,
        { color: '#f9b233', weight: 2, fill: false, ...data.worldBorder.style },
        this.regionLayers.world,
        data.worldBorder.name || 'World Border'
      );
    }

    (data.islandBorders || []).forEach(border => {
      this.drawRegionPolygon(
        border.points,
        { color: '#888', weight: 1, fillOpacity: 0.05, ...border.style },
        this.regionLayers.islands,
        border.name || border.type
      );
    });

    (data.areas || []).forEach(area => {
      this.drawRegionPolygon(
        area.points,
        { color: '#999', weight: 1, fillOpacity: 0.1, ...area.style },
        this.regionLayers.areas,
        area.name,
        true
      );
    });
  }

  drawRegionPolygon(points, style = {}, targetLayer, label, permanentLabel = false) {
    if (!targetLayer || !points || points.length === 0) return null;
    const latLngs = points.map(pt => this.toLatLng(pt));
    const polygon = L.polygon(latLngs, {
      interactive: false,
      smoothFactor: 1,
      ...style
    }).addTo(targetLayer);

    if (label) {
      polygon.bindTooltip(label, {
        permanent: permanentLabel,
        direction: 'center',
        className: 'region-label'
      });
    }

    return polygon;
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

    const marker6 = L.marker(this.toLatLng([6144, 6144])).addTo(this.map);
    marker6.bindPopup("6144, 6144");

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
    // Initialize ModalManager
    this.modalManager = new ModalManager();

    // Initialize StatManager
    this.statManager = new StatManager();

    // Initialize ItemRenderer
    this.itemRenderer = new ItemRenderer();

    // Login elements
    this.loginBtn = document.getElementById('login-btn');
    this.loginModal = document.getElementById('login-modal');
    this.submitLogin = document.getElementById('submit-login');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.loginMessage = document.getElementById('login-message');

    this.modalManager.register('login', {
      modalId: 'login-modal',
      closeButtonId: 'close-modal',
      useClass: true,
      playSound: false
    });

    this.checkLoginStatus();
    if (this.loginBtn) this.loginBtn.addEventListener('click', () => this.handleLoginBtnClick());
    if (this.submitLogin) this.submitLogin.addEventListener('click', () => this.handleLogin());

    // Character elements
    this.characterModal = document.getElementById('character-modal');
    this.characterList = document.getElementById('character-list');
    this.charName = document.getElementById('char-name-input');
    this.charRealm = document.getElementById('char-realm');
    this.charRealmText = document.getElementById('char-realm-text');
    this.charRace = document.getElementById('char-race');
    this.charClass = document.getElementById('char-class');
    this.createCharacterBtn = document.getElementById('create-character');
    this.characterMessage = document.getElementById('character-message');

    this.modalManager.register('character', {
      modalId: 'character-modal',
      closeButtonId: 'close-character-modal',
      useClass: true,
      playSound: false
    });

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
    this.regionDisplay = document.getElementById('region-display');
    this.zoomDisplay = document.getElementById('zoom-display');
    this.latencyDisplay = document.getElementById('latency-display');
    this.goldDisplay = document.getElementById('gold-display');
    this.switchCharacterBtn = document.getElementById('switch-character-btn');

    if (this.switchCharacterBtn) this.switchCharacterBtn.addEventListener('click', () => this.switchCharacter());

    // Realm Modal
    this.realmModal = document.getElementById('realm-modal');
    this.realmOptions = document.querySelectorAll('.realm-option');

    this.modalManager.register('realm', {
      modalId: 'realm-modal',
      closeButtonId: 'close-realm-modal',
      useClass: true,
      playSound: false
    });

    this.realmOptions.forEach(option => {
      if (option) option.addEventListener('click', () => this.selectRealm(option.dataset.realm));
    });

    // Shop and inventory elements
    this.shopModal = document.getElementById('shop-modal');
    this.shopTitle = document.getElementById('shop-title');
    this.shopItems = document.getElementById('shop-items');
    this.transactionTabs = document.getElementById('transaction-tabs');
    this.transactionItems = document.getElementById('transaction-items');
    this.confirmTransaction = document.getElementById('confirm-transaction');
    this.clearTransaction = document.getElementById('clear-transaction');
    this.currentTransactionTab = 'buy';
    this.transactionList = []; // Array to hold items for transaction

    this.modalManager.register('shop', {
      modalId: 'shop-modal',
      closeButtonId: 'close-shop-modal',
      playSound: false,
      onHide: () => {
        this.currentShopNpcId = null;
        this.clearTransactionList();
        this.socket.emit('getInventory');
      }
    });

    if (this.confirmTransaction) this.confirmTransaction.addEventListener('click', () => this.confirmTransactionAction());
    if (this.clearTransaction) this.clearTransaction.addEventListener('click', () => this.clearTransactionList());

    // Inventory elements
    this.inventoryModal = document.getElementById('inventory-modal');
    this.inventoryTabs = document.getElementById('inventory-tabs');
    this.inventoryItems = document.getElementById('inventory-items');
    this.inventoryBtn = document.getElementById('inventory-btn');
    this.currentInventoryTab = 1; // Default to tab 1

    this.modalManager.register('inventory', {
      modalId: 'inventory-modal',
      closeButtonId: 'close-inventory-modal',
      soundFile: 'open',
      onShow: () => this.socket.emit('getInventory')
    });

    if (this.inventoryBtn) this.inventoryBtn.addEventListener('click', () => this.showInventoryModal());

    // NPC Interaction Modal
    this.npcModal = document.getElementById('npc-modal');
    this.npcNameTitle = document.getElementById('npc-name-title');
    this.npcOptionsList = document.getElementById('npc-options-list');
    this.npcMessage = document.getElementById('npc-message');
    this.currentNpcId = null;
    this.currentNpcData = null;

    this.modalManager.register('npc', {
      modalId: 'npc-modal',
      closeButtonId: 'close-npc-modal',
      playSound: false
    });

    // Notification Modal
    this.notificationModal = document.getElementById('notification-modal');
    this.notificationMessage = document.getElementById('notification-message');
    this.notificationOkBtn = document.getElementById('notification-ok-btn');

    this.modalManager.register('notification', {
      modalId: 'notification-modal',
      closeButtonId: 'close-notification-modal',
      playSound: false
    });

    if (this.notificationOkBtn) this.notificationOkBtn.addEventListener('click', () => this.hideNotificationModal());

    // Window dragging functionality
    this.draggedWindow = null;
    this.dragOffset = { x: 0, y: 0 };
    
  // Window dragging event listeners
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

  showLoginModal() {
    this.modalManager.show('login');
  }

  hideLoginModal() {
    this.modalManager.hide('login');
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
    this.modalManager.show('character');
  }

  hideCharacterModal() {
    this.modalManager.hide('character');
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
    this.modalManager.show('realm');
  }

  hideRealmModal() {
    this.modalManager.hide('realm');
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

  isPointInPolygon(point, polygon = []) {
    if (!polygon.length) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > point[1]) !== (yj > point[1])) &&
        (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  getRegionContext(position) {
    if (!this.regionData) return {};
    const point = [position.x, position.y];
    const area = (this.regionData.areas || []).find(region => this.isPointInPolygon(point, region.points || []));
    const island = (this.regionData.islandBorders || []).find(region => this.isPointInPolygon(point, region.points || []));
    return {
      area: area ? area.name : null,
      island: island ? island.name : null
    };
  }

  updateLocationDisplay(position) {
    if (!this.locationDisplay) return;
    const coordsText = `Location: X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}`;
    const context = this.getRegionContext(position);
    this.locationDisplay.textContent = coordsText;
    this.updateRegionDisplay(context);
  }

  updateRegionDisplay(context = {}) {
    if (!this.regionDisplay) return;
    const labels = [];
    if (context.area) labels.push(context.area);
    if (context.island) labels.push(context.island);
    this.regionDisplay.textContent = labels.length ? `Region: ${labels.join(' — ')}` : 'Region: Unknown';
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
      this.statManager.updateStamina(data.current, data.max, data.regen);
    });

    this.socket.on('healthUpdate', (data) => {
      this.statManager.updateHealth(data.current, data.max, data.regen);

      // Update health bar on map for current player
      if (this.players[this.socket.id]) {
        this.players[this.socket.id].character.current_health = data.current;
        this.players[this.socket.id].character.max_health = data.max;
        this.updateHealthBar(this.players[this.socket.id].healthBarMarker, this.players[this.socket.id].character);
      }
    });

    this.socket.on('manaUpdate', (data) => {
      this.statManager.updateMana(data.current, data.max, data.regen);
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
    
    // Use realm-based colors for other players, grey for own player
    let playerIcon;
    let iconSize, iconAnchor;
    
    if (isCurrent) {
      // Current player: grey marker
      playerIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        shadowSize: [41, 41]
      });
      iconSize = [25, 41];
      iconAnchor = [12, 41];
    } else {
      // Other players: realm-based colors (Syrtis=green, Ignis=red, Alsius=blue)
      let colorUrl;
      const realm = character.realm ? character.realm.toLowerCase() : 'syrtis';
      
      if (realm === 'syrtis') {
        colorUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png';
      } else if (realm === 'ignis') {
        colorUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png';
      } else if (realm === 'alsius') {
        colorUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png';
      } else {
        colorUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png';
      }
      
      playerIcon = L.icon({
        iconUrl: colorUrl,
        iconSize: [20, 33],
        iconAnchor: [10, 33],
        popupAnchor: [0, -28]
      });
      iconSize = [20, 33];
      iconAnchor = [10, 33];
    }
    
    const marker = L.marker(latLng, { icon: playerIcon }).addTo(this.map);
    marker.bindPopup(`${character.name} (Lv.${character.level}) (${character.race} ${character.class})`);
    
    // Create and add health bar marker positioned above the marker icon
    const healthBarMarker = this.createHealthBarMarker(latLng, character, iconSize, iconAnchor);
    
    // Position name above health bar for MMO-like appearance
    // Offset accounts for marker height + health bar height + spacing
    const nameOffset = isCurrent ? [0, -53] : [0, -45];
    marker.bindTooltip(`${character.name} (${character.level})`, { 
      permanent: true, 
      direction: 'top', 
      offset: nameOffset,
      className: 'compact-tooltip'
    });
    
    this.players[id] = { marker, character, position, healthBarMarker };
  }

  createHealthBarMarker(latLng, entity, iconSize, iconAnchor) {
    const healthPercent = entity.current_health && entity.max_health ? 
      (entity.current_health / entity.max_health) * 100 : 100;
    
    // Create a custom div icon for the health bar
    // Position it just above the marker icon
    const healthBarHtml = `
      <div style="
        width: 40px;
        height: 4px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 2px;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.7);
      ">
        <div class="health-bar-fill" style="
          width: ${healthPercent}%;
          height: 100%;
          background: ${healthPercent > 50 ? '#4CAF50' : healthPercent > 25 ? '#FF9800' : '#F44336'};
          transition: width 0.3s ease;
        "></div>
      </div>
    `;
    
    // Position health bar above the marker
    // iconAnchor Y value should be iconSize[1] + offset to position it above the marker tip
    const healthBarIcon = L.divIcon({
      html: healthBarHtml,
      className: 'health-bar-marker',
      iconSize: [40, 4],
      iconAnchor: [20, iconSize[1] + 6]
    });
    
    const healthBarMarker = L.marker(latLng, { 
      icon: healthBarIcon,
      interactive: false,
      zIndexOffset: 1
    }).addTo(this.map);
    
    return healthBarMarker;
  }
  
  updateHealthBar(healthBarMarker, entity) {
    if (!healthBarMarker) return;
    
    const healthPercent = entity.current_health && entity.max_health ? 
      (entity.current_health / entity.max_health) * 100 : 100;
    
    const healthBarElement = healthBarMarker.getElement();
    if (healthBarElement) {
      const fillElement = healthBarElement.querySelector('.health-bar-fill');
      if (fillElement) {
        fillElement.style.width = `${healthPercent}%`;
        fillElement.style.background = healthPercent > 50 ? '#4CAF50' : healthPercent > 25 ? '#FF9800' : '#F44336';
      }
    }
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
    
    const iconSize = [20, 20];
    const iconAnchor = [10, 20];
    
    const npcIcon = L.icon({
      iconUrl: iconUrl,
      iconSize: iconSize,
      iconAnchor: iconAnchor
    });
    
    const marker = L.marker(latLng, { icon: npcIcon }).addTo(this.map);
    
    // Create and add health bar marker for NPC positioned above the marker icon
    const healthBarMarker = this.createHealthBarMarker(latLng, npc, iconSize, iconAnchor);
    
    // Display title or default to "NPC"
    const displayTitle = npc.title || 'NPC';
    marker.bindPopup(`${npc.name} (${displayTitle})<br>Level ${npc.level} - ${npc.realm}`);
    // Position name above health bar for MMO-like appearance
    marker.bindTooltip(`${npc.name} (${npc.level})`, { permanent: true, direction: 'top', offset: [0, -34], className: 'compact-tooltip' });
    
    marker.on('click', () => this.socket.emit('interactNPC', id));
    this.npcs[id] = { marker, npc, position: npc.position, healthBarMarker };
  }

  updatePlayerPosition(id, position) {
    if (this.players[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.players[id].position = position;
      if (id === this.socket.id) {
        // Location display is now updated by the 'moved' event handler
        this.map.panTo(latLng);
        this.players[id].marker.setLatLng(latLng); // Keep marker centered
        if (this.players[id].healthBarMarker) {
          this.players[id].healthBarMarker.setLatLng(latLng);
        }
      } else {
        this.animateMarker(this.players[id].marker, this.players[id].marker.getLatLng(), latLng, 200);
        if (this.players[id].healthBarMarker) {
          this.animateMarker(this.players[id].healthBarMarker, this.players[id].healthBarMarker.getLatLng(), latLng, 200);
        }
      }
    }
  }

  updateNPCPosition(id, position) {
    if (this.npcs[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.npcs[id].position = position;
      this.animateMarker(this.npcs[id].marker, this.npcs[id].marker.getLatLng(), latLng, 200);
      if (this.npcs[id].healthBarMarker) {
        this.animateMarker(this.npcs[id].healthBarMarker, this.npcs[id].healthBarMarker.getLatLng(), latLng, 200);
      }
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
      if (this.players[id].healthBarMarker) {
        this.map.removeLayer(this.players[id].healthBarMarker);
      }
      delete this.players[id];
    }
  }

  removeNPC(id) {
    if (this.npcs[id]) {
      this.map.removeLayer(this.npcs[id].marker);
      if (this.npcs[id].healthBarMarker) {
        this.map.removeLayer(this.npcs[id].healthBarMarker);
      }
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
    x = Math.max(0, Math.min(6144, x));
    y = Math.max(0, Math.min(6144, y));
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
    if (this.shopTitle) {
      this.shopTitle.textContent = `${npcName}'s Shop`;
    }
    this.currentShopNpcId = npcId;
    this.socket.emit('getShopItems', npcId);
    this.playSound('open');
    this.modalManager.show('shop');
  }

  hideShopModal() {
    this.playSound('close');
    this.modalManager.hide('shop');
  }

  displayShopItems(npcId, items) {
    if (!this.shopItems) return;
    this.itemRenderer.renderShopItems(this.shopItems, items);
  }

  showInventoryModal() {
    this.playSound('open');
    this.modalManager.show('inventory');
  }

  hideInventoryModal() {
    this.playSound('close');
    this.modalManager.hide('inventory');
  }

  // NPC Modal Methods
  showNpcModal(npcId, npcData) {
    if (!npcData) return;

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

    this.modalManager.show('npc');
  }

  hideNpcModal() {
    this.modalManager.hide('npc');
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
    this.modalManager.show('notification');
  }

  hideNotificationModal() {
    this.modalManager.hide('notification');
  }

  displayInventoryItems(inventory) {
    if (!this.inventoryItems) return;

    // Filter items for current tab
    let tabItems = inventory.filter(item => item.tab_id === this.currentInventoryTab);

    // Filter out items that are currently in the transaction list (sell tab)
    const transactionSellItems = this.transactionList.filter(item => item.transactionType === 'sell');
    const transactionItemIds = new Set(transactionSellItems.map(item => item.id));
    tabItems = tabItems.filter(item => !transactionItemIds.has(item.id));

    // Render items using ItemRenderer, but add context menu handlers
    this.inventoryItems.innerHTML = '';

    if (tabItems.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'inventory-item';
      emptyDiv.innerHTML = '<div class="item-info"><div class="item-name">No items in this tab</div></div>';
      this.inventoryItems.appendChild(emptyDiv);
      return;
    }

    tabItems.forEach(item => {
      const itemDiv = this.itemRenderer.renderInventoryItem(item);

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
    const windows = [this.shopModal, this.inventoryModal, this.npcModal, this.notificationModal];
    
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

  // Special admin functions for movement and zoom
  checkAdminStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    const { maxZoom, minZoom, normalUserMaxZoom, normalUserMinZoom } = RegnumMap.MAP_SETTINGS;
    
    if (user && user.isAdmin) {
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
}

// Initialize the map when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.regnumMap = new RegnumMap();
  } catch (error) {
    console.error('Failed to initialize Regnum Map:', error);
  }
});
