# Personal AI Cloud Architecture Plan

## Overview
Build a self-hosted personal AI cloud on Windows PC with WSL2 that hosts media, runs AI services, integrates with WhatsApp, and provides a foundation for website hosting.

## Core Components

### 1. Media Server Layer
- **Jellyfin** or **Plex** (self-hosted video/picture/book server)
  - Streams videos, pictures, organizes media library
  - Native support for watch history and user management
  - For Teleparty-style sync: pair with **Synced** (open-source) or **Trakt** integration

### 2. AI Assistant Layer
- **Ollama** (run local LLMs) + **Open-WebUI** (interface)
- **Openclaw** deployment on top, configured for WhatsApp via:
  - **Twilio** (WhatsApp Business API) or **WhatsApp Cloud API**
  - Python webhook server to bridge Openclaw ↔ WhatsApp

### 3. Web Hosting Layer
- **Nginx** or **Caddy** (reverse proxy, SSL termination)
- Node.js/Python backend for your future website
- **Docker Compose** to orchestrate all services

### 4. Storage & Networking
- WSL2 persistent volumes for media library
- Windows host file sharing to WSL for easy media upload
- Local network access from other devices

## Technology Stack
```
├── Docker Compose (orchestration)
├── Jellyfin (media server)
├── Ollama + Open-WebUI (LLMs)
├── Openclaw (AI assistant)
├── Caddy (reverse proxy)
├── PostgreSQL (data persistence)
└── Python webhook service (WhatsApp bridge)
```

## Setup Phases

### Phase 1: Foundation
**WSL2 + Docker + Jellyfin**
- Set up WSL2 with persistent storage
- Install Docker & Docker Compose
- Deploy Jellyfin for media hosting
- Configure media library and initial uploads

### Phase 2: AI Services
**Ollama, Open-WebUI, Openclaw**
- Install Ollama and download LLMs
- Set up Open-WebUI interface
- Deploy Openclaw on top
- Test local AI inference

### Phase 3: Integration
**WhatsApp bridge, Teleparty sync**
- Configure Twilio/WhatsApp Cloud API credentials
- Build Python webhook server for message routing
- Wire Openclaw → WhatsApp integration
- Implement Teleparty-style synchronized video watching

### Phase 4: Web Hosting
**Caddy proxy, website deployment**
- Set up Caddy for reverse proxying and SSL
- Deploy website backend (Node.js/Python)
- Configure routing for media server, AI services, and website
- Test from local network and (optionally) from outside

## Key Decisions

1. **Media syncing**: Auto-upload from Windows or manual?
2. **Local network access**: Want to access from phone/other devices on your network?
3. **Ollama models**: Budget for VRAM (8GB minimum; 16GB+ recommended)
4. **Persistence**: How much storage for media library?

## Success Criteria
- [ ] Jellyfin streaming videos/pictures/books locally
- [ ] Ollama running at least one LLM with measurable inference speed
- [ ] Openclaw responding to WhatsApp messages
- [ ] Website skeleton deployed and accessible via local network
- [ ] Cache hit rate > 70% (via prompt caching)
