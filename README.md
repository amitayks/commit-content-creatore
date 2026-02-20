<p align="center">
  <h1 align="center">🎭 Muse</h1>
  <p align="center"><strong>Your AI Content Partner, Right in Telegram</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
    <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini AI" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Telegram_Bot-26A5E4?style=flat&logo=telegram&logoColor=white" alt="Telegram" />
    <img src="https://img.shields.io/badge/X%2FTwitter-000000?style=flat&logo=x&logoColor=white" alt="X/Twitter" />
  </p>
</p>

---

You ship code. You follow thought leaders. You have ideas.

**Muse turns all of that into polished, ready-to-publish content for X/Twitter** — tweets, threads, images, quote-tweets, even AI avatar videos — and puts you in control through a slick Telegram dashboard.

No browser tabs. No copy-pasting. No context switching. Just push code, review in Telegram, publish with a tap.

---

## What Can Muse Do?

### 🔄 Watch Your Repos — Auto-Generate Content from Code

Connect your GitHub repositories. Every time you merge a PR or push to main, Muse picks it up, understands the change in context, and drafts tweets with AI-generated images — ready for your review.

- **Thread-aware**: Big PRs with 3+ commits become Twitter threads, not a single cramped tweet
- **Project-aware**: Muse maintains a persistent understanding of your project (tech stack, audience, brand voice) and uses it to write content that actually sounds like it belongs to your project
- **Smart images**: AI generates original artwork for your posts — not stock photos, not screenshots — real visual content with structured art direction (style, mood, lighting, color palette)
- **Configurable per repo**: Language, hashtag style, branch filters, image probability, thread thresholds

### 📡 Follow X Accounts — AI-Powered Smart Reposting

Follow any X/Twitter account. Muse polls for new tweets every 15 minutes, scores each one for relevance using AI, and notifies you only about the ones worth reposting.

- **Relevance scoring**: Gemini AI evaluates each tweet (1-10 scale) against the account's persona and your audience
- **Batch notifications**: Paginated cards in Telegram — see score, preview, reason — tap to generate
- **6 tone personalities**: Professional, Casual, Analytical, Enthusiastic, Witty, or Sarcastic — pick the voice that fits
- **Media-aware**: Muse fetches and analyzes images and video thumbnails from tweets before generating, so the AI actually "sees" what the original post is about
- **Thread detection**: Multi-tweet threads are consolidated and analyzed as a whole
- **Auto-approve mode**: Set a threshold and let Muse auto-generate reposts for the highest-scoring tweets
- **Persona analysis**: AI builds a profile of each account you follow — their topics, communication style, recurring themes — for better repost context

### ✍️ Handwrite — Compose with AI Assistance

Have an idea? Write it yourself. Muse gives you a live compose mode with character counts, optional AI text refinement, and image generation.

- **Multi-tweet threads**: Send multiple messages, Muse buffers them into a thread
- **Per-tweet images**: Attach a photo to any tweet in the thread
- **AI refine toggle**: Let Gemini polish your writing while keeping your voice
- **Image toggle**: Generate an AI image or skip it — your call

### 📅 Schedule — Calendar & Time Picker

Queue content for the perfect moment. Visual date picker (next 30 days) and hour/minute selector, all respecting your configured timezone.

- **15-minute cron**: Muse checks every 15 minutes and publishes anything that's due
- **Failure recovery**: If a publish fails, the draft goes back to draft status for retry
- **Dashboard preview**: Home screen shows your next scheduled post at a glance

### 🎬 Video Studio — AI Avatar Videos *(Experimental)*

Turn your commits into narrated video updates with AI-generated avatars. Script generation, character management, emotion control, and multi-platform publishing.

- **AI script generation**: Gemini writes narration + scene descriptions from your commit history
- **Avatar customization**: Choose characters, looks, voices, emotions (Excited, Friendly, Serious, Soothing, Broadcaster)
- **Flexible formats**: 9:16 (Reels/Shorts), 16:9 (YouTube), 1:1 (Feed)
- **Multi-platform**: Publish to X/Twitter, Instagram, or both
- **Presets**: Save video configs as reusable templates

> Video generation is currently powered by HeyGen and will be transitioning to Seedance 2.0 for a fully integrated experience.

### 👥 Multi-Tenant — Bring Your Own Keys

Muse supports multiple users on a single bot instance. Each user goes through a guided onboarding flow and provides their own API keys, which are encrypted at rest with AES-256-GCM.

- **Guided onboarding**: Step-by-step setup for Gemini, X/Twitter, and GitHub keys
- **Per-user encryption**: All API keys are encrypted individually per user in D1
- **Settings UI**: Manage and update keys anytime via Settings > API Keys
- **Optional integrations**: HeyGen and Instagram keys can be added later
- **Isolated data**: Each user's repos, drafts, accounts, and videos are scoped to their chat ID

