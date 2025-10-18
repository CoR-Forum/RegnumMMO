"use strict";

/**
 * Regnum Online Bare Map
 * A simple Leaflet-based map for the Regnum Online MMORPG
 */
class RegnumMap {
  static MAP_SETTINGS = Object.freeze({
    gameDimensions: [6126, 6190],
    imageDimensions: [8862, 8879],
    initialZoom: 8,
    maxZoom: 9,
    minZoom: 6,
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
    this.currentPlayer = null;
    this.playerSpeed = 0; // Will be set by server
    this.latency = 0;
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
    const { gameDimensions, imageDimensions, initialZoom, maxZoom, minZoom } = RegnumMap.MAP_SETTINGS;
    
    this.map = L.map(this.containerId, {
      crs: L.CRS.Simple,
      minZoom,
      maxZoom
    });

    this.rasterCoords = new L.RasterCoords(this.map, imageDimensions);
    this.map.setMaxBounds(null); // Allow free panning beyond map bounds
    
    // Precompute scaling factors
    this.scaleX = imageDimensions[0] / gameDimensions[0];
    this.scaleY = imageDimensions[1] / gameDimensions[1];
    
    const centerCoords = this.toLatLng([gameDimensions[0] / 2, gameDimensions[1] / 2]);
    this.map.setView(centerCoords, initialZoom);
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
  }

  toLatLng = (coords) => {
    if (!this.rasterCoords) {
      throw new Error('RasterCoords not initialized');
    }
    
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
    this.loginBtn.addEventListener('click', () => this.handleLoginBtnClick());
    this.closeModal.addEventListener('click', () => this.hideLoginModal());
    this.submitLogin.addEventListener('click', () => this.handleLogin());

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

    this.closeCharacterModal.addEventListener('click', () => this.hideCharacterModal());
    this.createCharacterBtn.addEventListener('click', () => this.createCharacter());
    this.charRace.addEventListener('change', () => this.populateClasses());

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
    this.switchCharacterBtn = document.getElementById('switch-character-btn');

    this.switchCharacterBtn.addEventListener('click', () => this.switchCharacter());

    // Realm selection elements
    this.realmModal = document.getElementById('realm-modal');
    this.closeRealmModal = document.getElementById('close-realm-modal');
    this.realmOptions = document.querySelectorAll('.realm-option');

    this.closeRealmModal.addEventListener('click', () => this.hideRealmModal());
    this.realmModal.addEventListener('click', (e) => {
      if (e.target === this.realmModal) this.hideRealmModal();
    });
    this.realmOptions.forEach(option => {
      option.addEventListener('click', () => this.selectRealm(option.dataset.realm));
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
    localStorage.removeItem('user');
    localStorage.removeItem('character');
    this.hideCharacterInfo();
    this.hideCharacterModal();
    this.updateLoginBtn(false);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    // Clear players
    Object.keys(this.players).forEach(id => this.removePlayer(id));
    this.currentPlayer = null;
    alert('Logged out successfully.');
  }

  showLoginModal() {
    this.loginModal.classList.add('show');
  }

  hideLoginModal() {
    this.loginModal.classList.remove('show');
  }

  async handleLogin() {
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
        // Store user data or redirect
        localStorage.setItem('user', JSON.stringify(data));
        this.updateLoginBtn(true, data.username);
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
    this.characterModal.classList.add('show');
  }

  hideCharacterModal() {
    this.characterModal.classList.remove('show');
  }

  async loadCharacters() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    try {
      const response = await fetch(`/api/characters`);
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
    this.realmModal.classList.add('show');
  }

  hideRealmModal() {
    this.realmModal.classList.remove('show');
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
      const response = await fetch(`/api/characters`);
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
    this.charNameDisplay.textContent = `${character.name} (Lv.${character.level})`;
    this.healthFill.style.width = `${(character.current_health / character.max_health) * 100}%`;
    this.healthText.textContent = `${character.current_health}/${character.max_health}`;
    this.manaFill.style.width = `${(character.current_mana / character.max_mana) * 100}%`;
    this.manaText.textContent = `${character.current_mana}/${character.max_mana}`;
    this.staminaFill.style.width = `${(character.current_stamina / character.max_stamina) * 100}%`;
    this.staminaText.textContent = `${character.current_stamina}/${character.max_stamina}`;
    this.characterInfo.style.display = 'block';
  }

  updateLocationDisplay(position) {
    this.locationDisplay.textContent = `Location: X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}`;
  }

  updateZoomDisplay(zoom) {
    this.zoomDisplay.textContent = `Zoom: ${zoom}`;
  }

  updateLatencyDisplay(latency) {
    this.latencyDisplay.textContent = `Latency: ${latency} ms`;
  }

  startLatencyMeasurement() {
    setInterval(() => {
      const start = Date.now();
      this.socket.emit('ping', start);
    }, 1000);
  }

  hideCharacterInfo() {
    this.characterInfo.style.display = 'none';
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
    // Clear players
    Object.keys(this.players).forEach(id => this.removePlayer(id));
    this.currentPlayer = null;
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
      this.healthRegen.textContent = `(+${data.healthRegen}/s)`;
      this.manaRegen.textContent = `(+${data.manaRegen}/s)`;
      this.staminaRegen.textContent = `(+${data.staminaRegen}/s)`;
      this.addPlayer(this.socket.id, data.character, data.position, true);
      this.map.setView(this.toLatLng([data.position.x, data.position.y]), this.map.getZoom());
      this.updateLocationDisplay(data.position);
      this.updateZoomDisplay(this.map.getZoom());
      this.initMovement();
    });

    this.socket.on('existingPlayers', (players) => {
      players.forEach(p => this.addPlayer(p.id, p.character, p.position));
    });

    this.socket.on('playerJoined', (data) => {
      this.addPlayer(data.id, data.character, data.position);
    });

    this.socket.on('playerMoved', (data) => {
      this.updatePlayerPosition(data.id, data.position);
    });

    this.socket.on('moved', (newPos) => {
      this.updatePlayerPosition(this.socket.id, newPos);
    });

    this.socket.on('playerLeft', (id) => {
      this.removePlayer(id);
    });

    this.socket.on('error', (msg) => {
      alert('Error: ' + msg);
    });

    this.socket.on('logout', () => {
      this.logout();
    });

    this.socket.on('teleport', (position) => {
      this.moveToPosition(position.x, position.y);
    });

    this.socket.on('staminaUpdate', (data) => {
      this.staminaFill.style.width = `${(data.current / data.max) * 100}%`;
      this.staminaText.textContent = `${Math.round(data.current)}/${data.max}`;
      this.staminaRegen.textContent = `(${data.regen >= 0 ? '+' : ''}${data.regen}/s)`;
    });

    this.socket.on('healthUpdate', (data) => {
      this.healthFill.style.width = `${(data.current / data.max) * 100}%`;
      this.healthText.textContent = `${Math.round(data.current)}/${data.max}`;
      this.healthRegen.textContent = `(+${data.regen}/s)`;
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

  updatePlayerPosition(id, position) {
    if (this.players[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.players[id].position = position;
      if (id === this.socket.id) {
        this.updateLocationDisplay(position);
        this.map.panTo(latLng);
        this.players[id].marker.setLatLng(latLng); // Keep marker centered
      } else {
        this.animateMarker(this.players[id].marker, this.players[id].marker.getLatLng(), latLng, 200);
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
      delete this.players[id];
    }
  }

  initMovement() {
    this.keys = {};
    document.addEventListener('keydown', (e) => {
      if (!this.keys[e.key.toLowerCase()]) {
        this.keys[e.key.toLowerCase()] = true;
        this.socket.emit('keyDown', { key: e.key.toLowerCase() });
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.socket.emit('keyUp', { key: e.key.toLowerCase() });
    });
    this.map.on('zoomend', () => this.updateZoomDisplay(this.map.getZoom()));
  }

  moveToPosition(x, y) {
    // Clamp to map bounds
    x = Math.max(0, Math.min(6126, x));
    y = Math.max(0, Math.min(6190, y));
    this.socket.emit('move', { x, y });
    // Update local position immediately for responsiveness (will be corrected by server if invalid)
    this.updatePlayerPosition(this.socket.id, { x, y });
  }

  async createCharacter() {
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
        headers: { 'Content-Type': 'application/json' },
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
}

// Initialize the map when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.regnumMap = new RegnumMap();
  } catch (error) {
    console.error('Failed to initialize Regnum Map:', error);
  }
});
