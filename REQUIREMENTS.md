# DriveSuite — Requirements & Architecture

**Last Updated:** 2026-04-20  
**Status:** Active Development  
**Deployment:** WSL2 (Windows local) + Local Network Access

---

## Core Requirements

### 1. Media Hosting & Management

**Services:**
- ✅ **Jellyfin** — streaming server for videos, pictures, books (local network accessible)
- ✅ **Arr Stack** — automatic media acquisition & organization:
  - **Prowlarr** — indexer hub (torrent/usenet sources)
  - **Sonarr** — TV show manager (auto-grab episodes)
  - **Radarr** — movie manager (auto-grab movies)
  - **Lidarr** — music manager (optional)
  - **qBittorrent** — torrent client (downloads)

**Data:**
- Media library: `/mnt/e/media-library/` (Windows drive, mounted in WSL)
- Configs & downloads: `~/media-cloud/` (WSL storage)
- Database: SQLite (arr stack configs)

---

### 2. AI-Driven Media Acquisition (Openclaw Integration)

**Goal:** Use AI to intelligently manage media downloads via WhatsApp

**Capability:**
- User sends WhatsApp message: "Add Breaking Bad" or "Find new sci-fi movies"
- Openclaw plans the task, searches arr stack APIs, adds to queue
- qBittorrent fetches automatically
- Jellyfin indexes → available for playback in hours

**Commands Needed:**
- `/add-series <title>` — search TVDB, add to Sonarr
- `/add-movie <title>` — search TMDB, add to Radarr
- `/search-series <query>` — list TVDB results
- `/search-movie <query>` — list TMDB results
- `/media-status` — current downloads, library size, disk space
- `/upcoming` — next episodes/releases due
- `/jellyfin-status` — server health, streaming capability

**NL Routing:**
- Non-slash messages routed via Haiku/local model to decide: search? add? status?
- Tool calls translated to commands above

---

### 3. WhatsApp Integration (Existing 1DotDev Pattern)

**Architecture:**
- **Node.js bridge** (running on WSL natively or containerized)
- **Meta WhatsApp Cloud API** (not Twilio)
- **SQLite** state (messages, facts, media queries)
- **Command modules** (one file per command)
- **NL router** (Haiku decides tool use)
- **Local network**: expose via ngrok (dev) or Caddy reverse proxy (production-ready)

**Command Surface (Extend 1DotDev):**
- Existing: `/help`, `/remind`, `/todo`, `/cost`, `/facts`
- **New (Media):** `/add-series`, `/add-movie`, `/media-status`, `/search-*`, `/upcoming`

---

### 4. Model Strategy: Planning + Execution Separation

**Constraint:** Anthropic API (planning) + Local/Haiku (execution)

#### Planning Layer (Anthropic API)
- **Model:** `claude-opus-4-7` or `claude-sonnet-4-6`
- **Role:** Understand user intent, decide which tools to call, compose replies
- **Input:** User's WhatsApp message + conversation history
- **Output:** Tool calls (add-series, search-movie, etc.) + final reply
- **Cost:** Higher per token, but infrequent (once per user message)

#### Execution Layer (Local or Haiku)
- **Role:** Actually run the commands (hit APIs, fetch results, format output)
- **Options:**
  1. **Local LLM** (Ollama) — free, no API calls, fast
  2. **Haiku 4.5** (Anthropic API) — accurate, cheap (~$0.001/message), requires API call

#### Recommended: Hybrid Approach

```
User's WhatsApp message
    ↓
[Node bridge]
    ↓
Anthropic API (Opus 4.7)  ← planning
    ↓ (tool calls: search-movie, add-series, etc.)
[Execute locally or via Haiku]
    ↓ (call arr stack APIs)
qBittorrent/Sonarr/Radarr
    ↓
Reply back to user via WhatsApp
```

---

### 5. Local Model Selection (RTX 4070 Super 12GB)

**Your Hardware:** RTX 4070 Super with 12GB VRAM

**Recommended Models (ranked by use case):**

| Model | Size | VRAM | Speed | Quality | Recommendation |
|-------|------|------|-------|---------|-----------------|
| **Llama 3.1 8B** | 8B | 6-8GB | ⚡⚡⚡ Fast | ⭐⭐⭐⭐ Good | **BEST for task execution** |
| **Mistral 8B** | 8B | 6-8GB | ⚡⚡⚡ Very Fast | ⭐⭐⭐⭐ Good | Good alternative |
| **Qwen 2.5 7B** | 7B | 5-7GB | ⚡⚡⚡ Fast | ⭐⭐⭐⭐ Good | Lightweight option |
| Llama 3.1 70B (q4) | 70B (quantized) | 10-12GB | ⚡⚡ Slower | ⭐⭐⭐⭐⭐ Excellent | Overkill, but possible |

