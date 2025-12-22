# Telegram Webhook Worker

Cloudflare Worker that receives Telegram webhooks and triggers GitHub Actions.

## Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Deploy the Worker

```bash
cd cloudflare-worker
npm install
wrangler deploy
```

### 3. Set Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your bot token

wrangler secret put GITHUB_TOKEN
# Paste your GitHub PAT with repo scope

wrangler secret put GITHUB_REPO
# Enter: amitayks/commit-content-creatore
```

### 4. Register Webhook with Telegram

Visit in your browser:
```
https://your-worker.your-subdomain.workers.dev/setup
```

This will automatically register the webhook URL with Telegram.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/telegram-webhook` | POST | Receives Telegram updates |
| `/setup` | GET | Registers webhook with Telegram |

## How It Works

```
Telegram → Cloudflare Worker → GitHub repository_dispatch → GitHub Actions
```

1. User sends command/clicks button in Telegram
2. Telegram sends update to Cloudflare Worker
3. Worker triggers GitHub `repository_dispatch` event
4. GitHub Actions runs `telegram-handler.yml` workflow
5. Workflow processes the command and responds
