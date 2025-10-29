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

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379,
    family: 4 // IPv4
  }
});
console.log('Connecting to Redis at', process.env.REDIS_HOST || 'localhost');
redisClient.connect().catch(console.error);

// NPC Type definitions
const NPC_TYPES = {
  CIVILIAN: 'civilian',
  MERCHANT: 'merchant',
  QUEST_GIVER: 'quest_giver',
  GUARD: 'guard',
  HEALER: 'healer',
  BLACKSMITH: 'blacksmith',
  KING: 'king',
  WARLORD: 'warlord'
};

// NPC interaction handlers
const npcInteractions = {
  [NPC_TYPES.CIVILIAN]: (npc, socket) => {
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: `Hello, I am ${npc.name}, a humble citizen of ${npc.realm}.` 
    });
  },

  [NPC_TYPES.MERCHANT]: (npc, socket) => {
    let message = `Greetings traveler! I am ${npc.name}, a merchant from ${npc.realm}.`;
    if (npc.has_shop) {
      message += ` Would you like to see my wares?`;
      // Send shop data to client
      socket.emit('openShop', { npcId: npc.id, npcName: npc.name });
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.QUEST_GIVER]: (npc, socket) => {
    let message = `Ah, an adventurer! I am ${npc.name} of ${npc.realm}.`;
    if (npc.has_quests) {
      message += ` I have quests that need doing. Are you interested?`;
      // TODO: Show quest dialog
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.GUARD]: (npc, socket) => {
    let message = `Halt! I am ${npc.name}, guardian of ${npc.realm}.`;
    if (npc.has_guard_duties) {
      message += ` State your business.`;
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.HEALER]: (npc, socket) => {
    let message = `Welcome, weary traveler. I am ${npc.name}, a healer from ${npc.realm}.`;
    if (npc.has_healing) {
      message += ` I can mend your wounds for a small fee.`;
      // TODO: Healing service
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.BLACKSMITH]: (npc, socket) => {
    let message = `The forge calls! I am ${npc.name}, master blacksmith of ${npc.realm}.`;
    if (npc.has_blacksmith) {
      message += ` Need your weapons repaired or upgraded?`;
      // TODO: Blacksmith services
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.KING]: (npc, socket) => {
    let message = `Approach with respect! I am ${npc.name}, ruler of ${npc.realm}.`;
    if (npc.has_quests) {
      message += ` What brings you to my throne?`;
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  },

  [NPC_TYPES.WARLORD]: (npc, socket) => {
    let message = `Strength and honor! I am ${npc.name}, warlord of ${npc.realm}.`;
    if (npc.has_quests) {
      message += ` Prove your worth in battle!`;
    }
    socket.emit('npcMessage', { 
      npcId: npc.id, 
      message: message
    });
  }
};

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
        'INSERT INTO npcs (name, realm, level, x, y, npc_type, roaming_type, roaming_radius, roaming_speed, has_shop, has_quests, has_guard_duties, has_healing, has_blacksmith) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [npc.name, npc.realm, npc.level, npc.position.x, npc.position.y, npc.npc_type, npc.roaming_type, npc.roaming_radius || 0, npc.roaming_speed || 0, npc.has_shop || false, npc.has_quests || false, npc.has_guard_duties || false, npc.has_healing || false, npc.has_blacksmith || false]
      );
    }
    console.log('Example NPCs imported successfully');
  } catch (error) {
    console.error('Error importing example NPCs:', error);
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
        npc_type: row.npc_type || 'civilian',
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

// Constants
const BASE_SPEED = 0.3;
const SPRINT_MULTIPLIER = 20;
const MAP_BOUNDS = { minX: 0, maxX: 6157, minY: 0, maxY: 6192 };
const DEFAULT_POS = { x: 3078, y: 3096 };
const VIEW_DISTANCE = 1000; // NPCs visible within 1000 units
const INITIAL_ZOOM = 7;

// NPC storage
const npcs = {};

// Helper function for errors


// Helper function for errors
const sendError = (res, msg, code = 500) => res.status(code).json({ error: msg });

// Function to get NPCs visible from a position
function getVisibleNPCs(position, viewDistance = VIEW_DISTANCE) {
  const visible = [];
  Object.values(npcs).forEach(npc => {
    const dist = Math.sqrt((npc.position.x - position.x) ** 2 + (npc.position.y - position.y) ** 2);
    if (dist <= viewDistance) {
      visible.push(npc);
    }
  });
  return visible;
}

// Function to calculate view distance based on zoom
function getViewDistance(zoom) {
  return 80 * Math.pow(2, 9 - zoom);
}

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

// Function to check if session is valid
async function isSessionValid(sessionId) {
  try {
    const [rows] = await db.promise().query('SELECT 1 FROM sessions WHERE session_id = ? AND expires > UNIX_TIMESTAMP(NOW())', [sessionId]);
    return rows.length > 0;
  } catch (e) {
    console.error('Session check error:', e);
    return false;
  }
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
      email VARCHAR(255)
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS positions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL UNIQUE,
      x FLOAT DEFAULT 3078,
      y FLOAT DEFAULT 3096,
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
      npc_type VARCHAR(50) DEFAULT 'civilian',
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
      // Get the db id
      db.query('SELECT id FROM users WHERE forum_userID = ?', [userID], (err2, results) => {
        if (err2) return sendError(res, `Database error: ${err2.message}`);
        const dbId = results[0].id;
        req.session.regenerate((err) => {
          if (err) return sendError(res, 'Session regeneration failed');
          req.session.user = { id: dbId, forumUserID: userID, username: uname, email };
          req.session.save((saveErr) => {
            if (saveErr) return sendError(res, 'Session save failed');
            const token = jwt.sign({ userId: dbId, sessionId: req.session.id }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ success: true, userID: dbId, forumUserID: userID, username: uname, email, token });
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

app.get('/api/game-data', (req, res) => {
  res.json(gameData);
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

    db.query('INSERT INTO characters (user_id, name, realm, race, class, level, conc, \`const\`, dex, \`int\`, str, max_health, current_health, max_mana, current_mana, max_stamina, current_stamina) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [userID, name, realm, race, charClass, attrs.conc, attrs.const, attrs.dex, attrs.int, attrs.str, maxHealth, maxHealth, maxMana, maxMana, maxStamina, maxStamina], (err, result) => {
      if (err) return sendError(res, err.message);
      // Insert default position
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?)', [result.insertId, DEFAULT_POS.x, DEFAULT_POS.y], (err2) => {
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
      let position = posResults[0] || DEFAULT_POS;

      // Check if Redis has more recent data
      const redisData = await redisClient.get(`player:${characterId}`);
      if (redisData) {
        const redisPlayer = JSON.parse(redisData);
        position = redisPlayer.position;
        character.current_health = redisPlayer.character.current_health;
        character.current_mana = redisPlayer.character.current_mana;
        character.current_stamina = redisPlayer.character.current_stamina;
      }

      players[socket.id] = { character, position, lastPos: { ...position }, lastTime: Date.now(), lastDbUpdate: Date.now(), lastStaminaDbUpdate: Date.now(), lastHealthDbUpdate: Date.now(), lastManaDbUpdate: Date.now(), moving: {}, visibleNPCs: new Set(), zoom: INITIAL_ZOOM };
      redisClient.set(`player:${characterId}`, JSON.stringify(players[socket.id]));
      socket.characterId = characterId;
      socket.emit('joined', { character, position, speed: BASE_SPEED, healthRegen: 0.25, manaRegen: 0.25, staminaRegen: 2.0, zoom: INITIAL_ZOOM });
      // Broadcast to others
      socket.broadcast.emit('playerJoined', { id: socket.id, character, position });
      // Send existing players to this player
      const existingPlayers = Object.keys(players).filter(id => id !== socket.id).map(id => ({ id, ...players[id] }));
      socket.emit('existingPlayers', existingPlayers);
      // Send visible NPCs to this player
      const viewDistance = getViewDistance(INITIAL_ZOOM);
      const visibleNPCs = getVisibleNPCs(position, viewDistance);
      socket.emit('npcs', visibleNPCs);
      // Track visible NPCs
      visibleNPCs.forEach(npc => players[socket.id].visibleNPCs.add(npc.id));
    } catch (err) {
      socket.emit('error', `Database error: ${err.message}`);
    }
  });

  socket.on('move', async (data) => {
    if (!(await isSessionValid(socket.sessionId))) {
      socket.emit('logout');
      socket.disconnect();
      return;
    }
    if (!players[socket.id]) return;

    const player = players[socket.id];
    let newPos;

    // Click movement disabled for now
    /*
    if (data.x !== undefined && data.y !== undefined) {
      // Click movement: direct position
      newPos = { x: data.x, y: data.y };
    } else {
      return; // Invalid data
    }
    */

    return; // Disabled

    // Clamp position to map bounds
    newPos.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, newPos.x));
    newPos.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, newPos.y));

    // Valid move
    player.position = newPos;
    player.lastPos = { ...newPos };
    player.lastTime = Date.now();

    // Update DB every 1 second to avoid spamming
    if (Date.now() - player.lastDbUpdate > 1000) {
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [socket.characterId, newPos.x, newPos.y]);
      player.lastDbUpdate = Date.now();
    }

    // Broadcast to others
    socket.broadcast.emit('playerMoved', { id: socket.id, position: newPos });
    // Send back to client
    socket.emit('moved', newPos);
  });



  socket.on('ping', (start) => {
    socket.emit('pong', start);
  });

  socket.on('interactNPC', (npcId) => {
    const npc = npcs[npcId];
    if (!npc) return;

    const interactionHandler = npcInteractions[npc.npc_type] || npcInteractions[NPC_TYPES.CIVILIAN];
    interactionHandler(npc, socket);
  });

  socket.on('getShopItems', async (npcId) => {
    try {
      const [shopItems] = await db.promise().query(`
        SELECT si.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement
        FROM shop_items si
        JOIN items i ON si.item_id = i.id
        WHERE si.npc_id = ? AND si.quantity > 0
      `, [npcId]);
      
      socket.emit('shopItems', { npcId, items: shopItems });
    } catch (error) {
      console.error('Error getting shop items:', error);
      socket.emit('error', 'Failed to load shop items');
    }
  });

  socket.on('buyItem', async (data) => {
    const { npcId, itemId, quantity = 1 } = data;
    if (!players[socket.id]) return;
    
    try {
      // Get item price
      const [shopItem] = await db.promise().query(`
        SELECT si.price, si.quantity as stock, i.name, i.value, i.stackable
        FROM shop_items si
        JOIN items i ON si.item_id = i.id
        WHERE si.npc_id = ? AND si.item_id = ?
      `, [npcId, itemId]);
      
      if (!shopItem || shopItem.length === 0) {
        socket.emit('error', 'Item not available in this shop');
        return;
      }
      
      const item = shopItem[0];
      const totalCost = item.price * quantity;
      
      // Check if player has enough gold (we'll assume they have a gold field, for now just allow)
      // TODO: Add gold system
      
      // Check stock
      if (item.stock < quantity) {
        socket.emit('error', 'Not enough items in stock');
        return;
      }

      if (item.stackable) {
        // For stackable items, check if player already has this item
        const [existingRows] = await db.promise().query(
          'SELECT id, quantity FROM player_inventory WHERE character_id = ? AND item_id = ?',
          [socket.characterId, itemId]
        );

        if (existingRows.length > 0) {
          // Increase quantity
          await db.promise().query(
            'UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?',
            [quantity, existingRows[0].id]
          );
        } else {
          // Add new item to tab 1
          await db.promise().query(
            'INSERT INTO player_inventory (character_id, item_id, tab_id, quantity) VALUES (?, ?, 1, ?)',
            [socket.characterId, itemId, quantity]
          );
        }
      } else {
        // For non-stackable items, add each one as separate entries
        for (let i = 0; i < quantity; i++) {
          await db.promise().query(
            'INSERT INTO player_inventory (character_id, item_id, tab_id, quantity) VALUES (?, ?, 1, 1)',
            [socket.characterId, itemId]
          );
        }
      }
      
      // Update shop stock
      await db.promise().query(`
        UPDATE shop_items SET quantity = quantity - ? WHERE npc_id = ? AND item_id = ?
      `, [quantity, npcId, itemId]);
      
      socket.emit('itemPurchased', { itemId, quantity, itemName: item.name });
      
      // Send updated inventory to client
      const [inventory] = await db.promise().query(`
        SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
        FROM player_inventory pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.character_id = ?
        ORDER BY pi.tab_id
      `, [socket.characterId]);
      
      socket.emit('inventoryUpdate', inventory);
      
    } catch (error) {
      console.error('Error buying item:', error);
      socket.emit('error', 'Failed to purchase item');
    }
  });

  socket.on('getInventory', async () => {
    if (!socket.characterId) return;
    
    try {
      const [inventory] = await db.promise().query(`
        SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
        FROM player_inventory pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.character_id = ?
        ORDER BY pi.tab_id
      `, [socket.characterId]);
      
      socket.emit('inventoryUpdate', inventory);
    } catch (error) {
      console.error('Error getting inventory:', error);
      socket.emit('error', 'Failed to load inventory');
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
      const [inventory] = await db.promise().query(`
        SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
        FROM player_inventory pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.character_id = ?
        ORDER BY pi.tab_id
      `, [socket.characterId]);
      
      socket.emit('inventoryUpdate', inventory);
      
    } catch (error) {
      console.error('Error moving item to tab:', error);
      socket.emit('error', 'Failed to move item');
    }
  });

  socket.on('moveItem', async (data) => {
    const { inventoryId, toTab } = data;
    if (!socket.characterId) return;

    try {
      // Move item to new tab
      await db.promise().query(
        'UPDATE player_inventory SET tab_id = ? WHERE id = ? AND character_id = ?',
        [toTab, inventoryId, socket.characterId]
      );

      // Send updated inventory to client
      const [inventory] = await db.promise().query(`
        SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
        FROM player_inventory pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.character_id = ?
        ORDER BY pi.tab_id
      `, [socket.characterId]);
      
      socket.emit('inventoryUpdate', inventory);
      
    } catch (error) {
      console.error('Error moving item:', error);
      socket.emit('error', 'Failed to move item');
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
      const [inventory] = await db.promise().query(`
        SELECT pi.*, i.name, i.description, i.type, i.rarity, i.value, i.level_requirement, i.stackable
        FROM player_inventory pi
        JOIN items i ON pi.item_id = i.id
        WHERE pi.character_id = ?
        ORDER BY pi.tab_id
      `, [socket.characterId]);
      
      socket.emit('inventoryUpdate', inventory);
      
    } catch (error) {
      console.error('Error dropping item:', error);
      socket.emit('error', 'Failed to drop item');
    }
  });

  socket.on('zoomChanged', (newZoom) => {
    if (!players[socket.id]) return;
    const player = players[socket.id];
    player.zoom = newZoom;
    // Update visibility based on new zoom
    const viewDistance = getViewDistance(newZoom);
    const currentVisible = new Set(getVisibleNPCs(player.position, viewDistance).map(npc => npc.id));
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
        db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [socket.characterId, player.position.x, player.position.y]);
        db.query('UPDATE characters SET current_health = ?, current_mana = ?, current_stamina = ? WHERE id = ?', [Math.round(player.character.current_health), Math.round(player.character.current_mana), Math.round(player.character.current_stamina), socket.characterId]);
        redisClient.del(`player:${socket.characterId}`);
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

// Global update loop
setInterval(() => {
  Object.keys(players).forEach(socketId => {
    const player = players[socketId];

    let isIdle = Object.keys(player.moving).length === 0;
    let isWalking = !isIdle && !player.moving['shift'];
    let isRunning = player.moving['shift'] && player.character.current_stamina > 0;

    // Regen health
    if (player.character.current_health < player.character.max_health) {
      player.character.current_health = Math.min(player.character.max_health, player.character.current_health + 0.005);
    }

    // Regen mana
    if (player.character.current_mana < player.character.max_mana) {
      player.character.current_mana = Math.min(player.character.max_mana, player.character.current_mana + 0.005);
    }

    // Regen stamina
    if (isIdle) {
      if (player.character.current_stamina < player.character.max_stamina) {
        player.character.current_stamina = Math.min(player.character.max_stamina, player.character.current_stamina + 0.04);
      }
    } else if (isWalking) {
      if (player.character.current_stamina < player.character.max_stamina) {
        player.character.current_stamina = Math.min(player.character.max_stamina, player.character.current_stamina + 0.02);
      }
    }

    // Health DB update
    if (Date.now() - player.lastHealthDbUpdate > 1000) {
      player.lastHealthDbUpdate = Date.now();
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('healthUpdate', { current: player.character.current_health, max: player.character.max_health, regen: 0.25 });
    }

    // Mana DB update
    if (Date.now() - player.lastManaDbUpdate > 1000) {
      player.lastManaDbUpdate = Date.now();
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('manaUpdate', { current: player.character.current_mana, max: player.character.max_mana, regen: 0.25 });
    }

    // Stamina DB update
    if (Date.now() - player.lastStaminaDbUpdate > 1000) {
      player.lastStaminaDbUpdate = Date.now();
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        let regenRate;
        if (isIdle) regenRate = 2.0;
        else if (isWalking) regenRate = 1.0;
        else regenRate = -1.0;
        socket.emit('staminaUpdate', { current: player.character.current_stamina, max: player.character.max_stamina, regen: regenRate });
      }
    }

    // Update Redis with current state
    redisClient.set(`player:${player.character.id}`, JSON.stringify(player));

    if (!player.moving || Object.keys(player.moving).length === 0) return;

    let isSprintingMoving = player.moving['shift'] && player.character.current_stamina > 0;
    let speed = BASE_SPEED;
    if (isSprintingMoving) speed *= SPRINT_MULTIPLIER;

    let dx = 0, dy = 0;
    if (player.moving['w']) dy -= speed;
    if (player.moving['s']) dy += speed;
    if (player.moving['a']) dx -= speed;
    if (player.moving['d']) dx += speed;

    if (dx === 0 && dy === 0) return;

    const newPos = { x: player.position.x + dx, y: player.position.y + dy };

    // Clamp
    newPos.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, newPos.x));
    newPos.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, newPos.y));

    // Update
    player.position = newPos;
    player.lastPos = { ...newPos };
    player.lastTime = Date.now();

    // Update stamina
    if (isSprintingMoving) {
      player.character.current_stamina = Math.max(0, player.character.current_stamina - 0.02);
    }

    // Broadcast
    io.emit('playerMoved', { id: socketId, position: newPos });
    // Send to player
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.emit('moved', newPos);
    // Update Redis
    redisClient.set(`player:${player.character.id}`, JSON.stringify(player));

    // Check NPC visibility changes
    const viewDistance = getViewDistance(player.zoom);
    const currentVisible = new Set(getVisibleNPCs(newPos, viewDistance).map(npc => npc.id));
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
}, 20); // 20ms for smooth movement

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
        npc.position.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, newX));
        npc.position.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, newY));
        // Broadcast NPC movement to players who can see it
        Object.keys(players).forEach(socketId => {
          const player = players[socketId];
          const viewDistance = getViewDistance(player.zoom);
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
}, 1000); // Update NPCs every second

