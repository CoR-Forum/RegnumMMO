# Docker Setup for Regnum Online Map Tile Generation

This guide explains how to use Docker to generate map tiles for the Regnum Online Interactive Map project, eliminating the need to install GDAL and Python dependencies on your local machine.

## 🐳 Quick Start

### Prerequisites
- Docker installed on your system
- Docker Compose (included with Docker Desktop)
- Source map image named `source-map.png` in the project root
- ImageMagick (for image resizing)

### Image Preparation

Before generating tiles, you may need to resize your source map to the correct dimensions:

1. **Install ImageMagick:**
   ```bash
   brew install imagemagick
   ```

2. **Resize map to standard resolution (6157x6192):**
   ```bash
   magick map-2025.png -resize 6157x6192 map-2025-6157x6192.png
   ```

3. **Or resize to high resolution (12314x12384):**
   ```bash
   magick map-2025.png -resize 12314x12384 map-2025-2x.png
   ```

   > ⚠️ **When to use high quality scaling:**
   > 
   > If you care about preserving details (e.g., maps, designs, or print-quality graphics), use ImageMagick with the Lanczos filter instead of basic resizing.
   > 
   > The `-filter Lanczos` option gives crisp edges and better texture preservation, which is essential for map quality.

### Simple Usage

1. **Generate tiles with one command:**
   ```bash
   ./docker-run.sh run
   ```

2. **That's it!** The script will:
   - Build the Docker image (if needed)
   - Run tile generation inside the container
   - Save generated tiles to the `./tiles` directory

## 📋 Available Commands

The `docker-run.sh` script provides several convenient commands:

```bash
./docker-run.sh build     # Build the Docker image
./docker-run.sh run       # Generate tiles (builds if needed)
./docker-run.sh shell     # Open interactive shell in container
./docker-run.sh clean     # Remove Docker image and tiles
./docker-run.sh help      # Show help message
```

## 🛠️ Manual Docker Commands

If you prefer using Docker commands directly:

### Build the image:
```bash
docker build -t regnum-tile-generator .
```

### Run tile generation:
```bash
docker-compose up
```

### Interactive shell for debugging:
```bash
docker-compose run --rm tile-generator bash
```

## 📁 File Structure

The Docker setup includes these files:

- `Dockerfile` - Docker image definition with GDAL and Python
- `docker-compose.yml` - Docker Compose configuration
- `docker-run.sh` - Convenient wrapper script
- `.dockerignore` - Optimizes Docker build process

## 🔧 Technical Details

### Docker Environment
- **Base Image:** Ubuntu 22.04
- **Python:** Python 3 with GDAL bindings
- **GDAL:** Latest version with full raster processing support
- **Memory:** Optimized for large image processing

### Volume Mounts
- `./source-map.png` → `/app/source-map.png` (read-only)
- `./tiles` → `/app/tiles` (read-write for output)
- Scripts are mounted as read-only volumes

### Environment Variables
- `GDAL_ALLOW_LARGE_LIBJPEG_MEM_ALLOC=1` - Enable large JPEG processing
- `GDAL_CACHEMAX=512` - Set GDAL memory cache

## 🚀 Performance Optimization

The Docker setup is optimized for:
- **Fast builds** - Uses layer caching and .dockerignore
- **Memory efficiency** - Proper GDAL memory settings
- **Clean separation** - Host files remain unchanged
- **Easy debugging** - Interactive shell access

## 🏗️ Generated Output

After successful tile generation:
- Tiles are saved to `./tiles` directory
- Zoom levels 0-9 are generated (10 total levels)
- Significantly more tile files are created for detailed zooming
- `tilemapresource.xml` contains tile metadata

## 🔍 Troubleshooting

### Common Issues:

1. **Missing source-map.png:**
   ```
   Error: source-map.png not found!
   ```
   **Solution:** Ensure `source-map.png` exists in the project root

2. **Docker not running:**
   ```
   Cannot connect to Docker daemon
   ```
   **Solution:** Start Docker Desktop or Docker service

3. **Permission issues:**
   ```bash
   chmod +x docker-run.sh  # Make script executable
   ```

4. **Memory issues with large images:**
   - The Docker container is configured for large image processing
   - Increase Docker Desktop memory limit if needed

### Debug Mode:
```bash
./docker-run.sh shell  # Opens interactive container shell
```

## 🧹 Cleanup

Remove all Docker resources and generated tiles:
```bash
./docker-run.sh clean
```

This will:
- Stop and remove containers
- Remove the Docker image
- Optionally remove generated tiles (with confirmation)

## 📊 Performance Comparison

| Method | Setup Time | Reliability | Platform Support |
|--------|------------|-------------|------------------|
| Native | 10-30 min | Medium | Linux/macOS |
| Docker | 2-5 min | High | All platforms |

Docker provides consistent results across all platforms and eliminates dependency conflicts.

## 🤝 Contributing

When contributing tile generation improvements:
1. Test changes with `./docker-run.sh shell`
2. Update this documentation if needed
3. Ensure Docker builds successfully on clean systems

---

The Docker setup ensures consistent, reliable tile generation across all development environments while keeping your local system clean.