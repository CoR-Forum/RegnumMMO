require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const gameData = require('./data/gameData');
const redis = require('redis');

// Import utilities and managers
const GAME_CONFIG = require('./constants');
const AuthManager = require('./utils/auth');
const { getPlayerInventory, validateAndFetchShopItem, syncPlayerToDB, getShopItems, getCharacterGold, updateCharacterGold } = require('./utils/database');
const { handleNPCInteraction, getVisibleNPCs, isNearMerchant } = require('./utils/npc');
const PlayerStateManager = require('./managers/PlayerStateManager');
const ErrorHandler = require('./managers/ErrorHandler');
const regionData = require('./data/regions');
const markersData = require('./data/markers');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379,
    family: 4 // IPv4
  }
});
console.log('Connecting to Redis at', process.env.REDIS_HOST || 'localhost');
redisClient.connect().catch(console.error);

// NPC interaction handlers - now using centralized utility
// (Removed 80 lines of duplicate code - now in utils/npc.js)

// Function to import example items to database
async function importExampleItems() {
  try {
    // Check if items already exist
    const [existing] = await db.promise().query('SELECT COUNT(*) as count FROM items');
    if (existing[0].count > 0) {
      console.log('Items already exist in database, skipping import');
      return;
    }

    console.log('Importing example items to database...');
    for (const item of gameData.items) {
      await db.promise().query(
        'INSERT INTO items (name, description, type, rarity, value, level_requirement, stackable) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.name, item.description, item.type, item.rarity, item.value, item.level_requirement, item.stackable]
      );
    }
    console.log('Example items imported successfully');
  } catch (error) {
    console.error('Error importing example items:', error);
  }
}

// Function to import shop items to database
async function importShopItems() {
  try {
    console.log('Importing shop items to database...');
    
    // Clear existing shop items to allow re-import
    await db.promise().query('DELETE FROM shop_items');
    
    // Get NPC and item IDs
    const [npcs] = await db.promise().query('SELECT id, name FROM npcs');
    const [items] = await db.promise().query('SELECT id, name FROM items');
    
    const npcMap = new Map(npcs.map(npc => [npc.name, npc.id]));
    const itemMap = new Map(items.map(item => [item.name, item.id]));
    
    for (const shopItem of gameData.shopItems) {
      const npcId = npcMap.get(shopItem.npcName);
      const itemId = itemMap.get(shopItem.itemName);
      
      if (npcId && itemId) {
        await db.promise().query(
          'INSERT INTO shop_items (npc_id, item_id, quantity, price) VALUES (?, ?, ?, ?)',
          [npcId, itemId, shopItem.quantity, shopItem.price]
        );
      } else {
        console.warn(`Could not find NPC "${shopItem.npcName}" or item "${shopItem.itemName}" for shop item`);
      }
    }
    console.log('Shop items imported successfully');
  } catch (error) {
    console.error('Error importing shop items:', error);
  }
}

// Function to import example NPCs to database
async function importExampleNPCs() {
  try {
    // Check if NPCs already exist
    const [existing] = await db.promise().query('SELECT COUNT(*) as count FROM npcs');
    if (existing[0].count > 0) {
      console.log('NPCs already exist in database, skipping import');
      return;
    }

    console.log('Importing example NPCs to database...');
    for (const npc of gameData.npcs) {
      await db.promise().query(
        'INSERT INTO npcs (name, realm, level, x, y, title, roaming_type, roaming_radius, roaming_speed, has_shop, has_quests, has_guard_duties, has_healing, has_blacksmith) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [npc.name, npc.realm, npc.level, npc.position.x, npc.position.y, npc.title || 'Citizen', npc.roaming_type, npc.roaming_radius || 0, npc.roaming_speed || 0, npc.has_shop || false, npc.has_quests || false, npc.has_guard_duties || false, npc.has_healing || false, npc.has_blacksmith || false]
      );
    }
    console.log('Example NPCs imported successfully');
  } catch (error) {
    console.error('Error importing example NPCs:', error);
  }
}

