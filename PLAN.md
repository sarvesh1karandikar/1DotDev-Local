# 1DotDev Local Hosting Plan

This document is the authoritative briefing for Claude Code (Haiku) sessions working on
running the 1DotDev WhatsApp AI bridge **locally on a WSL2 Linux machine** instead of
AWS Lightsail. Read this fully before making any change.

---

## 1. What 1DotDev Is

A personal WhatsApp AI assistant. Architecture in prod:

```
WhatsApp user
     │  (Meta signs webhook HMAC-SHA256)
     ▼
Meta Cloud API  ──POST /webhook──►  nginx :443 (TLS, Let's Encrypt)
                                          │
                                          ▼
                               Node bridge :3000  (server.js)
                                 │       │       │
                              SQLite  Anthropic  node-cron
                             data.db    API     (reminders+digests)
```

The bridge runs on an AWS Lightsail nano ($5/mo). Secrets live in AWS SSM Parameter Store
and are loaded at boot by `bridge/lib/secrets.js`.

---

## 2. Goal

Replace the Lightsail VM with the **local WSL2 machine**. Eliminate the $5/mo AWS bill.
Keep all functionality intact.

### What moves local
| Component | Prod location | Local location |
|---|---|---|
| Node bridge process | Lightsail EC2 VM | WSL2 process (managed by PM2) |
| SQLite `data.db` | `/home/ubuntu/bridge/data.db` | `/home/sskgameon/sarvesh1karandikar/1DotDev/bridge/data.db` |
| Secrets | AWS SSM Parameter Store | Local `.env` file |
| TLS + reverse proxy | nginx + Let's Encrypt on VM | ngrok tunnel (handles TLS externally) |
| Process supervisor | systemd on Linux VM | PM2 (Node process manager, no systemd needed) |

### What stays cloud (mandatory — cannot be replaced)
| Component | Why |
|---|---|
| Meta Cloud API | WhatsApp is Meta's proprietary platform. All messages route through Meta's servers. There is no self-hosted WhatsApp API alternative. |
| Anthropic Claude API | The AI is Claude. No local LLM is in scope. |
| Public webhook URL (ngrok/cloudflare tunnel) | Meta requires a reachable public HTTPS URL to POST webhooks to. WSL2 is behind NAT; a tunnel punches through. |

---

## 3. Local Architecture

```
WhatsApp user
     │
     ▼
Meta Cloud API  ──POST https://<ngrok-static-domain>/webhook──►
     ngrok edge server (TLS)
          │
          ▼  (plain HTTP, encrypted tunnel)
     ngrok agent (running in WSL2)
          │
          ▼
     Node bridge  localhost:3000  (PM2-managed)
      │        │         │
   SQLite    Claude     node-cron
  data.db     API    (reminders+digests)
```

Key simplification: **no nginx needed**. ngrok terminates TLS and forwards to `:3000` directly.

---

## 4. The One Critical Code Change: Secrets

`bridge/lib/secrets.js` already has this guard:

```js
if (!process.env.AWS_REGION) {
  console.log("AWS_REGION not set — skipping SSM load, using local .env only");
  return { loaded: 0 };
}
```

**This means: if `AWS_REGION` is absent from `.env`, the bridge uses the local `.env` directly.**
No code change needed in `secrets.js`.

The production `.env` on Lightsail only has 3 lines (AWS creds to reach SSM):
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

The **local `.env`** must have ALL secrets directly (no SSM). See `.env.local.example` in this
repo for the complete template. Do NOT set `AWS_REGION`.

---

## 5. All Other Code — No Changes Needed

| File | Status |
|---|---|
| `bridge/server.js` | No change — reads env vars that are now in local .env |
| `bridge/lib/db.js` | No change — SQLite path is relative to CWD |
| `bridge/lib/whatsapp.js` | No change — still calls Meta Graph API |
| `bridge/lib/router.js` | No change — still calls Anthropic API |
| `bridge/lib/scheduler.js` | No change — node-cron works anywhere |
| `bridge/lib/anthropic.js` | No change |
| `bridge/lib/state.js` | No change |
| `bridge/lib/users.js` | No change |
| `bridge/lib/tz.js` | No change |
| `bridge/lib/digest.js` | No change |
| `bridge/lib/rss.js` | No change |
| `bridge/lib/welcome.js` | No change |
| `bridge/commands/*.js` | No change — all 20+ commands work unchanged |

---

