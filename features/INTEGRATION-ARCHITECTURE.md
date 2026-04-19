# Full Local Stack — Integration Architecture

This document is the master map of every service running on the WSL2 machine and how
they connect. Read this before any feature-specific file.

---

## Services Overview

```
Windows PC (WSL2 Ubuntu 24.04)
│
├── Port 3000  — 1DotDev Bridge         (Node.js, PM2)
├── Port 4000  — Portfolio Website      (Next.js, PM2)
├── Port 8080  — Ollama API             (local LLM inference)
├── Port 2283  — Immich                 (Docker — photos/videos)
├── Port 8083  — Calibre-Web            (Docker — books)
├── Port 8096  — Jellyfin               (Docker — video streaming)
├── Port 8000  — ChromaDB              (Docker — vector store for RAG)
└── Port 9000  — chromadb-orm API      (Python FastAPI, PM2)
                                        (RAG backend from chromadb repo)
│
└── nginx (:80 / :443)  →  routes all services by path or subdomain
         │
         └── Cloudflare Tunnel / ngrok  →  internet
```

---

## Traffic Routing Map

| External path | Service | Internal port |
|---|---|---|
| `/webhook` | 1DotDev bridge | 3000 |
| `/health` | 1DotDev bridge | 3000 |
| `/` (portfolio domain) | Portfolio website | 4000 |
| `/cloud` | Immich web UI | 2283 |
| `/books` | Calibre-Web | 8083 |
| `/media` | Jellyfin | 8096 |
| `/rag` | chromadb-orm FastAPI | 9000 |

One ngrok tunnel or Cloudflare Tunnel can forward to nginx on :80, which then routes
internally. Or multiple tunnels can each point to a specific port (easier to set up).

**Recommended approach** (simpler): one tunnel per public surface.
- Tunnel 1: WhatsApp webhook domain → port 3000 (required for 1DotDev, always on)
- Tunnel 2: Portfolio domain → port 4000 (for recruiter sharing)
- Media/books/Immich are LAN-only (access from Windows browser or phone on same WiFi)

---

## WhatsApp Command Additions (1DotDev bridge)

The bridge gains new commands to interact with local services:

| Command | Feature | What it does |
|---|---|---|
| `/local <message>` | Local LLMs | Chat with a local Ollama model |
| `/model local` | Local LLMs | Switch to default local model for all chat |
| `/model haiku` | 1DotDev existing | Switch back to Claude Haiku |
| `/ask <question>` | RAG | Query documents via chromadb-orm + local LLM |
| `/photos [query]` | Personal cloud | Get a link to Immich (+ optional search) |
| `/books [title]` | Personal cloud | Get Calibre-Web link or search books |

---

## Data Flow: Local LLM Chat via WhatsApp

```
WhatsApp user: "What is transformer architecture?"
     │
     ▼
1DotDev bridge (server.js)
     │  user has model = "local" (stored in SQLite users table)
     │
     ▼
bridge/lib/ollama.js → POST http://localhost:8080/api/chat
     │                   model: phi3-mini or llama3.2:3b
     │                   messages: last 20 from SQLite
     │
     ▼
Ollama (local inference, CPU/GPU)
     │
     ▼
reply text → sendWhatsApp(number, reply)
     │
     ▼
WhatsApp user receives answer
```

---

## Data Flow: RAG Q&A via WhatsApp

```
WhatsApp user: "/ask What does chromadb-orm use for chunking?"
     │
     ▼
1DotDev bridge → runs "/ask" command
     │
     ▼
bridge/commands/ask.js → POST http://localhost:9000/search
     │                     body: { query: "What does chromadb-orm use for chunking?" }
     │
     ▼
chromadb-orm FastAPI (chromadb repo, running locally)
     │  → embeds query with all-mpnet-base-v2
     │  → centroid-routes to matching collections
     │  → returns top-k chunks
     │
     ▼
bridge/commands/ask.js → sends chunks + question to Claude (or Ollama)
     │
     ▼
Reply → WhatsApp
```

---

