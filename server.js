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

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ENABLE_DUMMIES = process.env.ENABLE_DUMMIES || 'false';

// Constants
const BASE_SPEED = 0.3;
const SPRINT_MULTIPLIER = 20;
const MAP_BOUNDS = { minX: 0, maxX: 6157, minY: 0, maxY: 6192 };
const DEFAULT_POS = { x: 3078, y: 3096 };

// Dummy players
const NUM_DUMMIES = 10;
const dummyPlayers = {};

function createDummyPlayers() {
  for (let i = 1; i <= NUM_DUMMIES; i++) {
    const id = `npc-${i}`;
    const position = {
      x: Math.random() * (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) + MAP_BOUNDS.minX,
      y: Math.random() * (MAP_BOUNDS.maxY - MAP_BOUNDS.minY) + MAP_BOUNDS.minY
    };
    const character = {
      name: `NPC ${i}`,
      level: 1,
      race: 'Human',
      class: 'Warrior',
      current_health: 100,
      max_health: 100,
      current_mana: 100,
      max_mana: 100,
      current_stamina: 100,
      max_stamina: 100
    };
    dummyPlayers[id] = {
      character,
      position,
      direction: Math.random() * 2 * Math.PI, // Random angle in radians
      lastDirectionChange: Date.now()
    };
  }
}