## 6. New Files to Create (in the 1DotDev repo)

### 6.1  `bridge/.env`  (never commit — already in .gitignore)

Create this file at `bridge/.env` inside the 1DotDev repo. Use `.env.local.example` from
THIS repo (1DotDev-Local) as the template. Populate with real values.

Critical: **do NOT include `AWS_REGION`**. Its absence is what tells `secrets.js` to use local env.

### 6.2  `infra/pm2/ecosystem.config.cjs`  (commit this)

Copy `infra/pm2.config.cjs` from THIS repo into the 1DotDev repo as
`infra/pm2/ecosystem.config.cjs`. This tells PM2 how to run the bridge.

### 6.3  `infra/cloudflare/config.yml`  (optional — for cloudflared approach)

If using Cloudflare Tunnel instead of ngrok, this file configures the tunnel routing.
Template is in `infra/cloudflare/config.yml.example` in this repo.

---

## 7. Phase-by-Phase Build Plan

This is the ordered task list Haiku should execute. Each phase has a verification step.
Do NOT proceed to the next phase if the verification fails.

---

### Phase 0: Gather secrets (HUMAN TASK — not automatable)

The human (Sarvesh) must collect these values before Haiku can proceed:

**From Meta Developer Portal** (`developers.facebook.com/apps` → 1DotDev app):
- `META_WA_TOKEN` — permanent System User token (WhatsApp → Configuration → System Users)
- `META_WA_PHONE_NUMBER_ID` — from WhatsApp → API Setup
- `META_WA_BUSINESS_ACCOUNT_ID` — from Business Settings → WhatsApp accounts
- `META_WEBHOOK_VERIFY_TOKEN` — any 32-char random string you choose; you'll enter it when registering the webhook
- `META_APP_SECRET` — from App → Settings → Basic → App Secret

**From Anthropic Console** (`console.anthropic.com`):
- `ANTHROPIC_API_KEY` — the `sk-ant-...` key with $5/mo cap

**Access control:**
- `ALLOWED_WHATSAPP_NUMBERS` — comma-separated phone numbers (no +, no spaces), e.g. `15551234567,919987654321`
- `ADMIN_WHATSAPP_NUMBERS` — subset of above; Sarvesh's number

**From ngrok** (after signup at `ngrok.com`):
- `NGROK_AUTHTOKEN` — from ngrok dashboard
- The free static domain assigned to the account (e.g. `word-word-1234.ngrok-free.app`)

---

### Phase 1: Install prerequisites on WSL

Run these commands on the WSL2 Ubuntu shell:

```bash
# 1a. Node.js 22 (if not already installed)
node --version  # check if already there; need v22+
# If not:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# 1b. PM2 (global install)
npm install -g pm2

# 1c. ngrok
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install -y ngrok

# 1d. Authenticate ngrok with your token
ngrok config add-authtoken <NGROK_AUTHTOKEN>
```

**Verification:**
```bash
node --version   # must print v22.x.x or higher
pm2 --version    # must print 5.x.x
ngrok version    # must print ngrok version 3.x.x
```

---

### Phase 2: Configure the bridge

```bash
# 2a. Go to the 1DotDev bridge directory
cd /home/sskgameon/sarvesh1karandikar/1DotDev/bridge

# 2b. Install npm dependencies
npm install

# 2c. Create the local .env (use the template from 1DotDev-Local)
# Copy .env.local.example and fill in all real values
cp /home/sskgameon/sarvesh1karandikar/1DotDev-Local/.env.local.example .env
chmod 600 .env
# EDIT .env — fill in all real secret values
# IMPORTANT: Do NOT add AWS_REGION — its absence tells secrets.js to skip SSM
```

**Verification (smoke-test the bridge locally before tunneling):**
```bash
cd /home/sskgameon/sarvesh1karandikar/1DotDev/bridge
node server.js &
curl http://localhost:3000/health
# Expected: {"ok":true}
kill %1  # stop the background process
```

If the health check fails, check the logs — most likely a missing .env var.

---

### Phase 3: Set up PM2 to run the bridge as a managed process