// Global update loop

// Session validation endpoint
app.post('/api/validate-session', (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ valid: false });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.json({ valid: false });
    }
    const isValid = await isSessionValid(decoded.sessionId);
    res.json({ valid: isValid });
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
        
        // Use transaction for atomic updates
        db.getConnection((err, connection) => {
          if (err) {
            console.error('Error getting DB connection for sync:', err);
            return;
          }
          connection.beginTransaction((err) => {
            if (err) {
              console.error('Error starting transaction:', err);
              connection.release();
              return;
            }
            connection.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [characterId, player.position.x, player.position.y], (err) => {
              if (err) {
                console.error('Error updating position:', err);
                return connection.rollback(() => connection.release());
              }
              connection.query('UPDATE characters SET current_health = ?, current_mana = ?, current_stamina = ? WHERE id = ?', [Math.round(player.character.current_health), Math.round(player.character.current_mana), Math.round(player.character.current_stamina), characterId], (err) => {
                if (err) {
                  console.error('Error updating stats:', err);
                  return connection.rollback(() => connection.release());
                }
                connection.commit((err) => {
                  if (err) {
                    console.error('Error committing transaction:', err);
                    return connection.rollback(() => connection.release());
                  }
                  connection.release();
                });
              });
            });
          });
        });
      }
    }
  } catch (err) {
    console.error('Error in periodic sync:', err);
  }
}, 10000); // every 10 seconds

// Start server
server.listen(PORT, () => {
  console.log(`RegnumMMO AIO server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
});