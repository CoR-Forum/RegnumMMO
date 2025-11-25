# Regnum.Online AI Coding Agent Instructions

## Project Overview
Browser-based MMORPG with real-time multiplayer, Socket.IO, Leaflet.js map system, and external authentication via CoR-Forum.de API. Tech stack: Node.js/Express backend, vanilla JavaScript frontend, MariaDB/Redis data layer.

## Architecture Patterns

### State Management (Critical)
- **Dual-layer caching**: Active player data in Redis (fast access), periodic 10s sync to MySQL (persistence)
- **Disconnection**: Immediate Redis→MySQL flush on disconnect, no data loss
- **State updates**: Use `PlayerStateManager` for regeneration, movement, and visibility calculations
- Player state structure: `{ character: {...}, position: {x,y}, moving: {}, visibleNPCs: Set }`

### Coordinate System (Map-Critical)
- **Game coordinates**: 6144×6144 (stored in DB, used server-side)
- **Display coordinates**: 18432×18432 pixels (client-side only)
- **Scale factor**: Always 3.0 (display / game)
- **Transform helper**: `toLatLng([gameX, gameY])` converts to Leaflet coordinates
- **DO NOT** hardcode zoom values in `rastercoords.js` - use `this.zoomLevel()` for coordinate transformation

### Real-Time Architecture
- **Movement loop**: 20ms server tick for smooth updates (50 FPS)
- **NPC AI loop**: 1000ms for roaming behavior (1 FPS, performance optimized)
- **Socket.IO events**: Client→Server (`keyDown`, `keyUp`, `interactNPC`), Server→Client (`playerMoved`, `npcs`, `inventoryUpdate`)
- **Broadcast pattern**: `io.emit()` for all players, `socket.emit()` for individual player

### Modular Organization
- **`utils/`**: Reusable database queries (`database.js`), auth logic (`auth.js`), NPC handlers (`npc.js`)
- **`managers/`**: Game system managers - `PlayerStateManager` (stats/movement), `ErrorHandler` (centralized error handling)
- **`constants.js`**: Single source of truth for speeds, regen rates, distances, intervals
- **`data/gameData.js`**: All static game data (realms, races, NPCs, items, shops)

## Key Development Workflows

### Running Locally
```bash
# Full stack with Docker (preferred)
docker-compose up --build

# Local dev (requires local MySQL/Redis)
npm run dev  # Uses nodemon for auto-reload
```

**Port mapping**: 3223 (game), 8080 (phpMyAdmin), 6379 (Redis), 3306 (MariaDB)

### Database Changes
- Modify `init.sql` for schema changes (runs on first container start only)
- Use `syncNPCsFromGameData()` (called on server start) to sync NPCs from `data/gameData.js`
- Item/shop imports: `importExampleItems()` and `importShopItems()` auto-run on startup

### Map Tile Generation
```bash
cd MapGenerator
python3 assemble-original-map.py  # Assembles 322 original tiles → 18432×18432 PNG
./generate-tiles.sh               # Generates ~110,000 Leaflet tiles (zoom 0-9)
```
**Critical**: Source map MUST be 18432×18432 to maintain 3.0 scale factor

## Project-Specific Conventions

### Constants Usage
Always import and use `GAME_CONFIG` from `constants.js`:
```javascript
const GAME_CONFIG = require('./constants');
// Use: GAME_CONFIG.MOVEMENT.BASE_SPEED, GAME_CONFIG.VISION.VIEW_DISTANCE
```

### Database Utilities Pattern
Don't write raw SQL in `server.js`. Extract to `utils/database.js`:
```javascript
// ✓ Correct
const { getPlayerInventory } = require('./utils/database');
const inventory = await getPlayerInventory(characterId, db);

// ✗ Wrong
const [inventory] = await db.promise().query('SELECT * FROM...');
```

### NPC Interaction Pattern
All NPC logic in `utils/npc.js`:
- `handleNPCInteraction(npc, player, socket)` - Returns dialogue/buttons
- `getVisibleNPCs(npcs, position, viewDistance)` - Visibility culling
- `isNearMerchant(player, npc)` - Distance validation

### Error Handling
Use `ErrorHandler.sendError(socket, message, error)` for consistent client error messages.

### Authentication Flow
1. Client calls `/api/login` with CoR-Forum credentials
2. Server validates against external API
3. JWT token issued with `sessionId` + `userId`
4. Token stored in localStorage (client), session in MySQL
5. WebSocket auth: `validateTokenAndSession(token)` before allowing `join` event

## Admin vs Normal User Permissions
- **Admin** (`is_admin=true` in DB): Full map control, all zoom levels (1-9), panning enabled
- **Normal users**: Locked to player position, zoom 7-9 only, no panning
- Check: `const isAdmin = user && user.isAdmin`

## Common Pitfalls

1. **Coordinate mismatch**: Always store game coords (6144 range) in DB, transform to display coords (18432 range) only on client
2. **Redis sync**: Don't forget `await syncPlayerToDB()` on disconnect - data loss risk
3. **NPC visibility**: Recalculate `visibleNPCs` on zoom change (not just movement) - affects view distance
4. **Stamina drain**: Check `player.moving['shift']` AND `current_stamina > 0` for sprint validation
5. **Shop transactions**: Validate NPC distance with `isNearMerchant()` before buy/sell
6. **One connection per user**: Enforce with `oneConnectionPerUser` map in `server.js`

## Testing Multiplayer Features
- Open multiple browser windows/incognito tabs
- Use different CoR-Forum accounts (or modify auth check temporarily)
- Monitor Redis with `docker-compose exec redis redis-cli` → `KEYS player:*`
- Check MySQL sync: `SELECT * FROM positions WHERE character_id=X`

## Deployment
GitHub Actions auto-deploys on `main` branch push:
1. Rsync to production server (168.119.196.69)
2. `docker-compose down && docker-compose up --build -d`
3. Zero-downtime not implemented - brief service interruption

## File Organization Rules
- Frontend code: `scripts/app.js` (1,900+ lines), `index.html`, `styles.css`
- Backend entry: `server.js` (1,100+ lines) - consider splitting into routes/controllers if adding major features
- Static assets: `assets/tiles/`, `assets/npc_images/`
- Data files: `data/gameData.js`, `data/regions.js`, `data/markers.js`

## External Dependencies
- **CoR-Forum API**: `https://cor-forum.de/api/...` for authentication (external service)
- **Leaflet.js**: 1.9.4 with custom `RasterCoords` plugin for coordinate transformation
- **Socket.IO**: 4.7.4 for bidirectional real-time events

## When Adding Features
1. Update `constants.js` if introducing new configurable values
2. Add Socket.IO events to both client (`scripts/app.js`) and server (`server.js`)
3. Update `data/gameData.js` for new NPCs/items/shops
4. Use `multi_replace_string_in_file` for coordinated client/server changes
5. Test with multiple connected clients to verify broadcast behavior