```bash
# 3a. Copy PM2 config from 1DotDev-Local into 1DotDev
mkdir -p /home/sskgameon/sarvesh1karandikar/1DotDev/infra/pm2
cp /home/sskgameon/sarvesh1karandikar/1DotDev-Local/infra/pm2.config.cjs \
   /home/sskgameon/sarvesh1karandikar/1DotDev/infra/pm2/ecosystem.config.cjs

# 3b. Start the bridge via PM2
cd /home/sskgameon/sarvesh1karandikar/1DotDev/bridge
pm2 start ../infra/pm2/ecosystem.config.cjs

# 3c. Save PM2 process list so it restarts on WSL restart
pm2 save

# 3d. Set up PM2 to start on WSL startup (optional — see note below)
pm2 startup
# The command above prints a sudo command — run it.
```

**Note on WSL startup:** WSL2 sessions end when Windows closes or WSL is shut down.
PM2's `startup` integration hooks into the init system. On WSL2 with systemd enabled
(`/etc/wsl.conf` has `systemd=true`), `pm2 startup systemd` works out of the box.
On older WSL2 without systemd, run `pm2 startup` and follow the instructions it prints.

**Verification:**
```bash
pm2 list         # should show "1dotdev-bridge" with status "online"
pm2 logs         # should show "bridge listening on :3000" and "scheduler started"
curl http://localhost:3000/health  # still {"ok":true}
```

---

### Phase 4: Start the ngrok tunnel

```bash
# 4a. Start ngrok pointed at port 3000 using your free static domain
# Replace <your-static-domain> with the actual domain from ngrok dashboard
ngrok http 3000 --domain=<your-static-domain> &

# 4b. Note the public URL — it will be: https://<your-static-domain>
```

**Verification:**
```bash
# From anywhere (or use curl from WSL):
curl https://<your-static-domain>/health
# Expected: {"ok":true}

# Signature-rejection test (proves the bridge is reachable and running correctly):
curl -X POST https://<your-static-domain>/webhook -H "Content-Type: application/json" -d '{}'
# Expected: 401 Unauthorized
```

**Keeping ngrok running:** PM2 can also manage ngrok. Add it to the ecosystem config
or run it as a separate background process. See `infra/pm2.config.cjs` — it includes
an optional ngrok app definition.

---

### Phase 5: Register webhook with Meta (HUMAN TASK)

1. Go to `developers.facebook.com/apps` → your **1DotDev** app
2. Left nav: **WhatsApp → Configuration**
3. Under **Webhook**, click **Edit**
4. **Callback URL**: `https://<your-static-ngrok-domain>/webhook`
5. **Verify token**: the value of `META_WEBHOOK_VERIFY_TOKEN` in your `.env`
6. Click **Verify and save** — Meta will GET `/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` and expect the challenge echoed back. The bridge handles this.
7. After verification, click **Manage** → subscribe to the **messages** field.

**Verification:**
```bash
# Webhook GET verification (simulates what Meta sends):
VERIFY=<your-META_WEBHOOK_VERIFY_TOKEN>
curl -sG "https://<your-static-ngrok-domain>/webhook" \
  --data-urlencode "hub.mode=subscribe" \
  --data-urlencode "hub.verify_token=$VERIFY" \
  --data-urlencode "hub.challenge=ping"
# Expected output: ping
```

---

### Phase 6: End-to-end test

From the **allowed** WhatsApp phone number, send a message to the Meta test phone number.
Then immediately:

```bash
pm2 logs 1dotdev-bridge --lines 20
# Watch for:
#   in: <number> <your message>
#   out: <number> <Claude's reply>
```

The WhatsApp message should receive a reply within ~2 seconds.

---

## 8. Keeping the Service Running

### When Windows/WSL restarts
1. Open WSL terminal
2. PM2 should auto-restart if `pm2 startup` was configured
3. ngrok tunnel needs to be restarted manually (or use PM2 to manage it)
4. The webhook URL at Meta remains registered — no need to re-register as long as the ngrok domain is static

### Checking status
```bash
pm2 list                         # all processes
pm2 logs 1dotdev-bridge          # live logs
pm2 monit                        # CPU/RAM dashboard
curl http://localhost:3000/health # health check
```

### Restarting after code changes
```bash
pm2 restart 1dotdev-bridge
pm2 logs 1dotdev-bridge --lines 10
```

### Database backup
```bash
sqlite3 /home/sskgameon/sarvesh1karandikar/1DotDev/bridge/data.db \
  ".backup /tmp/data-backup-$(date +%Y%m%d).db"
# Copy to Windows side if needed:
cp /tmp/data-backup-*.db /mnt/c/Users/<WindowsUser>/Documents/
```

---

## 9. Migrating Production Data from Lightsail

If you want to bring the existing `data.db` from the Lightsail server:

