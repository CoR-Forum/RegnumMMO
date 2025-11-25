# Regnum.Online

A fully-featured browser-based MMORPG inspired by Regnum Online, featuring real-time multiplayer gameplay, an interactive map system, character progression, NPC interactions, and a complete inventory/shop economy.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Game Systems](#game-systems)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Features

### Core Gameplay
- **Real-Time Multiplayer**: Socket.IO-powered real-time player synchronization and movement
- **Three Realms**: Syrtis (Elves), Ignis (Demons), and Alsius (Humans) with unique characteristics
- **Character System**: 9 races, 3 classes (Archer, Mage, Warrior), and multi-attribute progression
- **Movement System**: WASD controls with sprint mechanic and stamina management
- **Resource Management**: Health, Mana, and Stamina with automatic regeneration

### Interactive Map
- **6144×6144** game coordinate system with **18432×18432** pixel resolution
- **110,000+** pre-generated map tiles using Leaflet.js
- Zoom levels 1-9 with role-based restrictions
- Admin users: Full map control and panning
- Normal users: Player-centered view with limited zoom (7-9)
- Custom coordinate transformation system

### NPC System
- **18+ NPCs** across three realms with unique personalities
- Multiple NPC types: Merchants, Quest Masters, Guards, Healers, Blacksmiths
- **Roaming AI** with three movement patterns:
  - Static (stationary)
  - Wander (random movement within radius)
  - Patrol (follow predefined routes)
- Context-aware dialogue system
- Distance-based interactions

### Economy & Inventory
- **NPC merchant shops** with unique inventories
- **5-tab inventory system** with stackable and non-stackable items
- **Item rarity tiers**: Common, Uncommon, Rare, Epic, Legendary
- Gold-based economy with buy/sell mechanics
- Item types: Weapons, Armor, Consumables
- Stock management and 50% sell-back value

### Authentication
- External authentication via CoR-Forum.de API
- JWT token-based session management
- MySQL session storage with Redis caching
- Admin role system with enhanced privileges
- One connection per user enforcement

## Technology Stack

### Backend
- **Node.js 18** (Alpine Linux)
- **Express.js 4.18.2** - Web framework
- **Socket.IO 4.7.4** - Real-time bidirectional communication
- **MySQL2 3.6.5** - Database driver with promise support
- **Redis 5.9.0** - Session caching and player state management
- **JWT** - Token-based authentication
- **Express-Session** - Session management with MySQL/Redis backing

### Frontend
- **Vanilla JavaScript** (ES6+)
- **Leaflet.js 1.9.4** - Interactive map library
- **Socket.IO Client** - Real-time connection
- **Custom RasterCoords** - Coordinate transformation plugin
- **CSS3** - Modern styling

### Database
- **MariaDB 10.11** - Primary relational database
- **Redis** (Alpine) - Caching layer with AOF persistence
- **phpMyAdmin** - Database administration interface (port 8080)

### DevOps
- **Docker & Docker Compose** - Container orchestration
- **GitHub Actions** - CI/CD pipeline
- **Automated deployment** to dedicated server

### Map Generation
- **Python 3** with **GDAL** - Geospatial data processing
- **ImageMagick** - Image manipulation
- Custom tile generation pipeline

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) v18+ (for local development)
- Git

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/CoR-Forum/Regnum.Online.git
   cd Regnum.Online
   ```

2. **Environment Configuration**:
   Copy the example environment file and configure your settings:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Database
   DB_HOST=mariadb
   DB_USER=regnum_user
   DB_PASSWORD=your_password
   DB_NAME=regnum_db
   DB_PORT=3306
   DB_ROOT_PASSWORD=root_password

   # Redis
   REDIS_HOST=redis
   REDIS_PORT=6379

   # Application
   PORT=3223
   NODE_ENV=production
   JWT_SECRET=your_jwt_secret
   API_KEY=your_api_key
   ```

3. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

   The application will be available at:
   - **Game**: http://localhost:3223
   - **phpMyAdmin**: http://localhost:8080

4. **Local Development** (without Docker):
   ```bash
   npm install
   npm run dev
   ```

## Architecture

### System Architecture
```
┌─────────────┐     WebSocket      ┌──────────────┐
│   Browser   │ ←─────────────────→ │  Express.js  │
│  (Client)   │     HTTP/REST      │    Server    │
└─────────────┘                    └──────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
              ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
              │   MariaDB   │      │    Redis    │      │  CoR-Forum  │
              │  (Persist)  │      │   (Cache)   │      │   API Auth  │
              └─────────────┘      └─────────────┘      └─────────────┘
```

### Data Flow
1. User authenticates via external CoR-Forum API
2. JWT token issued and stored in localStorage
3. WebSocket connection established with token
4. Game state synchronized via Socket.IO events
5. Player state cached in Redis, periodically synced to MySQL (10s)
6. Position updates broadcast to all connected clients
7. On disconnect: immediate Redis flush to MySQL

