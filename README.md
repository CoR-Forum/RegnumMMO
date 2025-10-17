# Regnum MMORPG

A browser-based MMORPG built on the Regnum Online map.

## Features

- Interactive map based on Regnum Online world
- Node.js backend with Express
- MySQL database integration
- Docker containerization
- Real-time multiplayer support (planned)

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your database credentials
3. Run with Docker Compose:

```bash
docker-compose up --build
```

Or run locally:

```bash
npm install
npm start
```

## Development

```bash
npm run dev  # with nodemon
```

## API Endpoints

- `GET /` - Serve the map interface
- `GET /api/health` - Health check
- `GET /api/players` - Get all players (example)

## Database Schema

Create these tables in your MySQL database:

```sql
CREATE TABLE players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## License

MIT