```bash
# On the Lightsail server (run from your local machine):
ssh -i /path/to/openclaw.pem ubuntu@100.49.94.57 \
  "sqlite3 /home/ubuntu/bridge/data.db '.backup /tmp/data-export.db'"
scp -i /path/to/openclaw.pem ubuntu@100.49.94.57:/tmp/data-export.db \
  /home/sskgameon/sarvesh1karandikar/1DotDev/bridge/data.db

# Restart bridge to use the migrated DB:
pm2 restart 1dotdev-bridge
```

---

## 10. Troubleshooting

### Bridge won't start
```bash
pm2 logs 1dotdev-bridge --err --lines 50
```
Common causes:
- Missing .env variable → error message names the missing key
- Port 3000 already in use → `lsof -i :3000`; kill the process
- Node version wrong → `node --version` (need 22+)

### ngrok tunnel not working
```bash
ngrok status
# or check ngrok web inspector at http://localhost:4040
```
Common causes:
- Wrong authtoken → re-run `ngrok config add-authtoken <token>`
- Static domain not claimed → claim it at ngrok dashboard first
- Windows Firewall blocking → unlikely for WSL outbound

### Meta webhook verification fails
- Check `META_WEBHOOK_VERIFY_TOKEN` matches exactly what's in `.env`
- Confirm the bridge is running: `curl http://localhost:3000/health`
- Confirm ngrok is forwarding: `curl https://<domain>/health`

### Messages received but no reply
- Check `ALLOWED_WHATSAPP_NUMBERS` includes the sender's number (no + prefix)
- Check `ANTHROPIC_API_KEY` is valid and not capped
- Check `pm2 logs` for handler errors

### Reminders/digests not firing
- Scheduler logs appear every minute in `pm2 logs`
- If silent: `META_WA_TOKEN` may be expired (shouldn't happen with permanent token)
- Check `META_WA_PHONE_NUMBER_ID` is correct

---

## 11. Cost After Moving Local

| Item | Before (Lightsail) | After (Local) |
|---|---|---|
| AWS Lightsail | $5/mo | $0 |
| AWS SSM | $0 | $0 |
| ngrok free | $0 | $0 |
| Anthropic (Haiku) | ~$0.002/msg | same |
| Meta WhatsApp | $0 (free tier) | $0 (free tier) |
| Electricity | $0 (cloud) | negligible (~$1-2/mo for always-on PC) |
| **Total** | **~$5/mo** | **~$0/mo** |

---

## 12. If You Want nginx Locally (Optional)

ngrok makes nginx unnecessary. But if you want to run nginx locally on WSL (e.g., for local dev
or testing without ngrok), install it and use the config at `infra/nginx/bridge-local.conf`
in this repo. It proxies `localhost:3000` → `localhost:80`. You still need a tunnel for Meta webhooks.

---

## 13. Reference: Environment Variables

| Variable | Required | Source |
|---|---|---|
| `META_WA_TOKEN` | Yes | Meta → System User token |
| `META_WA_PHONE_NUMBER_ID` | Yes | Meta → API Setup |
| `META_WA_BUSINESS_ACCOUNT_ID` | Yes | Meta → Business Settings |
| `META_WEBHOOK_VERIFY_TOKEN` | Yes | You choose (any 32-char string) |
| `META_APP_SECRET` | Yes | Meta → App → Settings → Basic |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Console |
| `ANTHROPIC_MODEL` | No | Default: `claude-haiku-4-5` |
| `ALLOWED_WHATSAPP_NUMBERS` | Yes | Comma-separated, no + |
| `ADMIN_WHATSAPP_NUMBERS` | Yes | Subset of above |
| `PORT` | No | Default: `3000` |
| `AWS_REGION` | **Do NOT set** | Its absence skips SSM — this is intentional |

---

## 14. Quick-Start Checklist

```
[ ] Phase 0: Secrets gathered from Meta + Anthropic + ngrok
[ ] Phase 1: Node 22, PM2, ngrok installed on WSL
[ ] Phase 2: bridge/.env created and populated (no AWS_REGION!), npm install done
[ ] Phase 2: Health check passes on localhost:3000
[ ] Phase 3: PM2 running the bridge (pm2 list shows "online")
[ ] Phase 4: ngrok tunnel running, /health reachable from public URL
[ ] Phase 5: Meta webhook registered and verified
[ ] Phase 6: End-to-end WhatsApp message test passes
```