## Docker Compose Services (media + ChromaDB)

See `infra/docker-compose.yml` for the complete compose file. Summary:

| Service | Image | Volume | Purpose |
|---|---|---|---|
| immich-server | ghcr.io/immich-app/immich-server | ~/media/photos | Photo/video backup & search |
| immich-ml | ghcr.io/immich-app/immich-machine-learning | | CLIP embeddings, face recognition |
| immich-postgres | postgres:14 | ~/media/immich-db | Immich metadata DB |
| immich-redis | redis:6.2 | | Immich job queue |
| calibre-web | linuxserver/calibre-web | ~/media/books | Book library web UI |
| jellyfin | linuxserver/jellyfin | ~/media/videos | Video streaming |
| chromadb | chromadb/chroma | ~/media/chroma-data | Vector store for RAG |

Start all: `docker compose -f infra/docker-compose.yml up -d`

---

## File System Layout (after all features)

```
~/sarvesh1karandikar/
├── 1DotDev/                  ← existing bridge repo
│   ├── bridge/
│   │   ├── .env              ← local .env (all secrets)
│   │   ├── data.db           ← SQLite (user data, reminders, etc.)
│   │   ├── server.js
│   │   ├── lib/
│   │   │   ├── ollama.js     ← NEW: Ollama client
│   │   │   └── rag.js        ← NEW: RAG query helper
│   │   └── commands/
│   │       ├── ask.js        ← NEW: /ask RAG command
│   │       ├── local.js      ← NEW: /local direct Ollama chat
│   │       ├── photos.js     ← NEW: /photos Immich link
│   │       └── books.js      ← NEW: /books Calibre-Web link
│   └── infra/
│       └── pm2/ecosystem.config.cjs  ← updated for all services
│
├── 1DotDev-Local/            ← this planning repo
│   ├── PLAN.md
│   ├── features/
│   │   ├── INTEGRATION-ARCHITECTURE.md  (this file)
│   │   ├── 1-personal-cloud.md
│   │   ├── 2-local-models.md
│   │   └── 3-portfolio.md
│   └── infra/
│       ├── docker-compose.yml
│       ├── nginx/
│       └── pm2.config.cjs
│
├── chromadb/                 ← RAG backend (clone from GitHub)
│   └── main.py               ← FastAPI app, run on port 9000
│
└── portfolio/                ← NEW: portfolio website
    ├── package.json          ← Next.js app
    └── src/
        └── app/              ← Next.js App Router pages

~/media/                      ← ALL media files (outside WSL path, Windows-accessible)
├── photos/                   ← Immich library
├── videos/                   ← Jellyfin library
├── books/                    ← Calibre library (EPUB/PDF/MOBI)
├── immich-db/                ← Postgres data for Immich
└── chroma-data/              ← ChromaDB persistent data
```

---

## Port Conflict Avoidance

| Port | Service | Note |
|---|---|---|
| 3000 | 1DotDev bridge | Fixed — Meta webhook requirement |
| 4000 | Portfolio website | Standard Next.js dev port |
| 8080 | Ollama | Changed from default 11434 to avoid conflict |
| 8083 | Calibre-Web | Docker default |
| 8096 | Jellyfin | Docker default |
| 2283 | Immich | Docker default |
| 8000 | ChromaDB | Docker default (chromadb-orm uses this) |
| 9000 | chromadb-orm FastAPI | From CLAUDE.md in chromadb repo |

---

## What Runs When (Always vs On-demand)

| Service | Run mode | Start command |
|---|---|---|
| 1DotDev bridge | Always-on (PM2) | `pm2 start` on WSL boot |
| Portfolio website | Always-on (PM2) | `pm2 start` on WSL boot |
| chromadb-orm | Always-on (PM2) | `pm2 start` on WSL boot |
| Ollama | Always-on (background) | `ollama serve` |
| Docker services | Always-on | `docker compose up -d` on WSL boot |
| ngrok (webhook) | Always-on (PM2) | needed for Meta webhooks |
| ngrok (portfolio) | On-demand | start when sharing with recruiters |
