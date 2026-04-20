# Setup Guide — DriveSuite

## Prerequisites

- Windows 10/11 with WSL2 enabled
- Docker Desktop (with WSL2 backend) or Docker daemon running on WSL2
- Node.js 18+ in WSL2
- RTX 4070 Super (for Ollama + Llama 3.1 8B)
- Meta WhatsApp Business Account + Cloud API access
- Anthropic API key

## Phase 1: Infrastructure Setup

### 1.1 Create Media Directories

```bash
# Run from your home directory in WSL2
mkdir -p ~/media/{videos,tv,movies,music,downloads,photos,books,chroma-data,immich-db}
```

Or use the automated setup script:

```bash
cd DriveSuite/infra
chmod +x setup.sh
./setup.sh
```

### 1.2 Start Docker Services

```bash
cd DriveSuite/infra
docker compose up -d
```

**Wait 30 seconds** for services to initialize.

Check status:
```bash
docker compose ps
```

### 1.3 Verify Services are Running

- **Jellyfin**: http://localhost:8096 (video hosting)
- **Immich**: http://localhost:2283 (photos)
- **Calibre-Web**: http://localhost:8083 (books)
- **Sonarr**: http://localhost:8989 (TV series)
- **Radarr**: http://localhost:7878 (movies)
- **Lidarr**: http://localhost:8686 (music)
- **Prowlarr**: http://localhost:9696 (indexers)
- **qBittorrent**: http://localhost:8080 (downloads)

---

## Phase 2: Arr Stack Configuration

### 2.1 Get API Keys from Each Service

#### Sonarr
1. Open http://localhost:8989
2. Go to **Settings** → **General**
3. Copy **API Key**
4. Set in `.env`: `SONARR_API_KEY=<your_key>`

#### Radarr
1. Open http://localhost:7878
2. Go to **Settings** → **General**
3. Copy **API Key**
4. Set in `.env`: `RADARR_API_KEY=<your_key>`

#### Lidarr
1. Open http://localhost:8686
2. Go to **Settings** → **General**
3. Copy **API Key**
4. Set in `.env`: `LIDARR_API_KEY=<your_key>`

#### Prowlarr
1. Open http://localhost:9696
2. Go to **Settings** → **General**
3. Copy **API Key**
4. Set in `.env`: `PROWLARR_API_KEY=<your_key>`

### 2.2 Configure Download Folders

In **Sonarr**, **Radarr**, **Lidarr**:
1. Go to **Settings** → **Media Management**
2. Set root folder to `/tv`, `/movies`, `/music` respectively
3. qBittorrent will place downloads in `/downloads` — arr apps will move them to root folders

### 2.3 Add Indexers in Prowlarr

1. Go to **Indexers** → **Add Indexer**
2. Search for public indexers (e.g., YIFY, Torrentleech)
3. Add 2-3 indexers, enable them
4. Go to **Settings** → **Apps** → sync with Sonarr/Radarr/Lidarr

---

## Phase 3: Ollama Setup (Local Model)

### 3.1 Install Ollama on Windows

1. Download from https://ollama.ai
2. Run the installer
3. Ollama will run as a service on `http://localhost:11434`

### 3.2 Pull Llama 3.1 8B Model

```bash
ollama pull llama3:8b
```

This downloads ~5GB. Check progress in Ollama app.

### 3.3 Verify Ollama is Working

```bash
curl http://localhost:11434/api/tags
```

Should return JSON with `llama3:8b` in the list.

---

## Phase 4: Bridge (WhatsApp + Claude Integration)

### 4.1 Get Meta WhatsApp Credentials

1. Go to https://developers.facebook.com/
2. Create/select Business App
3. Add **WhatsApp** product
4. Get:
   - **Meta Permanent System User Token** → `META_WA_TOKEN`
   - **Phone Number ID** → `META_WA_PHONE_NUMBER_ID`
   - **Verify Token** (you set this) → `META_WEBHOOK_VERIFY_TOKEN`
   - **App Secret** → `META_APP_SECRET`

### 4.2 Configure .env

```bash
cd bridge
cp .env.example .env
```

Edit `.env`:

```env
# Meta WhatsApp
META_WA_TOKEN=your_permanent_token_here
META_WA_PHONE_NUMBER_ID=123456789
META_WEBHOOK_VERIFY_TOKEN=your_random_string_here
META_APP_SECRET=your_app_secret_here

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-opus-4-7

# WhatsApp Allowlist
ALLOWED_WHATSAPP_NUMBERS=16175551234,919876543210
ADMIN_WHATSAPP_NUMBERS=16175551234

# Arr Stack
SONARR_URL=http://localhost:8989
SONARR_API_KEY=your_sonarr_key

RADARR_URL=http://localhost:7878
RADARR_API_KEY=your_radarr_key

LIDARR_URL=http://localhost:8686
LIDARR_API_KEY=your_lidarr_key

PROWLARR_URL=http://localhost:9696
PROWLARR_API_KEY=your_prowlarr_key

# Local Model (Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Web Search
SEARXNG_URL=https://searxng.railway.app

# Server
PORT=3000
```

### 4.3 Install & Start Bridge

```bash
npm install
npm start
```

Bridge runs on `http://localhost:3000`

---

## Phase 5: Webhook Setup (WhatsApp Integration)

### 5.1 Expose Bridge to Internet

You need to make `localhost:3000` accessible to Meta's servers. Use **ngrok**:

```bash
# Download from https://ngrok.com/download
ngrok http 3000
```

This gives you a URL like: `https://abc123.ngrok.io`

### 5.2 Configure Webhook in Meta App

1. Go to **App Settings** → **Webhooks**
2. **Callback URL**: `https://abc123.ngrok.io/webhook`
3. **Verify Token**: Same as `META_WEBHOOK_VERIFY_TOKEN` in `.env`
4. Click **Verify and Save**

### 5.3 Subscribe to Messages

In **App Roles** → **Webhooks**:
- Check: `messages`
- Check: `message_status`

---

## Phase 6: Test Everything

### Test 1: Direct Message

Send a WhatsApp message to your number:
```
hello
```

Should respond with chat (using Haiku or local Llama based on analysis).

### Test 2: Add a TV Series

```
/add-series Breaking Bad
```

Should search TVDB and add to Sonarr.

### Test 3: Web Search

```
search latest AI news 2026
```

Should search Searxng and return results.

### Test 4: Check Media Status

```
/media-status
```

Should show library counts and current downloads.

---

## Troubleshooting

### Bridge won't start
```bash
npm install --legacy-peer-deps
npm start
```

### Ollama connection fails
- Ensure Ollama is running: `tasklist | grep ollama` (Windows) or `ps aux | grep ollama` (WSL)
- Check: `curl http://localhost:11434/api/tags`

### Webhook fails verification
- Double-check `META_WEBHOOK_VERIFY_TOKEN` matches Meta config
- Ensure bridge is running and accessible via ngrok

### Docker services won't start
```bash
docker compose logs <service_name>  # Check specific service logs
docker compose down && docker compose up -d  # Restart all
```

---

## Next Steps

1. Add media to Jellyfin
2. Configure arr stack download paths
3. Set up media sharing via local network (Caddy reverse proxy optional)
4. Add more indexers to Prowlarr
5. Configure Sonarr/Radarr/Lidarr quality profiles

Enjoy your personal cloud assistant! 🚀
