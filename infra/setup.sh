#!/bin/bash
set -e

echo "🚀 Setting up DriveSuite on WSL2..."

# Create media directory structure
MEDIA_HOME="${HOME}/media"
mkdir -p "$MEDIA_HOME"/{videos,tv,movies,music,downloads,photos,books,chroma-data,immich-db}

echo "✅ Media directories created at $MEDIA_HOME"

# Check if Docker is running
if ! sudo docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Start Docker daemon with: sudo systemctl start docker"
    exit 1
fi

echo "✅ Docker is running"

# Start services
echo "📦 Starting services with Docker Compose..."
sudo /usr/local/bin/docker-compose up -d

echo ""
echo "✅ Services started! Waiting for them to be ready (30 seconds)..."
sleep 30

echo ""
echo "🎉 Setup complete! Here are the service URLs:"
echo ""
echo "Media & Library:"
echo "  📺 Jellyfin:       http://localhost:8096"
echo "  📷 Immich:         http://localhost:2283"
echo "  📚 Calibre-Web:    http://localhost:8083"
echo ""
echo "arr Stack Management:"
echo "  🔍 Prowlarr:       http://localhost:9696"
echo "  📺 Sonarr (TV):    http://localhost:8989"
echo "  🎬 Radarr (Movies):http://localhost:7878"
echo "  🎵 Lidarr (Music): http://localhost:8686"
echo "  🌐 qBittorrent:    http://localhost:8080"
echo ""
echo "Other:"
echo "  🔗 ChromaDB (RAG): http://localhost:8000"
echo ""
echo "Next steps:"
echo "1. Configure .env file with your credentials:"
echo "   - Meta WhatsApp API keys"
echo "   - Arr stack API keys (get from each service's settings)"
echo "   - Ollama and Anthropic API keys"
echo ""
echo "2. Start the Node.js bridge:"
echo "   cd ../bridge && npm install && npm start"
echo ""
echo "3. Get arr stack API keys from:"
echo "   - Sonarr:  Settings → General → API Key"
echo "   - Radarr:  Settings → General → API Key"
echo "   - Lidarr:  Settings → General → API Key"
echo "   - Prowlarr: Settings → General → API Key"
echo ""