---

## How It Works

```
┌───────────────────────────────────────────────────────────────────┐
│                          YOUR WORKFLOW                             │
│                                                                   │
│   GitHub Push/PR ──┐                                              │
│                    ▼                                               │
│              ┌───────────┐    ┌───────────┐    ┌──────────────┐  │
│              │ Cloudflare │───▶│  Gemini   │───▶│   Telegram   │  │
│              │  Worker    │    │    AI     │    │  Dashboard   │  │
│              │ (content-  │    │ (content  │    │  (review,    │  │
│              │   bot)     │    │ + images) │    │  approve,    │  │
│              └─────┬─────┘    └───────────┘    │  schedule)   │  │
│                    │                           └──────┬───────┘  │
│   X Account ───────┤  Cron: every 15 min              │          │
│   Tweets           │  • Poll followed accounts        ▼          │
│                    │  • Score with AI          ┌──────────────┐  │
│                    │  • Send notifications     │   X/Twitter  │  │
│                    │  • Publish scheduled       │   Published! │  │
│                    │  • Check stale videos     └──────────────┘  │
│                    │                                              │
│   User Keys ───────┘  Per-user encrypted in D1                   │
└───────────────────────────────────────────────────────────────────┘
```

Muse runs as a **single Cloudflare Worker** (`content-bot`) with a `*/15 * * * *` cron trigger:

| Component | What it does |
|-----------|-------------|
| **HTTP routes** | Telegram webhook, GitHub webhook, HeyGen webhook, media serving, setup, migrations |
| **Cron (every 15 min)** | Polls X accounts, scores tweets, publishes scheduled drafts, checks stale videos, publishes scheduled videos — all users processed in parallel via `Promise.allSettled` |

**Zero dependencies at runtime.** Pure Cloudflare Workers API — no npm packages needed in production. TypeScript compiled to ES modules.

---

## Features at a Glance

| Feature | Description |
|---------|-------------|
| Auto-generate from commits | GitHub webhook triggers AI content + image |
| Smart repost | Follow accounts, AI scores & generates quote-tweets |
| Handwrite mode | Compose tweets manually with optional AI assist |
| Thread detection | Big PRs become multi-tweet threads automatically |
| AI image generation | Structured art direction (style, mood, palette) |
| Media analysis | Analyzes images/video thumbnails in source tweets |
| 6 tone modes | Professional, Casual, Analytical, Enthusiastic, Witty, Sarcastic |
| Scheduling | Calendar + time picker with timezone support |
| Project context | Persistent overview that learns your codebase |
| Persona analysis | AI profiles for followed accounts |
| Auto-approve | Hands-free mode for high-scoring tweets |
| Video Studio | AI avatar videos from commit history |
| Multi-tenant | Multiple users, per-user encrypted API keys |
| Multi-language | English and Hebrew support |
| Per-entity config | Different settings per repo and per account |

---

## Prerequisites

Before you start, you'll need:

