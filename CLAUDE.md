# DriveSuite — Project Guide for Claude

**Project:** Personal AI Cloud Assistant (DriveSuite)  
**Status:** ✅ Infrastructure Ready | ⏳ Waiting for final setup  
**Deployment:** Windows WSL2 (Linux environment) on local PC

---

## 🚨 CRITICAL: All Installation is on WSL2/Linux, NOT Windows

**This is very important:**

DriveSuite runs **entirely on WSL2**, which is a Linux environment. Nothing installs on Windows itself.

### What runs where:

| Component | Platform | How |
|---|---|---|
| Docker services (Sonarr, Radarr, Jellyfin, etc.) | WSL2 Linux | `sudo docker` |
| Node.js bridge | WSL2 Linux | `npm start` |
| Ollama | WSL2 Linux | `ollama serve` |
| AWS CLI | WSL2 Linux | `/usr/local/bin/aws` |
| All databases & configs | WSL2 Linux | SQLite at `./data.db` |
| **ngrok tunnel** | Windows (optional) | Exposes WSL2 to internet |

### Architecture

```
Windows (Host)
    ↓
WSL2 (Linux environment)
    ├── Docker (containers)
    │   ├── Sonarr, Radarr, Lidarr, Prowlarr
    │   ├── Jellyfin, Immich, Calibre-Web
    │   └── qBittorrent, ChromaDB
    ├── Node.js bridge (npm start)
    ├── Ollama (LLM inference)
    └── AWS CLI (for secrets)
    ↓
ngrok (optional, on Windows or WSL)
    ↓
Meta Cloud API → WhatsApp
```

---

## Current Status

### ✅ Complete
- Docker installed on WSL2
- 13 Docker services running (Sonarr, Radarr, Jellyfin, etc.)
- Node.js dependencies installed
- Ollama installed on WSL2 with llama3:8b model
- AWS CLI installed on WSL2
- All API keys fetched from AWS SSM Parameter Store
- `.env` file populated with all values
- **Prowlarr indexers configured** (YTS, The Pirate Bay, LimeTorrents)
- **Prowlarr synced to Sonarr, Radarr, Lidarr**

### ⏳ Next Steps
1. **Start the Node.js bridge:**
   ```bash
   cd ~/sarvesh1karandikar/DriveSuite/bridge
   npm start
   ```

2. **Set up ngrok for WhatsApp webhook:**
   ```bash
   ngrok http 3000
   ```
   Update Meta webhook URL with the ngrok HTTPS URL

3. **Test end-to-end flow:**
   - Send WhatsApp message: `/add-series "The Office"`
   - Verify torrent downloads start in qBittorrent
   - Check Jellyfin for media appearing

---

## Key Files

| File | Purpose | Location |
|---|---|---|
| `.env` | All configuration (API keys, URLs) | `bridge/.env` |
| `server.js` | Main WhatsApp bot + router | `bridge/server.js` |
| `router-analyzer.js` | Intelligent model routing (local Llama) | `bridge/lib/router-analyzer.js` |
| `docker-compose.yml` | All services config | `infra/docker-compose.yml` |
| `SETUP_GUIDE.md` | Complete step-by-step setup | `SETUP_GUIDE.md` |
| `STATUS.md` | Current project status | `STATUS.md` |

---

## Quick Reference Commands

### Check services are running
```bash
sudo docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Start the bridge
```bash
cd ~/sarvesh1karandikar/DriveSuite/bridge
npm start
```

### Check Ollama is working
```bash
curl http://localhost:11434/api/tags
```

### View logs
```bash
sudo docker logs sonarr    # Sonarr logs
sudo docker logs jellyfin  # Jellyfin logs
npm start                  # Bridge logs
```

### Restart all services
```bash
cd ~/sarvesh1karandikar/DriveSuite/infra
sudo docker-compose restart
```

### Manage Prowlarr indexers
```bash
# View available indexers in Prowlarr WebUI
http://localhost:9696

# Add a new indexer via API (example: 1337x)
curl -X POST http://localhost:9696/api/v1/indexer \
  -H "X-Api-Key: f7c7745f3df541eaaacbbab07e5a0385" \
  -H "Content-Type: application/json" \
  -d '{"name":"1337x","enable":true,"priority":25,"implementation":"Cardigann",...}'