// Helper function for errors
const sendError = (res, msg, code = 500) => res.status(code).json({ error: msg });

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
function initDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      forum_userID INT UNIQUE,
      username VARCHAR(255) UNIQUE,
      email VARCHAR(255)
    )`,
    `CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
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
    )`,
    `CREATE TABLE IF NOT EXISTS positions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT UNIQUE,
      x FLOAT DEFAULT 3078,
      y FLOAT DEFAULT 3096,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )`,

  ];
  tables.forEach(query => db.query(query));
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

// Game data
const gameData = {
  realms: ['Syrtis', 'Ignis', 'Alsius'],
  races: {
    'Syrtis': ['Wood Elf', 'Alturian', 'Half Elf', 'Lamai'],
    'Ignis': ['Dark Elf', 'Esquelio', 'Molok', 'Lamai'],
    'Alsius': ['Dwarf', 'Nordo', 'Utghar', 'Lamai']
  },
  classes: {
    'Wood Elf': ['Archer', 'Mage'],
    'Alturian': ['Archer', 'Mage', 'Warrior'],
    'Half Elf': ['Archer', 'Warrior'],
    'Lamai': ['Archer', 'Mage', 'Warrior'],
    'Dark Elf': ['Mage', 'Warrior'],
    'Esquelio': ['Archer', 'Mage', 'Warrior'],
    'Molok': ['Archer', 'Warrior'],
    'Dwarf': ['Archer', 'Warrior'],
    'Nordo': ['Archer', 'Mage', 'Warrior'],
    'Utghar': ['Mage', 'Warrior']
  },
  startingAttributes: {
    'Wood Elf Archer': { conc: 12, const: 10, dex: 15, int: 13, str: 10 },
    'Wood Elf Mage': { conc: 10, const: 8, dex: 12, int: 16, str: 9 },
    'Alturian Archer': { conc: 11, const: 12, dex: 14, int: 11, str: 12 },
    'Alturian Mage': { conc: 9, const: 10, dex: 10, int: 15, str: 11 },
    'Alturian Warrior': { conc: 8, const: 14, dex: 9, int: 8, str: 16 },
    'Half Elf Archer': { conc: 10, const: 11, dex: 15, int: 10, str: 14 },
    'Half Elf Warrior': { conc: 9, const: 13, dex: 10, int: 9, str: 15 },
    'Lamai Archer': { conc: 11, const: 11, dex: 14, int: 12, str: 12 },
    'Lamai Mage': { conc: 10, const: 9, dex: 11, int: 15, str: 10 },
    'Lamai Warrior': { conc: 8, const: 13, dex: 9, int: 9, str: 16 },
    'Dark Elf Mage': { conc: 9, const: 8, dex: 11, int: 16, str: 11 },
    'Dark Elf Warrior': { conc: 8, const: 12, dex: 10, int: 9, str: 16 },
    'Esquelio Archer': { conc: 11, const: 10, dex: 15, int: 11, str: 13 },
    'Esquelio Mage': { conc: 9, const: 9, dex: 12, int: 15, str: 10 },
    'Esquelio Warrior': { conc: 8, const: 12, dex: 10, int: 8, str: 17 },
    'Molok Archer': { conc: 10, const: 12, dex: 14, int: 10, str: 14 },
    'Molok Warrior': { conc: 9, const: 14, dex: 9, int: 8, str: 15 },
    'Dwarf Archer': { conc: 10, const: 13, dex: 12, int: 9, str: 16 },
    'Dwarf Warrior': { conc: 8, const: 15, dex: 8, int: 7, str: 17 },
    'Nordo Archer': { conc: 11, const: 11, dex: 14, int: 11, str: 13 },
    'Nordo Mage': { conc: 9, const: 10, dex: 11, int: 15, str: 10 },
    'Nordo Warrior': { conc: 8, const: 13, dex: 9, int: 8, str: 17 },
    'Utghar Mage': { conc: 9, const: 9, dex: 10, int: 16, str: 11 },
    'Utghar Warrior': { conc: 8, const: 13, dex: 9, int: 8, str: 17 }
  }
};

// Connect to database
initDatabase();
if (ENABLE_DUMMIES) createDummyPlayers();

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
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Regnum MMORPG server is running' }));

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
      const position = posResults[0] || DEFAULT_POS;
      players[socket.id] = { character, position, lastPos: { ...position }, lastTime: Date.now(), lastDbUpdate: Date.now(), lastStaminaDbUpdate: Date.now(), lastHealthDbUpdate: Date.now(), lastManaDbUpdate: Date.now(), moving: {} };
      socket.characterId = characterId;
      socket.emit('joined', { character, position, speed: BASE_SPEED, healthRegen: 0.25, manaRegen: 0.25, staminaRegen: 2.0 });
      // Broadcast to others
      socket.broadcast.emit('playerJoined', { id: socket.id, character, position });
      // Send existing players to this player
      const allPlayers = ENABLE_DUMMIES ? { ...players, ...dummyPlayers } : players;
      const existingPlayers = Object.keys(allPlayers).filter(id => id !== socket.id).map(id => ({ id, ...allPlayers[id] }));
      socket.emit('existingPlayers', existingPlayers);
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

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      // Save final position and stamina to DB
      const player = players[socket.id];
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [socket.characterId, player.position.x, player.position.y]);
      db.query('UPDATE characters SET current_health = ?, current_mana = ?, current_stamina = ? WHERE id = ?', [Math.round(player.character.current_health), Math.round(player.character.current_mana), Math.round(player.character.current_stamina), socket.characterId]);
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
      db.query('UPDATE characters SET current_health = ? WHERE id = ?', [Math.round(player.character.current_health), player.character.id]);
      player.lastHealthDbUpdate = Date.now();
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('healthUpdate', { current: player.character.current_health, max: player.character.max_health, regen: 0.25 });
    }

    // Mana DB update
    if (Date.now() - player.lastManaDbUpdate > 1000) {
      db.query('UPDATE characters SET current_mana = ? WHERE id = ?', [Math.round(player.character.current_mana), player.character.id]);
      player.lastManaDbUpdate = Date.now();
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('manaUpdate', { current: player.character.current_mana, max: player.character.max_mana, regen: 0.25 });
    }

    // Stamina DB update
    if (Date.now() - player.lastStaminaDbUpdate > 1000) {
      db.query('UPDATE characters SET current_stamina = ? WHERE id = ?', [Math.round(player.character.current_stamina), player.character.id]);
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

    // DB update
    if (Date.now() - player.lastDbUpdate > 1000) {
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [player.character.id, newPos.x, newPos.y]);
      player.lastDbUpdate = Date.now();
    }

    // Broadcast
    io.emit('playerMoved', { id: socketId, position: newPos });
    // Send to player
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.emit('moved', newPos);
  });

  // Handle dummy players
  if (ENABLE_DUMMIES) {
    Object.keys(dummyPlayers).forEach(id => {
      const dummy = dummyPlayers[id];
      // Change direction every 5 seconds
      if (Date.now() - dummy.lastDirectionChange > 5000) {
        dummy.direction = Math.random() * 2 * Math.PI;
        dummy.lastDirectionChange = Date.now();
      }
      // Move
      const speed = BASE_SPEED;
      const dx = Math.cos(dummy.direction) * speed;
      const dy = Math.sin(dummy.direction) * speed;
      const newPos = { x: dummy.position.x + dx, y: dummy.position.y + dy };
      // Clamp
      newPos.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, newPos.x));
      newPos.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, newPos.y));
      // Update
      dummy.position = newPos;
      // Broadcast
      io.emit('playerMoved', { id, position: newPos });
    });
  }
}, 20); // 20ms for smooth movement

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

// Start server
server.listen(PORT, () => {
  console.log(`RegnumMMO AIO server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
});