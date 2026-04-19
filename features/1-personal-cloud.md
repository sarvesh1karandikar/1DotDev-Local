# Feature 1: Personal Cloud — Photos, Videos, Books

## Goal

Replace Google Photos, Plex/streaming services, and cloud book storage with
self-hosted equivalents running on the local WSL2 machine. Integrate basic
access into the 1DotDev WhatsApp bridge.

---

## Services to Deploy (all via Docker)

### 1. Immich — Photos & Videos (Google Photos replacement)
- **Why**: Best self-hosted photo app. Mobile backup, face recognition, CLIP-based search, timeline view. Actively maintained.
- **Docker image**: `ghcr.io/immich-app/immich-server:release`
- **Port**: 2283
- **Mobile app**: Immich iOS/Android — configure server URL to local IP (LAN access) or ngrok URL

### 2. Jellyfin — Video Streaming (Netflix replacement)
- **Why**: Best self-hosted media server. Transcoding, multi-device, no account required.
- **Docker image**: `linuxserver/jellyfin:latest`
- **Port**: 8096
- **Clients**: Browser, smart TV, iPhone app, Android app

### 3. Calibre-Web — Books (Kindle/Goodreads replacement)
- **Why**: Clean web UI for Calibre library. Read EPUB in browser, download to Kindle, search by author/title.
- **Docker image**: `linuxserver/calibre-web:latest`
- **Port**: 8083
- **Prerequisite**: A Calibre library folder (can be empty to start; add books via upload)

---

## Phase 1: Install Docker on WSL2

```bash
# Install Docker Engine on WSL2 Ubuntu
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker  # apply group without logout

# Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Verify
docker --version
docker compose version

# Start Docker daemon (WSL2 without systemd: start manually)
sudo service docker start
# OR if WSL2 has systemd enabled:
sudo systemctl enable --now docker
```

**WSL2 note:** Docker Desktop for Windows integrates with WSL2 automatically if installed.
If Docker Desktop is on the Windows side, you may already have `docker` available in WSL.
Check: `docker ps` — if it works, skip the install above.

---

## Phase 2: Create Media Directory Structure

```bash
# Create media dirs on a path that survives WSL restarts
# Using home directory (WSL2 home persists across restarts)
mkdir -p ~/media/{photos,videos,books,immich-db,chroma-data}

# Optional: mount a Windows drive folder for larger storage
# ~/media can also point to /mnt/d/media if you have a D: drive
# ln -s /mnt/d/media ~/media
```

---

## Phase 3: Deploy with Docker Compose

Copy `infra/docker-compose.yml` from this repo to your machine and run:

```bash
cp /home/sskgameon/sarvesh1karandikar/1DotDev-Local/infra/docker-compose.yml \
   ~/docker-compose.yml

docker compose -f ~/docker-compose.yml up -d

# Check all services started:
docker compose -f ~/docker-compose.yml ps
```

Expected output: all services showing "Up" status.

---

## Phase 4: Initial Configuration

### Immich setup (first run only)
1. Open browser: `http://localhost:2283`
2. Create admin account (email + password of your choice)
3. Go to **Administration → Storage Template** — set as needed
4. On iPhone/Android: install Immich app → Settings → Server URL: `http://<your-WSL-IP>:2283`
   - WSL IP: `hostname -I | awk '{print $1}'`

### Calibre-Web setup (first run only)
1. Open browser: `http://localhost:8083`
2. Default login: `admin` / `admin123`
3. Go to **Admin → Edit Basic Configuration** → set Calibre library path to `/media/books`
4. Upload your first book via **+ Add Books**

### Jellyfin setup (first run only)
1. Open browser: `http://localhost:8096`
2. Run setup wizard — create admin account
3. Add media library → type "Movies" or "TV Shows" → path `/media/videos`
4. Jellyfin will scan and match metadata automatically

---

## Phase 5: Auto-Start on WSL Boot

Add to a startup script or PM2:

