# Regnum MMORPG

A browser-based MMORPG inspired by the Regnum Online map, designed for immersive real-time multiplayer gameplay.

## Features

- **Interactive Map**: Explore the world of Regnum Online through an interactive browser-based map.
- **Node.js Backend**: Powered by Express for efficient server-side operations.
- **MySQL Integration**: Robust database support for player data and game state.
- **Dockerized Deployment**: Simplified setup and deployment using Docker Compose.
- **Real-Time Multiplayer**: Planned feature for engaging player interactions.

## Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [Docker](https://www.docker.com/)
- [MySQL](https://www.mysql.com/)

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/CoR-Forum/RegnumMMO.git
   cd RegnumMMO
   ```

2. **Environment Configuration**:
   Copy the example environment file and update it with your database credentials:
   ```bash
   cp .env.example .env
   ```

3. **Run the Application**:
   - Using Docker Compose:
     ```bash
     docker-compose up --build
     ```
   - Running Locally:
     ```bash
     npm install
     npm start
     ```

### Development Mode

For development, use the following command to enable live reloading with `nodemon`:
```bash
npm run dev
```

## API Endpoints

- `GET /` - Serves the interactive map interface.
- `GET /api/health` - Health check endpoint.
- `GET /api/players` - Retrieve all player data (example endpoint).

## Database Schema

Ensure your MySQL database includes the following schema:

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

## Contributing

We welcome contributions! To get started:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

## Roadmap

- [ ] Implement real-time multiplayer functionality.
- [ ] Enhance map interactivity with additional layers and markers.
- [ ] Add user authentication and session management.
- [ ] Optimize performance for large-scale player interactions.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

*Regnum MMORPG: Bringing the world of Regnum Online to your browser.*