**My Recommendation:**
- **Primary:** **Llama 3.1 8B** — excellent instruction-following, good for tool use, fits comfortably
- **Fallback:** Haiku 4.5 (API) if local model fails or token limits reached
- **Alternative:** Mistral 8B (slightly faster, good enough quality)

**Why not Claude locally?** Claude models are proprietary; only available via Anthropic API.

---

### 6. Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      WhatsApp User                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ (Meta signs webhook)
┌─────────────────────────────────────────────────────────┐
│           Meta WhatsApp Cloud API → ngrok tunnel         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ POST /webhook
┌─────────────────────────────────────────────────────────┐
│     Node.js Bridge (WSL) :3000                          │
│  - Validate HMAC signature                              │
│  - Allowlist check                                       │
│  - Dispatch to commands/                                │
│  - Call planning model (Opus 4.7 via API)               │
│  - Route to execution layer                             │
└─────────────────────────────────────────────────────────┘
           │                           │
           ▼ (Planning)                ▼ (Tool execution)
    ┌──────────────────┐        ┌────────────────────────┐
    │ Anthropic API    │        │ Execution Layer (Local)│
    │ Opus 4.7         │        │ ┌──────────────────┐   │
    │                  │        │ │ Llama 3.1 8B or  │   │
    │ (understand      │        │ │ Haiku 4.5        │   │
    │  intent, tools)  │        │ │ (run commands)    │   │
    └──────────────────┘        └──────────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
            ┌─────────┐          ┌──────────────┐      ┌──────────────┐
            │ Sonarr  │          │ Radarr       │      │ Lidarr       │
            │ (TV)    │          │ (Movies)     │      │ (Music)      │
            └─────────┘          └──────────────┘      └──────────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                        ▼
                            ┌─────────────────────┐
                            │ qBittorrent Client  │
                            │ (downloads)         │
                            └─────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────┐
                        │ /mnt/e/media-library/     │
                        │ (Windows drive storage)   │
                        └───────────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────┐
                            │ Jellyfin            │
                            │ (Streaming Server)  │
                            └─────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────┐
                            │ Local Network Users │
                            │ (Watch/Read/Listen) │
                            └─────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Done)
- ✅ Docker Compose for arr stack
- ✅ Jellyfin setup
- ✅ Media folders structure

### Phase 2: Bridge + Openclaw (Next)
- [ ] Adapt 1DotDev Node.js bridge to Personal AI Cloud Assistant
- [ ] Add `/add-series`, `/add-movie`, `/search-*`, `/media-status` commands
- [ ] Set up Ollama with Llama 3.1 8B on Windows GPU
- [ ] Wire planning (Opus) + execution (local/Haiku) layers
- [ ] Test WhatsApp → arr stack flow

### Phase 3: Polish
- [ ] Caddy reverse proxy (local network, optional HTTPS)
- [ ] Scheduled tasks (e.g., `/upcoming` digest every morning)
- [ ] Usage tracking (cost per user, token logs)
- [ ] Error handling & retry logic

---

## Summary of Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Media Server** | Jellyfin | Open-source, no subscriptions, great UI |
| **Arr Stack** | Full (Sonarr/Radarr/Lidarr/Prowlarr) | Proven, automated, integrates with qBittorrent |
| **WhatsApp Bridge** | Adapt 1DotDev (Node.js) | Already working, command-module pattern scales |
| **Planning Model** | Opus 4.7 (Anthropic API) | Best reasoning, understands intent reliably |
| **Execution Model** | Llama 3.1 8B (local) | Fast, free, fits 12GB VRAM, good quality |
| **Fallback Model** | Haiku 4.5 (API) | Cheap backup if local model fails |
| **Deployment** | WSL2 + Docker Compose | All local, no cloud infra, full control |

---

## Success Criteria

- [ ] Add "Breaking Bad" via WhatsApp → Sonarr fetches episodes automatically
- [ ] Search movies via WhatsApp → results appear in minutes
- [ ] Media status command shows accurate counts + disk space
- [ ] Jellyfin plays new content within hours of qBittorrent download
- [ ] Local model inference < 2 seconds per command
- [ ] No manual arr stack management needed (all via Openclaw)