- **Cloudflare account** — [Sign up free](https://dash.cloudflare.com/sign-up) (Workers free tier: 100K requests/day)
- **Telegram bot** — Create one via [@BotFather](https://t.me/BotFather) and get the token
- **Node.js 18+** and **npm** (for deployment tooling)

Each user provides their own API keys during onboarding:

- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)
- **X/Twitter API credentials** — Apply at the [Developer Portal](https://developer.x.com/) (OAuth 1.0a with read+write)
- **GitHub personal access token** — [Create one](https://github.com/settings/tokens) with `repo` scope
- *(Optional)* **HeyGen API key** — For Video Studio ([heygen.com](https://heygen.com))
- *(Optional)* **Instagram Business Account** — For video publishing to Instagram

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ozkeisar/MusePostBot.git
cd MusePostBot
```

### 2. Install Dependencies

```bash
cd cloudflare-bot
npm install
```

### 3. Create Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create content-bot-db

# Create R2 bucket
npx wrangler r2 bucket create content-bot-images
```

Take note of the **database ID** returned by the D1 create command.

### 4. Configure Wrangler

Update `cloudflare-bot/wrangler.toml` with your database ID:

```toml
name = "content-bot"
main = "src/index.ts"
compatibility_date = "2024-12-18"

[triggers]
crons = ["*/15 * * * *"]  # Every 15 minutes

[[d1_databases]]
binding = "DB"
database_name = "content-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "content-bot-images"
```

### 5. Set Secrets

Only infrastructure secrets are set as Worker secrets. Per-user API keys (X, Gemini, GitHub, etc.) are provided by each user during onboarding and stored encrypted in D1.

```bash
cd cloudflare-bot

# Required
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID      # Admin's Telegram user ID
npx wrangler secret put ENCRYPTION_KEY         # openssl rand -base64 32
npx wrangler secret put ADMIN_SECRET           # openssl rand -hex 32
npx wrangler secret put WORKER_URL             # https://content-bot.YOUR_SUBDOMAIN.workers.dev

# Optional
npx wrangler secret put MAX_USERS              # Default: 50
```

> **Finding your Telegram Chat ID:** Send any message to your bot, then visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` — your chat ID will be in the response.

### 6. Deploy

```bash
cd cloudflare-bot
npx wrangler deploy
```

### 7. Initialize the Bot

Hit the setup endpoint to register the Telegram webhook and bot commands:

```bash
curl "https://content-bot.YOUR_SUBDOMAIN.workers.dev/setup?secret=YOUR_ADMIN_SECRET"
```

### 8. Run Migrations

```bash
curl "https://content-bot.YOUR_SUBDOMAIN.workers.dev/migrate?secret=YOUR_ADMIN_SECRET"
```

### 9. Set Up GitHub Webhooks

GitHub webhooks are configured **per-user per-repo** through the Telegram dashboard. When a user adds a repo via `/watch owner/repo`, Muse auto-generates a unique webhook secret and provides setup instructions. Each repo has its own webhook secret stored in D1.

In your GitHub repository settings:

1. Go to **Settings > Webhooks > Add webhook**
2. **Payload URL:** `https://content-bot.YOUR_SUBDOMAIN.workers.dev/github-webhook`
3. **Content type:** `application/json`
4. **Secret:** The secret shown by the bot when you added the repo
5. **Events:** Select "Pull requests" and "Pushes"

---

## Configuration

### Worker Secrets Reference

These are the only secrets stored as Cloudflare Worker secrets. All per-user API keys are encrypted in D1.

| Secret | Required | Description |
|--------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Admin's Telegram user ID |
| `ENCRYPTION_KEY` | Yes | 32-byte base64 key for AES-256-GCM encryption (`openssl rand -base64 32`) |
| `ADMIN_SECRET` | Yes | Protects `/setup` and `/migrate` endpoints |
| `WORKER_URL` | Yes | Full URL of this worker (e.g., `https://content-bot.your-subdomain.workers.dev`) |
| `MAX_USERS` | No | Maximum registered users (default: 50) |

### Per-User API Keys (stored encrypted in D1)

Each user provides these through the onboarding flow or Settings > API Keys:

| Key | Required | Description |
|-----|----------|-------------|
| Gemini API key | Yes | Google Gemini for AI content + image generation |
| X API key + secret | Yes | X/Twitter OAuth 1.0a consumer credentials |
| X access token + secret | Yes | X/Twitter OAuth 1.0a access credentials |
| GitHub token | No | PAT with `repo` scope (for auto-generate from commits) |
| HeyGen API key | No | For Video Studio |
| Instagram token + account ID | No | For video publishing to Instagram |

### Repository Settings

Each watched repo has independent configuration, adjustable via the Telegram dashboard:

| Setting | Default | Options |
|---------|---------|---------|
| Language | English | EN / HE |
| Hashtags | On | Toggle |
| Watch PRs | On | Toggle |
| Watch Pushes | Off | Toggle |
| Branches | `main` | Configurable |
| Min commits for thread | 3 | Number |
| Max tweets per thread | 10 | Number |
| Always generate image | On (threads) | Toggle |
| Single tweet image probability | 70% | 0-100% |

### Twitter Account Settings

Each followed X account has independent configuration:

| Setting | Default | Options |
|---------|---------|---------|
| Language | English | EN / HE |
| Tone | Professional | Professional, Casual, Analytical, Enthusiastic, Witty, Sarcastic |
| Hashtags | On | Toggle |
| Relevance threshold | 6/10 | 1-10 |
| Auto-approve | Off | Toggle |
| Batch page size | 5 | Number |
| Media AI | On | Toggle |
| Always generate image | Off | Toggle |
| Image probability | 30% | 0-100% |

---

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Open the dashboard |
| `/help` | Show help and workflow guide |
| `/generate <sha>` | Generate content from a commit SHA or PR number |
| `/repost <url>` | Create a quote-tweet from any X post URL |
| `/handwrite` | Enter compose mode to write tweets manually |
| `/drafts` | Browse all drafts by category |
| `/approve` | Publish all approved drafts now |
| `/schedule` | Schedule a draft for later |
| `/repos` | Manage watched GitHub repositories |
| `/watch <owner/repo>` | Start watching a new repository |
| `/overview <owner/repo>` | Bootstrap project context from README + recent PRs |
| `/delete <sha>` | Delete a published post |

---

## Architecture

```
MusePostBot/
├── cloudflare-bot/                # Single Cloudflare Worker
│   ├── src/
│   │   ├── index.ts               # HTTP router + cron entry point
│   │   ├── types.ts               # Shared type definitions
│   │   ├── core/
│   │   │   ├── router.ts          # Command/callback/input dispatcher
│   │   │   ├── publish.ts         # Tweet/thread/quote-tweet publisher
│   │   │   └── respond.ts         # Telegram response helper
│   │   ├── commands/              # /slash command handlers
│   │   ├── handlers/
│   │   │   ├── cron.ts            # Cron coordinator + per-user cron tasks
│   │   │   ├── callback.ts        # Telegram callback query handler
│   │   │   ├── message.ts         # Telegram message handler
│   │   │   └── github-webhook.ts  # GitHub webhook processing
│   │   ├── actions/               # Callback button handlers
│   │   ├── inputs/                # Text input state handlers
│   │   ├── views/                 # Telegram UI templates
│   │   │   ├── home.ts            # Dashboard home screen
│   │   │   ├── onboarding.ts      # New user onboarding flow
│   │   │   ├── settings.ts        # API keys & settings UI
│   │   │   └── ...                # Drafts, repos, accounts, video views
│   │   ├── services/
│   │   │   ├── gemini.ts          # AI content + image generation
│   │   │   ├── x.ts              # X/Twitter API (OAuth 1.0a)
│   │   │   ├── github.ts         # GitHub API
│   │   │   ├── telegram.ts       # Telegram Bot API
│   │   │   ├── heygen.ts         # HeyGen video API
│   │   │   ├── db.ts             # D1 database operations
│   │   │   ├── user-db.ts        # User/multi-tenant DB operations
│   │   │   ├── user-keys.ts      # Per-user key decryption & env hydration
│   │   │   ├── crypto.ts         # AES-256-GCM encryption/decryption
│   │   │   ├── poller.ts         # Twitter polling pipeline
│   │   │   ├── scoring.ts        # AI relevance scoring
│   │   │   ├── batch-notification.ts # Telegram batch notification cards
│   │   │   ├── auto-approve.ts   # Auto-generate + approve
│   │   │   ├── storage.ts        # R2 image/video storage
│   │   │   ├── video-publish.ts  # Multi-platform video publishing
│   │   │   ├── repost-generate.ts # Repost content generation
│   │   │   ├── persona-*.ts      # Persona analysis & caching
│   │   │   └── security.ts       # Rate limiting, validation, headers
│   │   └── routes/                # HTTP route handlers
│   │       ├── webhook.ts         # Telegram webhook endpoint
│   │       ├── github.ts          # GitHub webhook endpoint
│   │       ├── heygen-webhook.ts  # HeyGen callback endpoint
│   │       ├── setup.ts           # Bot initialization
│   │       ├── migrate.ts         # Database migrations
│   │       └── media.ts           # R2 media serving
│   ├── migrations/                # D1 SQL migrations
│   ├── schema.sql                 # Full database schema
│   └── wrangler.toml
│
└── README.md
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (ES modules) |
| Database | Cloudflare D1 (SQLite) |
| Object Storage | Cloudflare R2 |
| AI | Google Gemini (text + image generation) |
| Bot Interface | Telegram Bot API |
| Social Platform | X/Twitter API v2 + v1.1 (OAuth 1.0a) |
| Video | HeyGen API v2 (transitioning to Seedance 2.0) |
| Encryption | AES-256-GCM (Web Crypto API) |
| Language | TypeScript 5.7 |
| Build | Wrangler |

### Database

Indexed tables across 5 domains:

- **Users**: `users` (identity, encrypted keys, settings, UI state)
- **Content**: `drafts`, `published`, `repos`, `repo_overviews`
- **Twitter**: `twitter_accounts`, `twitter_tweets`, `twitter_account_overviews`
- **Video**: `video_drafts`, `video_published`, `video_presets`
- **System**: `persona_cache`

---

## Self-Hosted Philosophy

Muse is designed to be **your bot, on your infrastructure**:

- **Users own their API keys** — each user provides and manages their own credentials, encrypted at rest with AES-256-GCM
- **You own your data** — everything lives in your D1 database and R2 bucket
- **You control the costs** — Cloudflare's free tier is generous (100K Worker requests/day, 5GB D1, 10GB R2)
- **You decide what publishes** — nothing goes live without approval (unless auto-approve is enabled)
- **Zero vendor lock-in on content** — tweets, drafts, images, all accessible in your database
- **Multi-tenant by design** — one bot instance serves multiple users, each with isolated data

---

## License

MIT