```bash
# Create a startup script
cat > ~/start-docker-services.sh << 'EOF'
#!/bin/bash
# Start Docker if not running
sudo service docker start 2>/dev/null || true
sleep 2
# Start all services
docker compose -f ~/docker-compose.yml up -d
EOF
chmod +x ~/start-docker-services.sh

# Run it now
~/start-docker-services.sh
```

Or add to WSL's `/etc/wsl.conf` (requires WSL2 restart):
```ini
[boot]
command = "service docker start; docker compose -f /home/sskgameon/docker-compose.yml up -d"
```

---

## Phase 6: WhatsApp Integration

Add 3 new command files to the 1DotDev bridge. These are simple link-generators —
they send the user a clickable URL to the relevant service.

### `bridge/commands/photos.js`

```js
// /photos [search query] — returns Immich link
// To access from outside LAN, set IMMICH_URL in .env to ngrok URL

export default {
  name: "photos",
  category: "cloud",
  description: "Get a link to your photo library",
  usage: "/photos [search query]",
  async run({ args }) {
    const base = process.env.IMMICH_URL || "http://localhost:2283";
    if (args.trim()) {
      return `📷 Search photos for "${args.trim()}":\n${base}/search?q=${encodeURIComponent(args.trim())}`;
    }
    return `📷 Your photo library:\n${base}`;
  },
};
```

### `bridge/commands/books.js`

```js
// /books [search query] — returns Calibre-Web link

export default {
  name: "books",
  category: "cloud",
  description: "Get a link to your book library",
  usage: "/books [title or author]",
  async run({ args }) {
    const base = process.env.CALIBRE_URL || "http://localhost:8083";
    if (args.trim()) {
      return `📚 Search books for "${args.trim()}":\n${base}/search?query=${encodeURIComponent(args.trim())}`;
    }
    return `📚 Your book library:\n${base}`;
  },
};
```

### `bridge/commands/media.js`

```js
// /media — returns Jellyfin link

export default {
  name: "media",
  category: "cloud",
  description: "Get a link to your media server",
  usage: "/media",
  async run() {
    const base = process.env.JELLYFIN_URL || "http://localhost:8096";
    return `🎬 Your media server:\n${base}`;
  },
};
```

### `.env` additions (add to `bridge/.env`)

```
# Personal cloud URLs (LAN access; set to ngrok URL if accessing from outside)
IMMICH_URL=http://localhost:2283
CALIBRE_URL=http://localhost:8083
JELLYFIN_URL=http://localhost:8096
```

### `bridge/commands/index.js` — add imports

```js
// Add these lines to the imports and registry in commands/index.js:
import photos from "./photos.js";
import books from "./books.js";
import media from "./media.js";

// Add to the commands array:
photos, books, media,
```

---

## Verification

```bash
# All Docker services running
docker compose -f ~/docker-compose.yml ps

# Immich health
curl http://localhost:2283/api/server-info/ping
# → {"res":"pong"}

# Calibre-Web
curl -s -o /dev/null -w "%{http_code}" http://localhost:8083
# → 200

# Jellyfin
curl http://localhost:8096/health
# → {"Status":"Healthy"}

# WhatsApp test: send /photos from allowed number
# Expected: "📷 Your photo library: http://localhost:2283"
```

---

## Storage Planning

| Media type | Recommended storage | Notes |
|---|---|---|
| Photos | 100GB–1TB | RAW photos are 20–50MB each |
| Videos | 500GB–several TB | 4K movies are 50–100GB |
| Books | 1–50GB | EPUBs are tiny; PDFs are larger |
| Immich DB | ~5GB per 10,000 photos | Postgres + ML embeddings |

If the WSL2 disk is too small, mount a Windows drive:
```bash
# Mount D: drive for media storage
ln -s /mnt/d/media ~/media
```

---

## Accessing From Outside LAN (Phone on Mobile Data)

For photo backup from your phone when not on WiFi:

**Option A (Immich only)**: Set up Tailscale on both phone and PC → access via Tailscale IP, no port forwarding.

**Option B**: Add a third ngrok tunnel:
```bash
ngrok http 2283 --domain=<immich-static-domain>
```
Then set `IMMICH_URL` in bridge `.env` to the ngrok URL. Phone Immich app uses ngrok URL as server.