# Check Prowlarr logs
sudo docker logs prowlarr
```

---

## Indexer & Arr Stack Configuration

### Current Setup (Automated)
✅ **Prowlarr** (http://localhost:9696) — Torrent indexer manager
- **Indexers added:** YTS, The Pirate Bay, LimeTorrents
- **Synced to:** Sonarr (TV), Radarr (Movies), Lidarr (Music)

✅ **Sonarr** (http://localhost:8989) — TV show management
- Searches Prowlarr indexers automatically
- Downloads via qBittorrent (routed through NordVPN)
- Manages episodes and quality profiles

✅ **Radarr** (http://localhost:7878) — Movie management
- Searches Prowlarr indexers automatically
- Downloads via qBittorrent (routed through NordVPN)
- Manages quality and releases

✅ **Lidarr** (http://localhost:8686) — Music management
- Searches Prowlarr indexers automatically
- Downloads via qBittorrent (routed through NordVPN)
- Manages artists and albums

### Adding More Indexers

To add additional torrent indexers to Prowlarr:

1. **WebUI Method (Manual):**
   - Open http://localhost:9696
   - Click **Indexers** → **Add Indexer**
   - Search for indexer name (e.g., "EZTV", "TorrentKitty")
   - Enable and set priority (lower number = higher priority)
   - Click **Test** to verify

2. **API Method (Automated):**
   ```bash
   python3 scripts/add-indexer.py <INDEXER_NAME> <PRIORITY>
   ```

### Indexer Priority Reference

| Priority | Indexer | Best For | Seeder Quality |
|----------|---------|----------|-----------------|
| 20 | YTS | 1080p/4K Movies | Excellent |
| 30 | The Pirate Bay | General (TV/Movies) | Good |
| 45 | LimeTorrents | General (TV/Movies/Music) | Good |
| 40+ | Other | Backup sources | Varies |

**Lower priority = searched first.** If YTS finds a movie, Sonarr won't query lower-priority indexers.

### Testing the Pipeline

**Quick test: Add a TV show via WhatsApp bot**
```
/add-series "The Office"
```

**Expected workflow:**
1. Openclaw routes to Sonarr
2. Sonarr searches Prowlarr indexers (in priority order)
3. First match with seeders → qBittorrent download starts
4. NordVPN container ensures download privacy
5. Sonarr post-processes and moves to `/media/tv/`
6. Jellyfin scans library and streams on phone

### Troubleshooting Indexers

**"No results found" when searching:**
1. Check Prowlarr indexer health: http://localhost:9696/health
2. Verify indexer is enabled in Sonarr: http://localhost:8989/settings/indexers
3. Check Sonarr logs: `sudo docker logs sonarr | grep -i search`
4. Try searching manually in Prowlarr first

**"Indexer connection failed":**
- Indexer domain may be blocked/down
- Add mirror URL in Prowlarr settings
- Try alternative indexer

**"Downloads not appearing in Jellyfin":**
1. Check qBittorrent is active: http://localhost:8080
2. Check download path in qBittorrent (should be `/downloads`)
3. Verify Sonarr can read `/media/tv/` directory
4. Force Jellyfin library scan: http://localhost:8096

---

## Architecture Notes

### Model Routing
1. **User sends WhatsApp message**
2. **Local Llama 3.1 8B analyzes** (FREE, runs in WSL2)
   - Detects: sentiment, complexity, task type
3. **Router decides** which model to use:
   - Simple action → Haiku (fast, $0.80-1.50 per M tokens)
   - Complex reasoning → Sonnet ($3-15 per M tokens)
   - Tool routing → Haiku (NL→tool decision)
4. **Execute & respond** via Meta Cloud API

### Cost Management
- **Local Llama:** $0 (runs locally)
- **Haiku:** Most queries (cheap)
- **Sonnet:** Complex queries only (escalates automatically)
- **Web search:** $0 (Searxng)
- **Total:** Typically $0.01-0.05 per message

---

## Environment Variables

All populated from AWS SSM (`/1dotdev/prod/`):
- `META_WA_TOKEN` — WhatsApp system user token
- `META_WA_PHONE_NUMBER_ID` — WhatsApp business phone ID
- `META_APP_SECRET` — For webhook signature validation
- `ANTHROPIC_API_KEY` — Claude API key
- `ALLOWED_WHATSAPP_NUMBERS` — Users who can message
- `ADMIN_WHATSAPP_NUMBERS` — Admin users

Local configuration:
- `SONARR_API_KEY`, `RADARR_API_KEY`, etc. — Auto-fetched from running services
- `OLLAMA_URL=http://localhost:11434` — Local inference
- `PORT=3000` — Bridge listens on this port

---

## Troubleshooting

### "Docker not found"
- Check: `sudo docker ps`
- Start: `sudo systemctl start docker`
- Verify: `sudo docker ps`

### "npm start fails"
- Check dependencies: `npm list`
- Reinstall: `rm -rf node_modules && npm install`
- Check port: `lsof -i :3000`

### "Ollama not responding"
- Check: `curl http://localhost:11434/api/tags`
- Start: `ollama serve` (in another terminal)
- Verify model: `ollama list`

### "Meta webhook fails"
- Check bridge is running: `npm start`
- Verify token in `.env` matches Meta config
- Test locally: `curl http://localhost:3000/webhook`
- Check ngrok is running and URL is current

---

## Next Steps

1. **Start the bridge:**
   ```bash
   cd ~/sarvesh1karandikar/DriveSuite/bridge
   npm start
   ```
   Bridge will run on `http://localhost:3000`

2. **Set up ngrok** (to expose to internet):
   ```bash
   ngrok http 3000
   ```
   Note the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. **Configure Meta webhook:**
   - Go to https://developers.facebook.com/ → Your App → WhatsApp
   - Webhook URL: `https://abc123.ngrok.io/webhook`
   - Verify Token: `1DotDev-Sarvesh-Aditi-19-02-2026`
   - Subscribe to: `messages`, `message_status`

4. **Test:**
   - Send WhatsApp message to your configured number
   - Should get response (via Haiku or Sonnet based on analysis)

---

## Important Notes

- **All infrastructure is on WSL2** — no Windows installation
- **No long-lived AWS keys** — uses temporary credentials via SSM
- **All secrets in .env** — git-ignored, safe to commit `.env.example`
- **Ollama runs locally** — keeps query analysis cost-free
- **Docker Compose handles** all service orchestration

---

## Questions?

Refer to:
- `SETUP_GUIDE.md` — Complete step-by-step setup walkthrough
- `STATUS.md` — Current status and troubleshooting
- `GET_API_KEYS.md` — How to collect API keys (archive, no longer needed)

