# Quick Setup Reference

This is the condensed execution guide. Read PLAN.md first for the full context.

## Prereqs (human collects these before starting)

- Meta developer account + 1DotDev app credentials
- Anthropic API key (with $5/mo spend cap set in console)
- ngrok free account → claim 1 free static domain at ngrok.com

## Step 1 — Install tools

```bash
# Node 22
node --version || (curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs)

# PM2
npm install -g pm2

# ngrok
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install -y ngrok

# Authenticate ngrok (replace with your token from ngrok.com/dashboard)
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
```

## Step 2 — Configure bridge

```bash
cd /home/sskgameon/sarvesh1karandikar/1DotDev/bridge

# Install deps
npm install

# Create .env from template
cp /home/sskgameon/sarvesh1karandikar/1DotDev-Local/.env.local.example .env
chmod 600 .env
# FILL IN all values in .env — do NOT add AWS_REGION
```

## Step 3 — Test bridge locally

```bash
node server.js &
curl http://localhost:3000/health    # → {"ok":true}
kill %1
```

## Step 4 — Start bridge via PM2

```bash
# Create logs dir
mkdir -p /home/sskgameon/sarvesh1karandikar/1DotDev/logs

# Copy PM2 config
mkdir -p /home/sskgameon/sarvesh1karandikar/1DotDev/infra/pm2
cp /home/sskgameon/sarvesh1karandikar/1DotDev-Local/infra/pm2.config.cjs \
   /home/sskgameon/sarvesh1karandikar/1DotDev/infra/pm2/ecosystem.config.cjs

# Start
cd /home/sskgameon/sarvesh1karandikar/1DotDev/bridge
pm2 start ../infra/pm2/ecosystem.config.cjs
pm2 save
pm2 startup   # run the printed sudo command
```

## Step 5 — Start ngrok tunnel

```bash
# Replace <your-static-domain> with your ngrok free domain
ngrok http 3000 --domain=<your-static-domain> &

# Verify public access:
curl https://<your-static-domain>/health    # → {"ok":true}
```

## Step 6 — Register webhook with Meta (browser)

1. `developers.facebook.com/apps` → 1DotDev → WhatsApp → Configuration
2. Webhook → Edit
3. Callback URL: `https://<your-static-domain>/webhook`
4. Verify token: value of `META_WEBHOOK_VERIFY_TOKEN` from your `.env`
5. Click Verify and save → subscribe to `messages`

## Step 7 — End-to-end test

Send a WhatsApp message from an allowed number → watch `pm2 logs 1dotdev-bridge`

## Daily ops

| Task | Command |
|---|---|
| View logs | `pm2 logs 1dotdev-bridge` |
| Restart bridge | `pm2 restart 1dotdev-bridge` |
| Bridge status | `pm2 list` |
| Health check | `curl http://localhost:3000/health` |
| Stop everything | `pm2 stop all` |
