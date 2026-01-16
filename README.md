# Commit Content Tracker

**AI-powered content generation from GitHub commits to X (Twitter) threads.**

Transform your code commits and PRs into engaging developer content automatically. Get notified via Telegram, review and approve drafts, then publish to X - all without leaving your chat app.

## Features

- **GitHub Integration** - Webhooks for PR merges and pushes with signature verification
- **AI Content Generation** - Grok AI creates natural, engaging threads with auto-generated images
- **Telegram Bot** - Review, edit, approve, or reject drafts with inline buttons
- **X Publishing** - Automatic thread posting with media support
- **Repo Watching** - Auto-detect new PRs/pushes via GitHub webhooks
- **Per-Repo Config** - Different tones, languages, and styles per repository
- **Draft Workflow** - Nothing publishes without your approval
- **Security Hardened** - User authorization, rate limiting, secure logging

## Architecture

```
Add Repo --> Create GitHub Webhook --> Watch for Events
                                            |
                                            v
GitHub Push/PR --> Webhook --> AI Generation --> Draft Created
                                                      |
                                                      v
                              Telegram Notification <--+
                                      |
                    +-----------------+-----------------+
                    |                 |                 |
                [Approve]         [Reject]          [Edit]
                    |                 |                 |
                    v                 v                 v
              Publish to X        Archive       Update draft
```

**Stack:** Cloudflare Workers + D1 Database + R2 Storage + Telegram Bot API + Grok AI + X API

## Quick Start

### 1. Deploy to Cloudflare

```bash
cd cloudflare-bot
npm install
npx wrangler d1 create content-bot-db
npx wrangler r2 bucket create content-bot-images
# Update wrangler.toml with your database ID
npx wrangler deploy
```

### 2. Configure Secrets

```bash
# Required secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN    # From @BotFather
npx wrangler secret put TELEGRAM_CHAT_ID      # Your authorized Telegram user ID
npx wrangler secret put GITHUB_TOKEN          # Needs admin:repo_hook scope
npx wrangler secret put GITHUB_WEBHOOK_SECRET # openssl rand -hex 32
npx wrangler secret put GROK_API_KEY          # X.ai API key
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET

# Security secret (required for admin endpoints)
npx wrangler secret put ADMIN_SECRET          # openssl rand -hex 32
```

### 3. Set Up Telegram Webhook

```bash
curl -X POST https://your-worker.workers.dev/setup \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

### 4. Run Database Migration

```bash
curl -X POST https://your-worker.workers.dev/migrate \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Open the dashboard |
| `/repos` | View watched repositories |
| `/watch owner/repo` | Add a repo to watch |
| `/generate SHA` | Generate content from a commit |
| `/drafts` | View pending drafts |
| `/approve` | Publish all approved drafts |
| `/help` | Show available commands |

## Repo Watching

The bot can automatically watch GitHub repositories for new PRs and pushes:

1. **Add a repo**: `/watch username/repository`
2. **Webhook is created automatically** on GitHub
3. **When PRs are merged**: Content is auto-generated and sent for approval
4. **Configure per-repo settings** via the Telegram bot interface

## Per-Repo Configuration

Each watched repository can have its own settings:

| Setting | Options | Default |
|---------|---------|---------|
| Tone | professional, casual, technical | professional |
| Language | en, he | en |
| Hashtags | on/off | on |
| Watch PRs | on/off | on |
| Watch Pushes | on/off | off |
| Branches | array of branch names | ["main"] |
| Code Context | metadata, with_diff, with_files, with_content | with_diff |
| Thread Image | always/off | always |
| Single Tweet Image | 0-100% probability | 70% |

## Security Features

### User Authorization
- Only your authorized Telegram account can interact with the bot
- Unauthorized users receive a generic rejection message
- All database operations verify ownership via `chat_id`

### Admin Endpoint Protection
- `/setup` and `/migrate` endpoints require `X-Admin-Secret` header
- Uses timing-safe comparison to prevent timing attacks

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| `/webhook` (Telegram) | 100 req/min |
| `/github-webhook` | 30 req/min |
| `/setup`, `/migrate` | 5 req/min |
| `/image/*` | 50 req/min |

### Additional Security
- GitHub webhook signature verification (HMAC-SHA256)
- Secure logging with automatic credential redaction
- Security headers on all responses (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- R2 path traversal prevention
- Sanitized error messages (no internal details exposed)

## Project Structure

```
cloudflare-bot/
├── src/
│   ├── index.ts              # Main entry point, routing, middleware
│   ├── types.ts              # TypeScript types and interfaces
│   ├── handlers/
│   │   ├── message.ts        # Text message handling
│   │   ├── callback.ts       # Button click handling
│   │   ├── github-webhook.ts # GitHub webhook processing
│   │   └── cron.ts           # Scheduled publishing
│   ├── services/
│   │   ├── db.ts             # D1 database operations (ownership-aware)
│   │   ├── security.ts       # Auth, rate limiting, validation, logging
│   │   ├── telegram.ts       # Telegram Bot API
│   │   ├── github.ts         # GitHub API
│   │   ├── grok.ts           # AI content & image generation
│   │   ├── x.ts              # Twitter/X publishing
│   │   └── webhook.ts        # GitHub webhook management
│   └── views/
│       └── index.ts          # Telegram UI renderers
├── wrangler.toml             # Cloudflare configuration
└── package.json
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/webhook` | POST | Telegram User | Telegram bot webhook |
| `/github-webhook` | POST | GitHub Signature | GitHub event webhook |
| `/setup` | POST | Admin Secret | Configure Telegram webhook |
| `/migrate` | POST | Admin Secret | Run database migrations |
| `/image/:key` | GET | Signed URL | Serve draft images |

## Development

```bash
cd cloudflare-bot

# Type check
npx tsc --noEmit

# Local development (with local D1)
npx wrangler dev

# Deploy to production
npx wrangler deploy

# View logs
npx wrangler tail
```

## Environment Variables

See `.env.example` for all required secrets:

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# AI
GROK_API_KEY=your_grok_api_key

# X (Twitter)
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_SECRET=your_access_secret

# Security
ADMIN_SECRET=your_admin_secret
```

## License

MIT

---

Built with TypeScript, Cloudflare Workers, Grok AI, and care for security.
