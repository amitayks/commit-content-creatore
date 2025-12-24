# 🚀 Commit Content Tracker

**AI-powered content generation from GitHub commits to X (Twitter) threads.**

Transform your code commits and PRs into engaging developer content automatically. Get notified via Telegram, review and approve drafts, then publish to X - all without leaving your chat app.

## ✨ Features

- **🔗 GitHub Integration** - Webhooks for PR merges and pushes
- **🤖 AI Content Generation** - Grok AI creates natural, engaging threads
- **💬 Telegram Bot** - Review, edit, approve, or reject drafts
- **🐦 X Publishing** - Automatic thread posting with rate limit handling
- **📦 Repo Watching** - Auto-detect new PRs/pushes via GitHub webhooks
- **⚙️ Per-Repo Config** - Different tones and styles per repository
- **📋 Draft Workflow** - Nothing publishes without your approval

## 🏗️ Architecture

### Cloudflare Worker (Primary)

```
Add Repo → Create GitHub Webhook → Watch for Events
                                        ↓
GitHub Push/PR → Webhook → AI Generation → Draft Created
                                               ↓
Telegram Notification ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
        ↓
   [Approve] → Publish to X
   [Reject]  → Archive
   [Edit]    → Update draft
   [Regen]   → New AI generation
```

**Stack:** Cloudflare Workers + D1 Database + Telegram Bot API

## 🚀 Quick Start (Cloudflare Bot)

### 1. Deploy to Cloudflare

```bash
cd cloudflare-bot
npm install
npx wrangler d1 create content-bot-db
# Update wrangler.toml with your database ID
npx wrangler deploy
```

### 2. Configure Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put GITHUB_TOKEN          # needs admin:repo_hook scope
npx wrangler secret put GITHUB_WEBHOOK_SECRET # openssl rand -hex 32
npx wrangler secret put GROK_API_KEY
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET
```

### 3. Set Up Telegram Webhook

Visit: `https://your-worker.workers.dev/setup`

### 4. Run Database Migration

Visit: `https://your-worker.workers.dev/migrate`

## 📱 Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Open the dashboard |
| `/repos` | View watched repositories |
| `/watch owner/repo` | Add a repo to watch |
| `/generate SHA` | Generate content from a commit |
| `/drafts` | View pending drafts |
| `/publish` | Publish all approved drafts |
| `/help` | Show available commands |

## 📦 Repo Watching

The bot can automatically watch GitHub repositories for new PRs and pushes:

1. **Add a repo**: `/watch username/repository`
2. **Webhook is created automatically** on GitHub
3. **When PRs are merged**: Content is auto-generated and sent for approval
4. **Configure per-repo settings**:
   - Tone (professional/casual/technical)
   - Include hashtags
   - Watch PRs / Watch pushes
   - Target branches

## 📁 Project Structure

```
cloudflare-bot/           # Cloudflare Worker implementation
├── src/
│   ├── index.ts          # Main entry point
│   ├── types.ts          # TypeScript types
│   ├── handlers/         # Request handlers
│   │   ├── message.ts    # Text message handling
│   │   ├── callback.ts   # Button click handling
│   │   ├── github-webhook.ts # GitHub webhook processing
│   │   └── cron.ts       # Scheduled tasks
│   ├── services/         # Core services
│   │   ├── db.ts         # D1 database operations
│   │   ├── telegram.ts   # Telegram API
│   │   ├── github.ts     # GitHub API
│   │   ├── grok.ts       # AI content generation
│   │   ├── x.ts          # Twitter/X publishing
│   │   └── webhook.ts    # Webhook management
│   └── views/            # UI renderers
│       └── index.ts      # All Telegram views
├── schema.sql            # D1 database schema
├── wrangler.toml         # Cloudflare config
└── package.json
```

## ⚙️ Per-Repo Configuration

Each watched repository can have its own settings:

| Setting | Options | Default |
|---------|---------|---------|
| Tone | professional, casual, technical | professional |
| Hashtags | true/false | true |
| Watch PRs | true/false | true |
| Watch Pushes | true/false | false |
| Branches | array of branch names | ["main"] |
| Platform | x | x |

## 🔧 Development

```bash
cd cloudflare-bot

# Type check
npx tsc --noEmit

# Local development
npx wrangler dev

# Deploy
npx wrangler deploy
```

## 📝 License

MIT

---

Built with TypeScript, Cloudflare Workers, Grok AI, and ❤️
