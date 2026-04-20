# API Keys Collection Guide

## Quick Summary

You need to collect API keys from **4 places**:
1. **Meta (WhatsApp)** — 4 keys
2. **Anthropic (Claude API)** — 1 key
3. **Arr Stack** (Sonarr, Radarr, Lidarr, Prowlarr) — 4 keys
4. **Your WhatsApp number** — 1 number

---

## 1. Meta WhatsApp Cloud API Keys

### Where to Get Them
1. Go to https://developers.facebook.com/
2. Select your Business App
3. Navigate to **WhatsApp** > **Getting Started** or **API Setup**

### The 4 Keys You Need

#### `META_WA_TOKEN` (Permanent System User Token)
```
Location: Settings → System Users
Look for: "PERMANENT" token with "whatsapp_business_messaging" permission
Value format: EAAxxxxxxxxx...
```

#### `META_WA_PHONE_NUMBER_ID`
```
Location: WhatsApp > Getting Started > Phone Number ID
Look for: Your WhatsApp Business Phone Number ID
Value format: 123456789 (digits only, no + or country code)
```

#### `META_WEBHOOK_VERIFY_TOKEN` (You Create This)
```
You can set any random string you want.
Recommendation: Something like: my_drivesuite_secret_2026
This is NOT from Meta, you generate it.
```

#### `META_APP_SECRET`
```
Location: Settings > Basic Information
Look for: App Secret
Note: You may need to click "Show" to reveal it
Value format: abc123def456... (long hex string)
```

---

## 2. Anthropic API Key

### Where to Get It
1. Go to https://console.anthropic.com/
2. Click your profile → **API Keys**
3. Click **Create Key** (or copy existing key)
4. Copy the key that starts with `sk-ant-`

### In .env
```
ANTHROPIC_API_KEY=sk-ant-your_full_key_here
```

---

## 3. Arr Stack API Keys

Open each service in your browser and follow these steps:

### Sonarr (http://localhost:8989)
1. Click **Settings** (gear icon, top-right)
2. Go to **General** tab (left sidebar)
3. Find "API Key" section
4. **Copy the API Key**
5. Paste into `.env`: `SONARR_API_KEY=your_key_here`

### Radarr (http://localhost:7878)
Same process as Sonarr:
1. **Settings** → **General**
2. Find and **copy** API Key
3. Paste into `.env`: `RADARR_API_KEY=your_key_here`

### Lidarr (http://localhost:8686)
Same process as Sonarr:
1. **Settings** → **General**
2. Find and **copy** API Key
3. Paste into `.env`: `LIDARR_API_KEY=your_key_here`

### Prowlarr (http://localhost:9696)
Same process as Sonarr:
1. **Settings** → **General**
2. Find and **copy** API Key
3. Paste into `.env`: `PROWLARR_API_KEY=your_key_here`

---

## 4. WhatsApp Phone Numbers

### Your Primary Number
The phone number you want to **send messages FROM** to test the bot.
```
Format: 16175551234 (country code + number, no + or spaces)
Example for US: 16175551234
Example for India: 919876543210
```

### In .env
```
# This is YOUR phone number (the one you'll message from)
ALLOWED_WHATSAPP_NUMBERS=16175551234

# Same for now, can add more later
ADMIN_WHATSAPP_NUMBERS=16175551234
```

---

## Template: Copy-Paste Format

Once you have all the keys, your `.env` should look like:

```env
# Meta WhatsApp
META_WA_TOKEN=EAAxxxxxxxxx...
META_WA_PHONE_NUMBER_ID=123456789
META_WEBHOOK_VERIFY_TOKEN=my_drivesuite_secret_2026
META_APP_SECRET=abc123def456...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-abc123...

# WhatsApp Numbers
ALLOWED_WHATSAPP_NUMBERS=16175551234
ADMIN_WHATSAPP_NUMBERS=16175551234

# Arr Stack Keys
SONARR_API_KEY=xxxxxxxxxx
RADARR_API_KEY=xxxxxxxxxx
LIDARR_API_KEY=xxxxxxxxxx
PROWLARR_API_KEY=xxxxxxxxxx

# Keep the rest as-is (these point to localhost)
SONARR_URL=http://localhost:8989
RADARR_URL=http://localhost:7878
LIDARR_URL=http://localhost:8686
PROWLARR_URL=http://localhost:9696
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b
SEARXNG_URL=https://searxng.railway.app
PORT=3000
DB_PATH=./data.db
ANTHROPIC_MODEL=claude-opus-4-7
USE_LOCAL_ANALYZER=true
LOCAL_MODEL_FALLBACK=haiku
```

---

## Next Steps After Collecting Keys

1. **Update `.env`** with all your API keys
2. **Verify Ollama is installed** on Windows with `ollama pull llama3:8b`
3. **Start the bridge**: `npm start` (from `bridge/` directory)
4. **Set up ngrok**: Expose the bridge to internet for WhatsApp webhook
5. **Configure Meta webhook** pointing to your ngrok URL

---

## Troubleshooting

**Can't find API Key in Sonarr/Radarr?**
- Make sure you're clicking "Settings" (gear icon)
- Some versions hide it under a "Security" or "Authentication" subsection
- Refresh the page if it doesn't appear

**WhatsApp number format wrong?**
- Remove all spaces, dashes, parentheses
- Include country code: US=1, India=91, UK=44, etc.
- Example: `16175551234` not `+1 617-555-1234`

**Meta keys not found?**
- Make sure you have a Meta Business App (not personal)
- You need "WhatsApp" product added to your app
- Try https://developers.facebook.com/ → your app → WhatsApp Setup