### Key Design Patterns
- **Modular architecture** - Utilities and managers separated for maintainability
- **Event-driven architecture** - Socket.IO for real-time events
- **Manager pattern** - PlayerStateManager, ErrorHandler for game systems
- **Utility pattern** - Reusable database, auth, and NPC utilities
- **Middleware pattern** - Authentication, session validation, CORS
- **Repository pattern** - Database queries abstracted through promises
- **Observer pattern** - Socket.IO event broadcasting
- **Strategy pattern** - NPC interaction handlers

## Game Systems

### Character Creation
- **One character per realm** per account
- Realm selection determines available races
- Class selection with race-specific starting attributes
- Attribute system: Concentration, Constitution, Dexterity, Intelligence, Strength
- Starting location: Center of map (3072, 3072)
- Starting gold: 100

### Movement System
- **WASD** keyboard controls
- **Shift** for sprint (consumes stamina)
- Smooth client-side prediction
- Server-side validation and broadcasting
- 20ms game loop for responsive movement
- Collision detection (future feature)

### Resource System
| Resource | Max Value | Regen Rate | Notes |
|----------|-----------|------------|-------|
| Health   | 100       | +0.25/s    | Calculated from Constitution |
| Mana     | 100       | +0.25/s    | Calculated from Intelligence |
| Stamina  | 100       | Variable   | +2.0/s idle, +1.0/s walking, -1.0/s sprinting |

### NPC AI System
NPCs update every 1000ms with three behavior types:
- **Static**: Remain in place (guards, shopkeepers)
- **Wander**: Random movement within defined radius
- **Patrol**: Follow predefined waypoint routes

NPCs become visible/invisible based on player zoom level and distance.

### Inventory System
- **5 tabs** for organization
- **Stackable items** (consumables) vs. **unique items** (equipment)
- **Drag-and-drop** between tabs
- **Drop items** to discard
- Synchronized with database on changes

### Shop System
- NPCs can have unique shop inventories
- Items stored in `shop_items` table with quantity and pricing
- Buy at merchant price, sell at 50% value
- Stock management (limited quantities)
- Transaction validation for gold and inventory space

## API Documentation

### REST Endpoints

#### Authentication
```
POST /api/login
Body: { username, password }
Returns: { token, user }

POST /api/logout
Headers: Authorization: Bearer {token}
Returns: { success }

POST /api/validate-session
Headers: Authorization: Bearer {token}
Returns: { valid, user }
```

#### Characters
```
GET /api/characters
Headers: Authorization: Bearer {token}
Returns: [{ id, name, realm, race, class, level, ... }]

GET /api/character/:id
Headers: Authorization: Bearer {token}
Returns: { character details }

POST /api/characters
Headers: Authorization: Bearer {token}
Body: { name, realm, race, class }
Returns: { character }
```

#### Game Data
```
GET /api/health
Returns: { status, database, redis, uptime }

GET /api/game-data
Returns: { realms, races, classes, startingAttributes }
```

### WebSocket Events

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join` | `{ characterId }` | Connect character to game world |
| `keyDown` | `{ key }` | Movement key pressed |
| `keyUp` | `{ key }` | Movement key released |
| `interactNPC` | `{ npcId }` | Initiate NPC interaction |
| `getShopItems` | `{ npcId }` | Request shop inventory |
| `buyItems` | `{ npcId, itemsToBuy: [{ itemId, quantity }] }` | Purchase items |
| `sellItems` | `{ npcId, itemsToSell: [{ itemId, quantity }] }` | Sell items |
| `getInventory` | `{ characterId }` | Request inventory |
| `moveItemToTab` | `{ itemId, newTabId }` | Organize inventory |
| `dropItem` | `{ itemId, quantity }` | Discard items |
| `zoomChanged` | `{ zoomLevel }` | Update view distance |
| `ping` | - | Latency check |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `joined` | `{ player, position }` | Successful world join |
| `playerJoined` | `{ player }` | Another player joined |
| `playerLeft` | `{ playerId }` | Player disconnected |
| `existingPlayers` | `[{ player }]` | Initial player list |
| `playerMoved` | `{ playerId, x, y, isMoving, isSprinting }` | Player position update |
| `moved` | `{ x, y }` | Own position confirmation |
| `npcs` | `[{ npc }]` | NPC data in view range |
| `npcMoved` | `{ npcId, x, y }` | NPC position update |
| `npcsLeft` | `[npcId]` | NPCs left view range |
| `npcMessage` | `{ npcName, message, buttons }` | NPC dialogue |
| `shopItems` | `{ npcId, items }` | Shop inventory |
| `inventoryUpdate` | `{ inventory }` | Updated inventory |
| `goldUpdate` | `{ gold }` | Gold amount changed |
| `transactionComplete` | `{ message }` | Buy/sell confirmation |
| `healthUpdate` / `manaUpdate` / `staminaUpdate` | `{ current, max }` | Resource updates |
| `error` | `{ message }` | Error notification |
| `logout` | - | Force disconnect |

## Database Schema

### Core Tables

```sql
users
- id (PK)
- forum_userID (UNIQUE)
- username (UNIQUE)
- email
- is_admin (BOOLEAN, DEFAULT FALSE)