// Function to load markers from data file
function loadMarkers() {
  try {
    markersData.forEach((marker, index) => {
      const id = index + 1; // Simple incrementing ID
      markers[id] = {
        id: id,
        name: marker.name,
        description: marker.description,
        position: marker.position,
        type: marker.type,
        icon_color: marker.icon_color
      };
    });
    console.log(`Loaded ${Object.keys(markers).length} markers from data file`);
  } catch (error) {
    console.error('Error loading markers:', error);
  }
}

// Function to import example NPCs to database
async function loadNPCsFromDatabase() {
  try {
    const [rows] = await db.promise().query('SELECT * FROM npcs');
    rows.forEach(row => {
      npcs[row.id] = {
        id: row.id,
        name: row.name,
        level: row.level,
        realm: row.realm,
        position: { x: row.x, y: row.y },
        originalPosition: { x: row.x, y: row.y },
        title: row.title || 'Citizen',
        roaming_type: row.roaming_type || 'static',
        roaming_radius: row.roaming_radius || 0,
        roaming_speed: row.roaming_speed || 0,
        roaming_path: row.roaming_path ? JSON.parse(row.roaming_path) : null,
        has_shop: row.has_shop || false,
        has_quests: row.has_quests || false,
        has_guard_duties: row.has_guard_duties || false,
        has_healing: row.has_healing || false,
        has_blacksmith: row.has_blacksmith || false
      };
    });
    console.log(`Loaded ${rows.length} NPCs from database`);
  } catch (error) {
    console.error('Error loading NPCs from database:', error);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3223;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize Auth Manager
let authManager;

// NPC storage
const npcs = {};

// Markers storage
const markers = {};

// Initialize Player State Manager (will be set after io is ready)
let playerStateManager;

// Helper function for errors (deprecated - use ErrorHandler)
const sendError = (res, msg, code = 500) => res.status(code).json({ error: msg });

// Helper functions for visibility now in utils/npc.js
// (Removed duplicate code)

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'regnum_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize managers after db is available
authManager = new AuthManager(db, JWT_SECRET);

// Backward compatibility wrapper for isSessionValid
async function isSessionValid(sessionId) {
  return authManager.isSessionValid(sessionId);
}

const sessionStore = new MySQLStore({}, db.promise());

// Middleware
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(session({
  secret: JWT_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for HTTP; change to true if using HTTPS
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(express.static(path.join(__dirname)));

// Function to initialize database
async function initDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS realms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      forum_userID INT UNIQUE,
      username VARCHAR(255) UNIQUE,
      email VARCHAR(255),
      is_admin BOOLEAN DEFAULT FALSE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255),
      realm VARCHAR(255),
      race VARCHAR(255),
      class VARCHAR(255),
      level INT DEFAULT 1,
      conc INT DEFAULT 0,
      \`const\` INT DEFAULT 0,
      dex INT DEFAULT 0,
      \`int\` INT DEFAULT 0,
      str INT DEFAULT 0,
      max_health INT DEFAULT 0,
      current_health INT DEFAULT 0,
      max_mana INT DEFAULT 0,
      current_mana INT DEFAULT 0,
      max_stamina INT DEFAULT 0,
      current_stamina INT DEFAULT 0,
      gold INT DEFAULT 100,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS positions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL UNIQUE,
      x FLOAT DEFAULT 3072,
      y FLOAT DEFAULT 3072,
      date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
      expires INT(11) UNSIGNED NOT NULL,
      data MEDIUMTEXT COLLATE utf8mb4_bin,
      PRIMARY KEY (session_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS npcs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      realm VARCHAR(255),
      level INT DEFAULT 1,
      x FLOAT DEFAULT 0,
      y FLOAT DEFAULT 0,
      title VARCHAR(255) DEFAULT 'Citizen',
      roaming_type VARCHAR(50) DEFAULT 'static',
      roaming_radius INT DEFAULT 0,
      roaming_speed FLOAT DEFAULT 0,
      roaming_path LONGTEXT,
      has_shop BOOLEAN DEFAULT FALSE,
      has_quests BOOLEAN DEFAULT FALSE,
      has_guard_duties BOOLEAN DEFAULT FALSE,
      has_healing BOOLEAN DEFAULT FALSE,
      has_blacksmith BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
      description TEXT,
      type VARCHAR(50), -- weapon, armor, consumable, etc.
      rarity VARCHAR(20) DEFAULT 'common', -- common, uncommon, rare, epic, legendary
      value INT DEFAULT 0,
      level_requirement INT DEFAULT 1,
      stackable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS shop_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      npc_id INT NOT NULL,
      item_id INT NOT NULL,
      quantity INT DEFAULT 1,
      price INT DEFAULT 0,
      FOREIGN KEY (npc_id) REFERENCES npcs(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      UNIQUE KEY unique_shop_item (npc_id, item_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS player_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      item_id INT NOT NULL,
      quantity INT DEFAULT 1,
      tab_id INT DEFAULT 1,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`
  ];

  for (const query of tables) {
    try {
      await db.promise().query(query);
    } catch (err) {
      console.error('Error creating table:', err);
    }
  }

  // Add is_admin column to existing users table if it doesn't exist
  try {
    await db.promise().query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE');
    console.log('Ensured is_admin column exists in users table');
  } catch (err) {
    console.error('Error adding is_admin column:', err);
  }
}

// Game data

// Session check middleware for API
app.use('/api', async (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout' || req.path === '/health' || req.path === '/game-data' || req.path === '/validate-session') return next();
  if (req.session.user) {
    req.userId = req.session.user.id;
    return next();
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const isValid = await isSessionValid(decoded.sessionId);
      if (isValid) {
        req.userId = decoded.userId;
        return next();
      }
    } catch (e) {
      // invalid token
    }
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// Function to wait for database to be ready
async function waitForDatabase() {
  const maxRetries = 30; // 30 attempts = 30 seconds
  const retryDelay = 1000; // 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await db.promise().query('SELECT 1');
      console.log('Database connection established');
      return;
    } catch (error) {
      console.log(`Waiting for database... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  throw new Error('Database connection failed after maximum retries');
}

// Connect to database and initialize
(async () => {
  try {
    console.log('Waiting for database to be ready...');
    await waitForDatabase();
    
    await initDatabase();
    // Initialize game data
    await importExampleItems();
    await importExampleNPCs();
    await importShopItems();
    await loadNPCsFromDatabase();
    loadMarkers();
    
    console.log('Server initialization complete');
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();

// Login function
async function handleLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password are required.' });

  try {
    const response = await fetch('https://cor-forum.de/api.php/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key': process.env.API_KEY,
        'User-Agent': 'RegnumMMO-AIO-Server/1.0'
      },
      body: new URLSearchParams({ username, password })
    });

    const data = await response.json();

    if (!data.success) return res.status(401).json(data);

    const { userID, username: uname, email } = data;
    db.query('INSERT INTO users (forum_userID, username, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), email=VALUES(email)', [userID, uname, email], (err) => {
      if (err) return sendError(res, `Database error: ${err.message}`);
      // Get the db id and admin status for special admin functions (movement, zoom)
      db.query('SELECT id, is_admin FROM users WHERE forum_userID = ?', [userID], (err2, results) => {
        if (err2) return sendError(res, `Database error: ${err2.message}`);
        const dbId = results[0].id;
        const isAdmin = results[0].is_admin || false;
        req.session.regenerate((err) => {
          if (err) return sendError(res, 'Session regeneration failed');
          req.session.user = { id: dbId, forumUserID: userID, username: uname, email };
          req.session.save((saveErr) => {
            if (saveErr) return sendError(res, 'Session save failed');
            const token = jwt.sign({ userId: dbId, sessionId: req.session.id }, JWT_SECRET, { expiresIn: '24h' });
            // Include isAdmin for special admin functions (movement, zoom)
            res.json({ success: true, userID: dbId, forumUserID: userID, username: uname, email, token, isAdmin });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Routes
app.get('/api/health', async (req, res) => {
  try {
    // Check DB
    await db.promise().query('SELECT 1');
    // Check Redis
    await redisClient.ping();
    res.json({ status: 'OK', message: 'Regnum MMORPG server is running', db: 'connected', redis: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: 'Service unavailable', error: err.message });
  }
});

app.get('/api/characters', (req, res) => {
  db.query('SELECT * FROM characters WHERE user_id = ?', [req.userId], (err, results) => {
    if (err) return sendError(res, err.message);
    res.json(results);
  });
});

app.get('/api/character/:id', (req, res) => {
  const characterId = req.params.id;
  db.query('SELECT * FROM characters WHERE id = ? AND user_id = ?', [characterId, req.userId], (err, results) => {
    if (err) return sendError(res, err.message);
    if (results.length === 0) return sendError(res, 'Character not found', 404);
    res.json(results[0]);
  });
});

app.get('/api/game-data', (req, res) => {
  res.json(gameData);
});

app.get('/api/regions', (req, res) => {
  res.json(regionData);
});

app.get('/api/markers', (req, res) => {
  // Send all markers to client (similar to regions)
  res.json(Object.values(markers));
});

app.post('/api/characters', (req, res) => {
  const { name, realm, race, class: charClass } = req.body;
  const userID = req.userId;
  if (!name || !realm || !race || !charClass) {
    return res.status(400).json({ error: 'All fields required' });
  }

  // Check if user has existing characters and enforce realm consistency
  db.query('SELECT realm FROM characters WHERE user_id = ?', [userID], (err, results) => {
    if (err) return sendError(res, err.message);
    if (results.length > 0) {
      const existingRealms = results.map(r => r.realm);
      if (!existingRealms.includes(realm)) {
        return sendError(res, 'You can only create characters in the same realm as your existing characters.', 400);
      }
    }

    // Get starting attributes
    const key = `${race} ${charClass}`;
    const attrs = gameData.startingAttributes[key];
    if (!attrs) {
      return sendError(res, 'Invalid race-class combination', 400);
    }

    const maxHealth = attrs.const * 10;
    const maxMana = attrs.int * 10;
    const maxStamina = attrs.str * 10;

    db.query('INSERT INTO characters (user_id, name, realm, race, class, level, conc, \`const\`, dex, \`int\`, str, max_health, current_health, max_mana, current_mana, max_stamina, current_stamina, gold) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [userID, name, realm, race, charClass, attrs.conc, attrs.const, attrs.dex, attrs.int, attrs.str, maxHealth, maxHealth, maxMana, maxMana, maxStamina, maxStamina, 100], (err, result) => {
      if (err) return sendError(res, err.message);
      // Insert realm-specific starting position
      const startPos = GAME_CONFIG.MAP.REALM_START_POSITIONS[realm] || GAME_CONFIG.MAP.DEFAULT_POS;
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?)', [result.insertId, startPos.x, startPos.y], (err2) => {
        if (err2) console.error('Error inserting position:', err2);
        res.json({ success: true, id: result.insertId });
      });
    });
  });
});

app.post('/api/login', handleLogin);

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});



// Serve the map
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Socket.IO
const players = {}; // Store connected players: { socketId: { character, position, lastPos, lastTime } }
const userSockets = {}; // userId -> socketId, to enforce one connection per user

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    try {
      const [rows] = await db.promise().query('SELECT 1 FROM sessions WHERE session_id = ? AND expires > UNIX_TIMESTAMP(NOW())', [decoded.sessionId]);
      if (rows.length === 0) return next(new Error('Session invalid'));
      socket.userId = decoded.userId;
      socket.sessionId = decoded.sessionId;
      next();
    } catch (e) {
      return next(new Error('Database error'));
    }
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  // Enforce one connection per user: disconnect existing socket for this user
  if (userSockets[socket.userId]) {
    const oldSocketId = userSockets[socket.userId];
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      console.log('Disconnecting previous socket for user:', socket.userId);
      oldSocket.disconnect();
    }
  }
  userSockets[socket.userId] = socket.id;

  socket.on('keyDown', (data) => {
    if (!players[socket.id]) return;
    players[socket.id].moving[data.key] = true;
  });

  socket.on('keyUp', (data) => {
    if (!players[socket.id]) return;
    delete players[socket.id].moving[data.key];
  });

  socket.on('join', async (data) => {
    const { characterId } = data;
    if (!(await isSessionValid(socket.sessionId))) {
      socket.emit('logout');
      socket.disconnect();
      return;
    }
    try {
      const [results] = await db.promise().query('SELECT * FROM characters WHERE id = ? AND user_id = ?', [characterId, socket.userId]);
      if (results.length === 0) {
        socket.emit('error', 'Invalid character');
        return;
      }
      const character = results[0];
      const [posResults] = await db.promise().query('SELECT * FROM positions WHERE character_id = ?', [characterId]);
      const realmStartPos = GAME_CONFIG.MAP.REALM_START_POSITIONS[character.realm] || GAME_CONFIG.MAP.DEFAULT_POS;
      let position = posResults[0] || realmStartPos;

      // Check if Redis has more recent data
      const redisData = await redisClient.get(`player:${characterId}`);
      if (redisData) {
        const redisPlayer = JSON.parse(redisData);
        position = redisPlayer.position;
        character.current_health = redisPlayer.character.current_health;
        character.current_mana = redisPlayer.character.current_mana;
        character.current_stamina = redisPlayer.character.current_stamina;
      }

      players[socket.id] = { character, position, lastPos: { ...position }, lastTime: Date.now(), lastDbUpdate: Date.now(), lastStaminaDbUpdate: Date.now(), lastHealthDbUpdate: Date.now(), lastManaDbUpdate: Date.now(), moving: {}, visibleNPCs: new Set(), zoom: GAME_CONFIG.VISION.INITIAL_ZOOM };
      redisClient.set(`player:${characterId}`, JSON.stringify(players[socket.id]));
      socket.characterId = characterId;
      socket.emit('joined', {
        character,
        position,
        regionContext: playerStateManager.getRegionContext(position),
        speed: GAME_CONFIG.MOVEMENT.BASE_SPEED,
        healthRegen: GAME_CONFIG.REGENERATION_DISPLAY.HEALTH_PER_SEC,
        manaRegen: GAME_CONFIG.REGENERATION_DISPLAY.MANA_PER_SEC,
        staminaRegen: GAME_CONFIG.REGENERATION_DISPLAY.STAMINA_IDLE_PER_SEC,
        zoom: GAME_CONFIG.VISION.INITIAL_ZOOM
      });
      // Broadcast to others
      socket.broadcast.emit('playerJoined', { id: socket.id, character, position });
      // Send existing players to this player
      const existingPlayers = Object.keys(players).filter(id => id !== socket.id).map(id => ({ id, ...players[id] }));
      socket.emit('existingPlayers', existingPlayers);
      // Send visible NPCs to this player
      const viewDistance = GAME_CONFIG.VISION.getViewDistance(GAME_CONFIG.VISION.INITIAL_ZOOM);
      const visibleNPCs = getVisibleNPCs(npcs, position, viewDistance);
      socket.emit('npcs', visibleNPCs);
      // Track visible NPCs
      visibleNPCs.forEach(npc => players[socket.id].visibleNPCs.add(npc.id));
      // Send all markers to this player
      socket.emit('markers', Object.values(markers));
    } catch (err) {
      socket.emit('error', `Database error: ${err.message}`);
    }
  });

  socket.on('ping', (start) => {
    socket.emit('pong', start);
  });

  socket.on('interactNPC', (npcId) => {
    const npc = npcs[npcId];
    if (!npc) return;

    // Use centralized NPC interaction handler
    handleNPCInteraction(npc, socket);
  });

  socket.on('getShopItems', async (npcId) => {
    try {
      const shopItems = await getShopItems(npcId, db);
      socket.emit('shopItems', { npcId, items: shopItems });
    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'getShopItems')(error);
    }
  });

  socket.on('buyItems', async (data) => {
    const { npcId, items } = data;
    if (!players[socket.id]) return;

    try {
      let totalCost = 0;

      // Calculate total cost and validate items
      for (const item of items) {
        const shopItemData = await validateAndFetchShopItem(npcId, item.itemId, db);

        if (!shopItemData) {
          return ErrorHandler.sendSocketError(socket, 'Item not available in this shop');
        }

        if (shopItemData.stock < item.quantity) {
          return ErrorHandler.sendSocketError(socket, `Not enough ${shopItemData.name} in stock`);
        }

        totalCost += shopItemData.price * item.quantity;
      }

      // Check if player has enough gold
      const playerGold = await getCharacterGold(socket.characterId, db);

      if (playerGold < totalCost) {
        return ErrorHandler.sendSocketError(socket, 'Not enough gold');
      }

      // Process each item purchase
      for (const item of items) {
        const shopItemData = await validateAndFetchShopItem(npcId, item.itemId, db);

        if (shopItemData.stackable) {
          // For stackable items, check if player already has this item
          const [existingRows] = await db.promise().query(
            'SELECT id, quantity FROM player_inventory WHERE character_id = ? AND item_id = ?',
            [socket.characterId, item.itemId]
          );

          if (existingRows.length > 0) {
            // Increase quantity
            await db.promise().query(
              'UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?',
              [item.quantity, existingRows[0].id]
            );
          } else {
            // Add new item to tab 1
            await db.promise().query(
              'INSERT INTO player_inventory (character_id, item_id, tab_id, quantity) VALUES (?, ?, 1, ?)',
              [socket.characterId, item.itemId, item.quantity]
            );
          }
        } else {
          // For non-stackable items, add each one as separate entries
          for (let i = 0; i < item.quantity; i++) {
            await db.promise().query(
              'INSERT INTO player_inventory (character_id, item_id, tab_id, quantity) VALUES (?, ?, 1, 1)',
              [socket.characterId, item.itemId]
            );
          }
        }

        // Update shop stock
        await db.promise().query(`
          UPDATE shop_items SET quantity = quantity - ? WHERE npc_id = ? AND item_id = ?
        `, [item.quantity, npcId, item.itemId]);
      }

      // Deduct gold from player
      await updateCharacterGold(socket.characterId, -totalCost, db);

      socket.emit('transactionComplete', { type: 'buy', totalCost });

      // Send updated inventory and gold to client
      const inventory = await getPlayerInventory(socket.characterId, db);
      socket.emit('inventoryUpdate', inventory);

      const updatedGold = await getCharacterGold(socket.characterId, db);
      socket.emit('goldUpdate', { gold: updatedGold });

    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'buyItems')(error);
    }
  });

  socket.on('getInventory', async () => {
    if (!socket.characterId) return;

    try {
      const inventory = await getPlayerInventory(socket.characterId, db);
      socket.emit('inventoryUpdate', inventory);
    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'getInventory')(error);
    }
  });

  socket.on('moveItemToTab', async (data) => {
    const { inventoryId, toTab } = data;
    if (!socket.characterId) return;

    try {
      // Move item to new tab
      await db.promise().query(
        'UPDATE player_inventory SET tab_id = ? WHERE id = ? AND character_id = ?',
        [toTab, inventoryId, socket.characterId]
      );

      // Send updated inventory to client
      const inventory = await getPlayerInventory(socket.characterId, db);
      socket.emit('inventoryUpdate', inventory);

    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'moveItemToTab')(error);
    }
  });

  socket.on('dropItem', async (data) => {
    const { inventoryId, quantity = 1 } = data;
    if (!socket.characterId) return;

    try {
      const [item] = await db.promise().query(
        'SELECT quantity FROM player_inventory WHERE id = ? AND character_id = ?',
        [inventoryId, socket.characterId]
      );

      if (item.length === 0) return;

      if (item[0].quantity > quantity) {
        // Reduce quantity
        await db.promise().query(
          'UPDATE player_inventory SET quantity = quantity - ? WHERE id = ?',
          [quantity, inventoryId]
        );
      } else {
        // Remove item completely
        await db.promise().query(
          'DELETE FROM player_inventory WHERE id = ?',
          [inventoryId]
        );
      }

      // Send updated inventory to client
      const inventory = await getPlayerInventory(socket.characterId, db);
      socket.emit('inventoryUpdate', inventory);

    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'dropItem')(error);
    }
  });

  socket.on('sellItems', async (data) => {
    const { items } = data;
    if (!socket.characterId) return;

    // Check if player is near a merchant NPC
    const player = players[socket.id];
    if (!player) return;

    if (!isNearMerchant(npcs, player.position)) {
      return ErrorHandler.sendSocketError(socket, 'You must be near a merchant to sell items');
    }

    try {
      let totalGoldEarned = 0;

      // Process each item sale
      for (const item of items) {
        // Get item details
        const [itemDetails] = await db.promise().query(`
          SELECT pi.quantity as inventory_quantity, i.value, i.name
          FROM player_inventory pi
          JOIN items i ON pi.item_id = i.id
          WHERE pi.id = ? AND pi.character_id = ?
        `, [item.inventoryId, socket.characterId]);

        if (itemDetails.length === 0) {
          return ErrorHandler.sendSocketError(socket, 'Item not found');
        }

        const itemData = itemDetails[0];
        const sellQuantity = Math.min(item.quantity, itemData.inventory_quantity);
        const sellValue = Math.floor(itemData.value * 0.5 * sellQuantity); // Sell for 50% of value
        totalGoldEarned += sellValue;

        if (itemData.inventory_quantity > sellQuantity) {
          // Reduce quantity
          await db.promise().query(
            'UPDATE player_inventory SET quantity = quantity - ? WHERE id = ?',
            [sellQuantity, item.inventoryId]
          );
        } else {
          // Remove item completely
          await db.promise().query(
            'DELETE FROM player_inventory WHERE id = ?',
            [item.inventoryId]
          );
        }
      }

      // Add gold to player
      await updateCharacterGold(socket.characterId, totalGoldEarned, db);

      socket.emit('transactionComplete', { type: 'sell', totalGoldEarned });

      // Send updated inventory and gold to client
      const inventory = await getPlayerInventory(socket.characterId, db);
      socket.emit('inventoryUpdate', inventory);

      const updatedGold = await getCharacterGold(socket.characterId, db);
      socket.emit('goldUpdate', { gold: updatedGold });

    } catch (error) {
      ErrorHandler.handleSocketError(socket, 'sellItems')(error);
    }
  });

  socket.on('zoomChanged', (newZoom) => {
    if (!players[socket.id]) return;
    const player = players[socket.id];
    player.zoom = newZoom;
    // Update visibility based on new zoom
    const viewDistance = GAME_CONFIG.VISION.getViewDistance(newZoom);
    const currentVisible = new Set(getVisibleNPCs(npcs, player.position, viewDistance).map(npc => npc.id));
    const previouslyVisible = player.visibleNPCs;
    const newVisible = [...currentVisible].filter(id => !previouslyVisible.has(id));
    const noLongerVisible = [...previouslyVisible].filter(id => !currentVisible.has(id));

    if (newVisible.length > 0) {
      const newNPCs = newVisible.map(id => npcs[id]);
      socket.emit('npcs', newNPCs);
    }
    if (noLongerVisible.length > 0) {
      socket.emit('npcsLeft', noLongerVisible);
    }
    player.visibleNPCs = currentVisible;
  });

  socket.on('disconnect', async () => {
    if (socket.characterId) {
      // Save final data from Redis to DB
      const playerData = await redisClient.get(`player:${socket.characterId}`);
      if (playerData) {
        const player = JSON.parse(playerData);
        try {
          await syncPlayerToDB(socket.characterId, player, db);
          await redisClient.del(`player:${socket.characterId}`);
        } catch (error) {
          ErrorHandler.logError('disconnect-sync', error);
        }
      }
    }
    if (players[socket.id]) {
      delete players[socket.id];
      socket.broadcast.emit('playerLeft', socket.id);
    }
    delete userSockets[socket.userId];
    console.log('User disconnected:', socket.userId);
  });
});

// Initialize PlayerStateManager after io is ready
playerStateManager = new PlayerStateManager(io, npcs, redisClient);

// Global update loop - now using PlayerStateManager
setInterval(() => {
  Object.keys(players).forEach(async (socketId) => {
    const player = players[socketId];
    await playerStateManager.processPlayerUpdate(socketId, player);
  });
}, GAME_CONFIG.UPDATE_INTERVALS.PLAYER_MOVEMENT); // 20ms for smooth movement

// NPC update loop
setInterval(() => {
  Object.values(npcs).forEach(npc => {
    if (npc.roaming_type === 'static') return;

    // Simple wandering AI
    if (npc.roaming_type === 'wander' && npc.roaming_radius > 0) {
      // Move randomly within radius
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * npc.roaming_speed;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      const newX = npc.position.x + dx;
      const newY = npc.position.y + dy;

      // Check if within roaming radius from original position
      const distFromOrigin = Math.sqrt((newX - npc.originalPosition.x) ** 2 + (newY - npc.originalPosition.y) ** 2);
      if (distFromOrigin <= npc.roaming_radius) {
        npc.position.x = Math.max(GAME_CONFIG.MAP.BOUNDS.minX, Math.min(GAME_CONFIG.MAP.BOUNDS.maxX, newX));
        npc.position.y = Math.max(GAME_CONFIG.MAP.BOUNDS.minY, Math.min(GAME_CONFIG.MAP.BOUNDS.maxY, newY));
        // Broadcast NPC movement to players who can see it
        Object.keys(players).forEach(socketId => {
          const player = players[socketId];
          const viewDistance = GAME_CONFIG.VISION.getViewDistance(player.zoom);
          const wasVisible = player.visibleNPCs.has(npc.id);
          const dist = Math.sqrt((npc.position.x - player.position.x) ** 2 + (npc.position.y - player.position.y) ** 2);
          const isVisible = dist <= viewDistance;
          if (isVisible) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) socket.emit('npcMoved', { id: npc.id, position: npc.position });
            if (!wasVisible) {
              // NPC entered view
              socket.emit('npcs', [npc]);
              player.visibleNPCs.add(npc.id);
            }
          } else if (wasVisible) {
            // NPC left view
            const socket = io.sockets.sockets.get(socketId);
            if (socket) socket.emit('npcsLeft', [npc.id]);
            player.visibleNPCs.delete(npc.id);
          }
        });
      }
    }
  });
}, GAME_CONFIG.UPDATE_INTERVALS.NPC_MOVEMENT); // Update NPCs every second

// Session validation endpoint
app.post('/api/validate-session', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ valid: false });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.json({ valid: false });
    }
    const isValid = await isSessionValid(decoded.sessionId);
    if (!isValid) return res.json({ valid: false });
    
    // Get user info
    try {
      const [userRows] = await db.promise().query('SELECT is_admin FROM users WHERE id = ?', [decoded.userId]);
      if (userRows.length === 0) return res.json({ valid: false });
      
      // Include is_admin for special admin functions (movement, zoom)
      const isAdmin = userRows[0].is_admin || false;
      res.json({ valid: true, isAdmin });
    } catch (error) {
      console.error('Session validation error:', error);
      res.json({ valid: false });
    }
  });
});

// Periodic sync from Redis to DB
setInterval(async () => {
  try {
    const keys = await redisClient.keys('player:*');
    for (const key of keys) {
      const playerData = await redisClient.get(key);
      if (playerData) {
        const player = JSON.parse(playerData);
        const characterId = key.split(':')[1];

        // Check if character still exists in database
        const [charRows] = await db.promise().query('SELECT 1 FROM characters WHERE id = ?', [characterId]);
        if (charRows.length === 0) {
          // Character no longer exists, remove from Redis
          await redisClient.del(key);
          continue;
        }

        // Use promise-based sync instead of callback hell
        try {
          await syncPlayerToDB(characterId, player, db);
        } catch (error) {
          ErrorHandler.logError('periodic-sync', error);
        }
      }
    }
  } catch (err) {
    ErrorHandler.logError('periodic-sync-loop', err);
  }
}, GAME_CONFIG.UPDATE_INTERVALS.REDIS_DB_SYNC); // every 10 seconds

// Start server
server.listen(PORT, () => {
  console.log(`RegnumMMO AIO server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
});
