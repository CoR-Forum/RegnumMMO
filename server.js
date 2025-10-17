require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));
app.use(express.static(path.join(__dirname)));

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

// Function to initialize database
function initDatabase() {
  const createUsersTable = `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    forum_userID INT UNIQUE,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255)
  )`;
  const createPlayersTable = `CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`;
  const createCharactersTable = `CREATE TABLE IF NOT EXISTS characters (
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
  )`;
  const createPositionsTable = `CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT UNIQUE,
    x FLOAT DEFAULT 3063,
    y FLOAT DEFAULT 3095,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  )`;
  const createMessagesTable = `CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_character_id INT,
    to_user_id INT NULL,
    type ENUM('global', 'realm', 'pm'),
    message TEXT,
    realm VARCHAR(255) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_character_id) REFERENCES characters(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  )`;
  db.query(createUsersTable);
  db.query(createPlayersTable);
  db.query(createCharactersTable);
  db.query(createPositionsTable);
  db.query(createMessagesTable);
  // Add columns if needed, but since recreated, not necessary
}

// Connect to database
console.log('Initializing MySQL connection pool...');
initDatabase();

// Login function
async function handleLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password are required.' });

  try {
    const response = await fetch('https://cor-forum.de/api.php/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key': 'nu8ojahvuTuekae4veegahsoo9too4Yuashodee7chus2thio9doh4zisa4k'
      },
      body: new URLSearchParams({ username, password })
    });

    const data = await response.json();

    if (!data.success) return res.status(401).json(data);

    const { userID, username: uname, email } = data;
    db.query('INSERT INTO users (forum_userID, username, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), email=VALUES(email)', [userID, uname, email], (err) => {
      if (err) return res.status(500).json({ success: false, error: `Database error: ${err.message}` });
      // Get the db id
      db.query('SELECT id FROM users WHERE forum_userID = ?', [userID], (err2, results) => {
        if (err2) return res.status(500).json({ success: false, error: `Database error: ${err2.message}` });
        const dbId = results[0].id;
        req.session.user = { id: dbId, forumUserID: userID, username: uname, email };
        const token = jwt.sign({ userId: dbId }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, userID: dbId, forumUserID: userID, username: uname, email, token });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Regnum MMORPG server is running' }));

app.get('/api/players', (req, res) => {
  db.query('SELECT * FROM players', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/characters', (req, res) => {
  const { userID } = req.query;
  if (!userID) return res.status(400).json({ error: 'userID required' });
  db.query('SELECT * FROM characters WHERE user_id = ?', [userID], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/game-data', (req, res) => {
  res.json(gameData);
});

app.post('/api/characters', (req, res) => {
  const { userID, name, realm, race, class: charClass } = req.body;
  if (!userID || !name || !realm || !race || !charClass) {
    return res.status(400).json({ error: 'All fields required' });
  }

  // Check if user has existing characters and enforce realm consistency
  db.query('SELECT realm FROM characters WHERE user_id = ?', [userID], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      const existingRealms = results.map(r => r.realm);
      if (!existingRealms.includes(realm)) {
        return res.status(400).json({ error: 'You can only create characters in the same realm as your existing characters.' });
      }
    }

    // Get starting attributes
    const key = `${race} ${charClass}`;
    const attrs = gameData.startingAttributes[key];
    if (!attrs) {
      return res.status(400).json({ error: 'Invalid race-class combination' });
    }

    const maxHealth = attrs.const * 10;
    const maxMana = attrs.int * 10;
    const maxStamina = attrs.str * 10;

    db.query('INSERT INTO characters (user_id, name, realm, race, class, level, conc, \`const\`, dex, \`int\`, str, max_health, current_health, max_mana, current_mana, max_stamina, current_stamina) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [userID, name, realm, race, charClass, attrs.conc, attrs.const, attrs.dex, attrs.int, attrs.str, maxHealth, maxHealth, maxMana, maxMana, maxStamina, maxStamina], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      // Insert default position
      db.query('INSERT INTO positions (character_id, x, y) VALUES (?, 3063, 3095)', [result.insertId], (err2) => {
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

app.get('/api/messages', (req, res) => {
  const { type, limit = 20, userId, realm } = req.query;
  let query, params;
  if (type === 'global') {
    query = 'SELECT m.id, c.name as from_name, m.message, m.type, m.timestamp FROM messages m JOIN characters c ON m.from_character_id = c.id WHERE m.type = ? ORDER BY m.timestamp DESC LIMIT ?';
    params = ['global', parseInt(limit)];
  } else if (type === 'realm') {
    if (!realm) return res.status(400).json({ error: 'realm required for realm messages' });
    query = 'SELECT m.id, c.name as from_name, m.message, m.type, m.timestamp FROM messages m JOIN characters c ON m.from_character_id = c.id WHERE m.type = ? AND m.realm = ? ORDER BY m.timestamp DESC LIMIT ?';
    params = ['realm', realm, parseInt(limit)];
  } else if (type === 'pm') {
    if (!userId) return res.status(400).json({ error: 'userId required for pm messages' });
    query = 'SELECT m.id, c.name as from_name, u.username as to_name, m.message, m.type, m.timestamp FROM messages m JOIN characters c ON m.from_character_id = c.id LEFT JOIN users u ON m.to_user_id = u.id WHERE m.type = ? AND (m.from_character_id IN (SELECT id FROM characters WHERE user_id = ?) OR m.to_user_id = ?) ORDER BY m.timestamp DESC LIMIT ?';
    params = ['pm', userId, userId, parseInt(limit)];
  } else {
    return res.status(400).json({ error: 'invalid type' });
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results.reverse()); // reverse to chronological order
  });
});

// Serve the map
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Socket.IO
const players = {}; // Store connected players: { socketId: { character, position, lastPos, lastTime } }
const userSockets = {}; // userId -> socketId, to enforce one connection per user

const MAX_SPEED = 500; // units per second
const MAP_BOUNDS = { minX: 0, maxX: 6126, minY: 0, maxY: 6190 };

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.userId = decoded.userId;
    next();
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

  socket.on('join', (characterId) => {
    // Verify character belongs to user
    db.query('SELECT * FROM characters WHERE id = ? AND user_id = ?', [characterId, socket.userId], (err, results) => {
      if (err || results.length === 0) {
        socket.emit('error', 'Invalid character');
        return;
      }
      const character = results[0];
      // Get position
      db.query('SELECT * FROM positions WHERE character_id = ?', [characterId], (err2, posResults) => {
        if (err2) {
          console.error('Position query error:', err2);
          socket.emit('error', `Position error: ${err2.message}`);
          return;
        }
        const position = posResults[0] || { x: 3063, y: 3095 };
        players[socket.id] = { character, position, lastPos: { ...position }, lastTime: Date.now() };
        socket.characterId = characterId;
        socket.emit('joined', { character, position });
        // Broadcast to others
        socket.broadcast.emit('playerJoined', { id: socket.id, character, position });
        // Send existing players to this player
        const existingPlayers = Object.keys(players).filter(id => id !== socket.id).map(id => ({ id, ...players[id] }));
        socket.emit('existingPlayers', existingPlayers);
        // Join chat rooms
        socket.join('global');
        socket.join('realm:' + character.realm);
      });
    });
  });

  socket.on('move', (newPos) => {
    if (!players[socket.id]) return;

    // Clamp position to map bounds
    newPos.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, newPos.x));
    newPos.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, newPos.y));

    const player = players[socket.id];
    const dist = Math.sqrt((newPos.x - player.lastPos.x) ** 2 + (newPos.y - player.lastPos.y) ** 2);
    const timeDiff = Date.now() - player.lastTime;
    const speed = dist / (timeDiff / 1000);

    if (speed > MAX_SPEED) {
      // Speedhack detected, teleport back
      socket.emit('teleport', player.lastPos);
      socket.emit('chatError', 'Speedhack detected! Teleported back.');
      console.log(`Speedhack detected for user ${socket.userId}: speed ${speed} > ${MAX_SPEED}`);
      return;
    }

    // Valid move
    player.position = newPos;
    player.lastPos = { ...newPos };
    player.lastTime = Date.now();

    // Update DB
    db.query('INSERT INTO positions (character_id, x, y) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)', [socket.characterId, newPos.x, newPos.y]);
    // Broadcast
    socket.broadcast.emit('playerMoved', { id: socket.id, position: newPos });
  });

  socket.on('chat', (data) => {
    const { type, message, toUserId } = data;
    if (!message || message.trim() === '') return;
    const fromName = players[socket.id].character.name;
    if (type === 'global') {
      io.to('global').emit('chat', { from: fromName, message, type: 'global' });
    } else if (type === 'realm') {
      io.to('realm:' + players[socket.id].character.realm).emit('chat', { from: fromName, message, type: 'realm' });
    } else if (type === 'pm') {
      if (!toUserId) return;
      const toSocketId = userSockets[toUserId];
      if (toSocketId) {
        io.to(toSocketId).emit('chat', { from: fromName, message, type: 'pm' });
        socket.emit('chat', { from: fromName, message, type: 'pm', to: toUserId });
      } else {
        socket.emit('chatError', 'User not online');
      }
    }
    // Store message in DB
    db.query('INSERT INTO messages (from_character_id, to_user_id, type, message, realm) VALUES (?, ?, ?, ?, ?)', [socket.characterId, type === 'pm' ? toUserId : null, type, message, type === 'realm' ? players[socket.id].character.realm : null]);
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      delete players[socket.id];
      socket.broadcast.emit('playerLeft', socket.id);
    }
    delete userSockets[socket.userId];
    console.log('User disconnected:', socket.userId);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Regnum MMORPG server running on port ${PORT}`);
  console.log(`Map available at http://localhost:${PORT}`);
});