characters
- id (PK)
- user_id (FK → users.id)
- name
- realm (Syrtis/Ignis/Alsius)
- race
- class
- level (DEFAULT 1)
- conc, const, dex, int, str (attributes)
- max_health, current_health
- max_mana, current_mana
- max_stamina, current_stamina
- gold (DEFAULT 100)

positions
- id (PK)
- character_id (FK → characters.id, UNIQUE, CASCADE DELETE)
- x (FLOAT, DEFAULT 3072)
- y (FLOAT, DEFAULT 3072)
- date_updated (AUTO_UPDATE)

realms
- id (PK)
- name (UNIQUE)

npcs
- id (PK)
- name, realm, level, title
- x, y
- roaming_type (static/wander/patrol)
- roaming_radius, roaming_speed
- roaming_path (JSON)
- has_shop, has_quests, has_guard_duties, has_healing, has_blacksmith

items
- id (PK)
- name (UNIQUE)
- description
- type (weapon/armor/consumable)
- rarity (common/uncommon/rare/epic/legendary)
- value
- level_requirement
- stackable (BOOLEAN)

shop_items
- id (PK)
- npc_id (FK → npcs.id, CASCADE DELETE)
- item_id (FK → items.id, CASCADE DELETE)
- quantity
- price
- UNIQUE(npc_id, item_id)

player_inventory
- id (PK)
- character_id (FK → characters.id, CASCADE DELETE)
- item_id (FK → items.id, CASCADE DELETE)
- quantity (DEFAULT 1)
- tab_id (1-5)
```

Database automatically initializes on first run with:
- Table creation
- Example NPC seeding
- Item and shop inventory seeding

## Development

### Project Structure
```
Regnum.Online/
├── server.js              # Main backend server (1,017 lines)
├── constants.js           # Game configuration constants
├── utils/                 # Shared utility modules
│   ├── auth.js           # Authentication manager
│   ├── database.js       # Database utilities
│   └── npc.js            # NPC interaction handlers
├── managers/              # Game system managers
│   ├── PlayerStateManager.js  # Player state updates
│   └── ErrorHandler.js        # Error handling utilities
├── index.html             # Frontend HTML entry point
├── styles.css             # Frontend styling
├── scripts/
│   ├── app.js            # Frontend JavaScript (1,885 lines)
│   └── rastercoords.js   # Leaflet coordinate transformation
├── data/
│   └── gameData.js       # Game data (realms, races, classes, NPCs, items)
├── MapGenerator/         # Map tile generation tools
│   ├── generate-tiles.sh
│   ├── gdal2tiles.py
│   └── assemble-original-map.py
├── docker-compose.yml    # Multi-container orchestration
├── Dockerfile           # Application container
├── init.sql             # Database initialization
└── .env.example         # Environment template
```

### Development Commands

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Run in production mode
npm start

# Build Docker containers
docker-compose build

# View logs
docker-compose logs -f regnum-mmorpg

# Access database
docker-compose exec mariadb mysql -u regnum_user -p regnum_db

# Access Redis CLI
docker-compose exec redis redis-cli
```

### Map Generation

The map system converts original Regnum Online tiles into Leaflet-compatible format:

```bash
cd MapGenerator

# Assemble original 322 tiles (1024x1024) into master image (18432x18432)
python3 assemble-original-map.py

# Generate Leaflet tiles (10 zoom levels, ~110,000 tiles)
./generate-tiles.sh
```

Coordinate system:
- **Game coordinates**: 6144×6144 (used in database)
- **Display coordinates**: 18432×18432 (pixel coordinates)
- **Scale factor**: 3.0

### Performance Optimizations
- **Redis caching** for active player data
- **Periodic sync** (10s) to reduce database writes
- **View distance culling** for NPCs
- **Tile-based map rendering**
- **Client-side movement prediction**
- **20ms game loop** for smooth updates
- **1000ms NPC AI updates**

## Deployment

### Docker Compose Stack
```yaml
Services:
- redis (redis:alpine)           # Port 6379 (internal)
- mariadb (mariadb:10.11)        # Port 3306 (internal)
- phpmyadmin                     # Port 8080:80 (exposed)
- regnum-mmorpg                  # Port 3223:3223 (exposed)

Network: regnum-network (bridge)
Volumes: ./mariadb_data (persistent)
```

### CI/CD Pipeline
Automated deployment via GitHub Actions on push to `main`:
1. Checkout code
2. Rsync to production server (168.119.196.69)
3. SSH to server
4. `docker-compose down`
5. `docker-compose up --build -d`

### Production Server
- **IP**: 168.119.196.69
- **Path**: /root/docker/regnum-mapgame/
- **Ports**: 3223 (game), 8080 (phpMyAdmin)

## Contributing

We welcome contributions! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Use utility modules in `utils/` for shared functionality
- Use manager classes in `managers/` for game systems
- Centralize constants in `constants.js`
- Add comments for complex logic
- Test multiplayer interactions thoroughly
- Update documentation for new features
- Ensure Docker build succeeds
- Run `node --check` to validate syntax before committing

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Regnum.Online** - A fully-featured browser-based MMORPG bringing the world of Regnum Online to life with modern web technologies.