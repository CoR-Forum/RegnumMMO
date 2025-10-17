"use strict";

/**
 * Regnum Online Bare Map
 * A simple Leaflet-based map for the Regnum Online MMORPG
 */
class RegnumMap {
  static MAP_SETTINGS = Object.freeze({
    gameDimensions: [6126, 6190],
    imageDimensions: [8862, 8879],
    initialZoom: 3,
    maxZoom: 9,
    minZoom: 0,
    tilePath: 'https://maps.cor-forum.de/tiles/{z}/{x}/{y}.png',
    attribution: `
      Created by <a href="https://github.com/Joshua2504" target="_blank">Joshua2504</a><br>
      Contribute on <a href="https://github.com/CoR-Forum/Regnum.Online" target="_blank">GitHub</a>
    `.trim()
  });

  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.rasterCoords = null;
    this.socket = null;
    this.players = {}; // { id: { marker, character } }
    this.currentPlayer = null;
    this.init();
    this.initLogin();
  }

  init() {
    try {
      this.createMap();
      this.setupTileLayer();
    } catch (error) {
      console.error('Failed to initialize map:', error);
      this.handleMapError(error);
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

  initLogin() {
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
    this.loginModal.addEventListener('click', (e) => {
      if (e.target === this.loginModal) this.hideLoginModal();
    });

    this.initCharacter();
    this.initCharacterInfo();
  }

  checkLoginStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.success) {
      this.updateLoginBtn(true, user.username);
    } else {
      this.updateLoginBtn(false);
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
      this.logout();
    } else {
      this.showLoginModal();
    }
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('character');
    this.hideCharacterInfo();
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
        setTimeout(() => {
          this.hideLoginModal();
          this.showCharacterModal();
        }, 1000);
      } else {
        this.loginMessage.textContent = data.error || 'Login failed.';
      }
    } catch (error) {
      console.error('Login error:', error);
      this.loginMessage.textContent = 'An error occurred. Please try again.';
    }
  }

  initCharacter() {
    this.characterModal = document.getElementById('character-modal');
    this.closeCharacterModal = document.getElementById('close-character-modal');
    this.characterList = document.getElementById('character-list');
    this.charName = document.getElementById('char-name-input');
    this.charRealm = document.getElementById('char-realm');
    this.charRace = document.getElementById('char-race');
    this.charClass = document.getElementById('char-class');
    this.createCharacterBtn = document.getElementById('create-character');
    this.characterMessage = document.getElementById('character-message');

    this.closeCharacterModal.addEventListener('click', () => this.hideCharacterModal());
    this.characterModal.addEventListener('click', (e) => {
      if (e.target === this.characterModal) this.hideCharacterModal();
    });
    this.createCharacterBtn.addEventListener('click', () => this.createCharacter());
    this.charRealm.addEventListener('change', () => this.populateRaces());
    this.charRace.addEventListener('change', () => this.populateClasses());

    this.loadGameData();
  }

  async loadGameData() {
    try {
      const response = await fetch('/api/game-data');
      this.gameData = await response.json();
      this.populateSelects();
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  }

  populateSelects() {
    // Populate realms
    this.gameData.realms.forEach(realm => {
      const option = document.createElement('option');
      option.value = realm;
      option.textContent = realm;
      this.charRealm.appendChild(option);
    });
  }

  populateRaces() {
    const selectedRealm = this.charRealm.value;
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
    this.characterModal.classList.add('show');
  }

  hideCharacterModal() {
    this.characterModal.classList.remove('show');
  }

  async loadCharacters() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    try {
      const response = await fetch(`/api/characters?userID=${user.userID}`);
      const characters = await response.json();
      this.characterList.innerHTML = '';
      characters.forEach(char => {
        const div = document.createElement('div');
        div.className = 'character-item';
        div.textContent = `${char.name} - ${char.realm} ${char.race} ${char.class}`;
        div.addEventListener('click', () => this.selectCharacter(char));
        this.characterList.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  }

  initCharacterInfo() {
    this.characterInfo = document.getElementById('character-info');
    this.charNameDisplay = document.getElementById('char-name');
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.manaFill = document.getElementById('mana-fill');
    this.manaText = document.getElementById('mana-text');
    this.staminaFill = document.getElementById('stamina-fill');
    this.staminaText = document.getElementById('stamina-text');

    // Check if character is selected
    const character = JSON.parse(localStorage.getItem('character'));
    if (character) {
      this.updateCharacterInfo(character);
    }
  }

  updateCharacterInfo(character) {
    this.charNameDisplay.textContent = character.name;
    const healthPercent = (character.current_health / character.max_health) * 100;
    const manaPercent = (character.current_mana / character.max_mana) * 100;
    const staminaPercent = (character.current_stamina / character.max_stamina) * 100;

    this.healthFill.style.width = `${healthPercent}%`;
    this.healthText.textContent = `${character.current_health}/${character.max_health}`;

    this.manaFill.style.width = `${manaPercent}%`;
    this.manaText.textContent = `${character.current_mana}/${character.max_mana}`;

    this.staminaFill.style.width = `${staminaPercent}%`;
    this.staminaText.textContent = `${character.current_stamina}/${character.max_stamina}`;

    this.characterInfo.style.display = 'block';
  }

  hideCharacterInfo() {
    this.characterInfo.style.display = 'none';
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
      this.socket.emit('join', characterId);
    });

    this.socket.on('joined', (data) => {
      console.log('Joined game', data);
      this.currentPlayer = data.character;
      this.addPlayer(this.socket.id, data.character, data.position, true);
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

    this.socket.on('playerLeft', (id) => {
      this.removePlayer(id);
    });

    this.socket.on('error', (msg) => {
      alert('Error: ' + msg);
    });
  }

  addPlayer(id, character, position, isCurrent = false) {
    const latLng = this.toLatLng([position.x, position.y]);
    const marker = L.marker(latLng).addTo(this.map);
    marker.bindPopup(`${character.name} (${character.race} ${character.class})`);
    if (isCurrent) {
      marker.setIcon(L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }));
    }
    this.players[id] = { marker, character, position };
  }

  updatePlayerPosition(id, position) {
    if (this.players[id]) {
      const latLng = this.toLatLng([position.x, position.y]);
      this.players[id].marker.setLatLng(latLng);
      this.players[id].position = position;
    }
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
      this.keys[e.key.toLowerCase()] = true;
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    this.map.on('click', (e) => {
      this.moveTo(e.latlng);
    });
    this.movementInterval = setInterval(() => this.handleMovement(), 100);
  }

  handleMovement() {
    if (!this.currentPlayer || !this.socket) return;
    let dx = 0, dy = 0;
    const speed = 10; // Adjust speed
    if (this.keys['w']) dy -= speed;
    if (this.keys['s']) dy += speed;
    if (this.keys['a']) dx -= speed;
    if (this.keys['d']) dx += speed;
    if (dx !== 0 || dy !== 0) {
      const currentPos = this.players[this.socket.id].position;
      const newX = currentPos.x + dx;
      const newY = currentPos.y + dy;
      this.moveToPosition(newX, newY);
    }
  }

  moveTo(latlng) {
    const coords = this.rasterCoords.unproject(latlng);
    this.moveToPosition(coords[0], coords[1]);
  }

  moveToPosition(x, y) {
    // Clamp to map bounds
    x = Math.max(0, Math.min(6126, x));
    y = Math.max(0, Math.min(6190, y));
    this.socket.emit('move', { x, y });
    // Update local position immediately for responsiveness
    this.updatePlayerPosition(this.socket.id, { x, y });
  }

  async createCharacter() {
    const user = JSON.parse(localStorage.getItem('user'));
    const name = this.charName.value.trim();
    const realm = this.charRealm.value;
    const race = this.charRace.value;
    const cls = this.charClass.value;
    if (!name || !realm || !race || !cls) {
      this.characterMessage.textContent = 'All fields are required.';
      return;
    }
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.userID, name, realm, race, class: cls })
      });
      const data = await response.json();
      if (data.success) {
        this.characterMessage.textContent = 'Character created!';
        this.loadCharacters();
        this.charName.value = '';
        this.charRealm.value = '';
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
