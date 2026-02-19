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

- **Hourly cron**: Muse checks every hour and publishes anything that's due
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

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                          YOUR WORKFLOW                                │
│                                                                      │
│   GitHub Push/PR ──┐                                                 │
│                    ▼                                                  │
│              ┌───────────┐    ┌───────────┐    ┌──────────────┐     │
│              │ Cloudflare │───▶│  Gemini   │───▶│   Telegram   │     │
│              │  Worker    │    │    AI     │    │  Dashboard   │     │
│              │ (content-  │    │ (content  │    │  (review,    │     │
│              │   bot)     │    │ + images) │    │  approve,    │     │
│              └───────────┘    └───────────┘    │  schedule)   │     │
│                    ▲                           └──────┬───────┘     │
│   X Account ──────┘                                  │              │
│   Tweets      ▲                                      ▼              │
│               │           ┌───────────┐    ┌──────────────┐        │
│               └───────────│  Poller   │    │   X/Twitter  │        │
│                           │  Worker   │    │   Published! │        │
│                           │ (every    │    └──────────────┘        │
│                           │  15 min)  │                             │
│                           └───────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

Muse runs as **two Cloudflare Workers** sharing a single D1 database:

| Worker | Role | Schedule |
|--------|------|----------|
| **content-bot** | Handles all Telegram interactions, GitHub webhooks, content generation, publishing, scheduling, video studio | Hourly cron (publish scheduled posts) |
| **twitter-poller** | Polls followed X accounts, scores tweets, sends batch notifications, auto-approves | Every 15 minutes |

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
| Multi-language | English and Hebrew support |
| Per-entity config | Different settings per repo and per account |

---

## Prerequisites

Before you start, you'll need:

- **Cloudflare account** — [Sign up free](https://dash.cloudflare.com/sign-up) (Workers free tier: 100K requests/day)
- **Telegram bot** — Create one via [@BotFather](https://t.me/BotFather) and get the token
- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)
- **X/Twitter API credentials** — Apply at the [Developer Portal](https://developer.x.com/) (OAuth 1.0a with read+write)
- **GitHub personal access token** — [Create one](https://github.com/settings/tokens) with `repo` scope
- **Node.js 18+** and **npm** (for deployment tooling)
- *(Optional)* **HeyGen API key** — For Video Studio ([heygen.com](https://heygen.com))
- *(Optional)* **Instagram Business Account** — For video publishing to Instagram

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/commit-content-creatore.git
cd commit-content-creatore
```

### 2. Install Dependencies

```bash
# Content bot (main worker)
cd cloudflare-bot
npm install

# Twitter poller (background worker)
cd ../twitter-poller
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

Update both `wrangler.toml` files with your database ID:

**`cloudflare-bot/wrangler.toml`**
```toml
name = "content-bot"
main = "src/index.ts"
compatibility_date = "2024-12-02"

[triggers]
crons = ["0 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "content-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "content-bot-images"
```

**`twitter-poller/wrangler.toml`**
```toml
name = "twitter-poller"
main = "src/index.ts"
compatibility_date = "2024-12-02"

[triggers]
crons = ["*/15 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "content-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 5. Set Secrets

Set secrets for both workers. Run each command from the respective worker directory:

```bash
# === content-bot secrets ===
cd cloudflare-bot

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GITHUB_WEBHOOK_SECRET
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET
npx wrangler secret put ADMIN_SECRET

# Optional (for Video Studio)
npx wrangler secret put HEYGEN_API_KEY

# Optional (for Instagram video publishing)
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
npx wrangler secret put INSTAGRAM_BUSINESS_ACCOUNT_ID
```

```bash
# === twitter-poller secrets ===
cd twitter-poller

npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET
```

> **Finding your Telegram Chat ID:** Send any message to your bot, then visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` — your chat ID will be in the response.

### 6. Run Migrations

```bash
cd cloudflare-bot

# Apply schema
npx wrangler d1 execute content-bot-db --remote --file=schema.sql

# Apply migrations
npx wrangler d1 execute content-bot-db --remote --file=migrations/001_twitter_repost.sql
npx wrangler d1 execute content-bot-db --remote --file=migrations/002_persona_cache.sql
npx wrangler d1 execute content-bot-db --remote --file=migrations/003_tweet_media_url.sql
```

### 7. Deploy Both Workers

```bash
# Deploy content bot
cd cloudflare-bot
npx wrangler deploy

# Deploy twitter poller
cd ../twitter-poller
npx wrangler deploy
```

### 8. Register Telegram Webhook

After deploying, register the webhook so Telegram sends updates to your worker:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://content-bot.YOUR_SUBDOMAIN.workers.dev/webhook"}'
```

### 9. Initialize the Bot

Hit the setup endpoint to create database tables and register bot commands:

```bash
curl "https://content-bot.YOUR_SUBDOMAIN.workers.dev/setup?secret=YOUR_ADMIN_SECRET"
```

### 10. Set Up GitHub Webhook *(for auto-generate)*

In your GitHub repository settings:

1. Go to **Settings > Webhooks > Add webhook**
2. **Payload URL:** `https://content-bot.YOUR_SUBDOMAIN.workers.dev/github-webhook`
3. **Content type:** `application/json`
4. **Secret:** Same value as `GITHUB_WEBHOOK_SECRET`
5. **Events:** Select "Pull requests" and "Pushes"

---

## Configuration

### Environment Variables Reference

| Secret | Worker(s) | Required | Description |
|--------|-----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Both | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Both | Yes | Your Telegram user ID |
| `GOOGLE_API_KEY` | Both | Yes | Gemini API key |
| `X_API_KEY` | Both | Yes | X/Twitter OAuth consumer key |
| `X_API_SECRET` | Both | Yes | X/Twitter OAuth consumer secret |
| `X_ACCESS_TOKEN` | Both | Yes | X/Twitter OAuth access token |
| `X_ACCESS_SECRET` | Both | Yes | X/Twitter OAuth access token secret |
| `GITHUB_TOKEN` | content-bot | Yes | GitHub PAT with repo scope |
| `GITHUB_WEBHOOK_SECRET` | content-bot | Yes | HMAC secret for webhook verification |
| `ADMIN_SECRET` | content-bot | Recommended | Protects `/setup` and `/migrate` endpoints |
| `HEYGEN_API_KEY` | content-bot | No | HeyGen API key (Video Studio) |
| `INSTAGRAM_ACCESS_TOKEN` | content-bot | No | Instagram Graph API token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | content-bot | No | Instagram business account ID |

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
commit-content-creatore/
├── cloudflare-bot/                # Main Telegram bot worker
│   ├── src/
│   │   ├── index.ts               # HTTP router + cron handler
│   │   ├── core/
│   │   │   ├── router.ts          # Command/callback/input dispatcher
│   │   │   ├── publish.ts         # Tweet/thread/quote-tweet publisher
│   │   │   └── respond.ts         # Telegram response helper
│   │   ├── commands/              # /slash command handlers
│   │   ├── actions/               # Callback button handlers (65+)
│   │   ├── inputs/                # Text input state handlers
│   │   ├── services/
│   │   │   ├── gemini.ts          # AI content + image generation
│   │   │   ├── x.ts              # X/Twitter API (OAuth 1.0a)
│   │   │   ├── github.ts         # GitHub API
│   │   │   ├── telegram.ts       # Telegram Bot API
│   │   │   ├── heygen.ts         # HeyGen video API
│   │   │   ├── db.ts             # D1 database operations (50+ functions)
│   │   │   ├── storage.ts        # R2 image storage
│   │   │   ├── repost-generate.ts # Repost content generation
│   │   │   ├── persona-*.ts      # Persona analysis & caching
│   │   │   └── security.ts       # Rate limiting, validation
│   │   ├── views/                 # Telegram UI templates
│   │   └── types.ts               # Shared type definitions
│   ├── migrations/                # D1 SQL migrations
│   ├── schema.sql                 # Full database schema
│   └── wrangler.toml
│
├── twitter-poller/                # Background polling worker
│   ├── src/
│   │   ├── index.ts               # Cron entry point
│   │   └── services/
│   │       ├── poller.ts          # Main polling pipeline
│   │       ├── x-read.ts         # X API read operations
│   │       ├── scoring.ts        # AI relevance scoring
│   │       ├── batch-notification.ts # Telegram batch cards
│   │       ├── auto-approve.ts   # Auto-generate + approve
│   │       ├── repost-generate.ts # Content generation
│   │       ├── db.ts             # Database operations
│   │       └── telegram.ts       # Notification sender
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
| Language | TypeScript 5.7 |
| Build | Wrangler |

### Database

30+ indexed tables across 4 domains:

- **Content**: `drafts`, `published`, `repos`, `repo_overviews`
- **Twitter**: `twitter_accounts`, `twitter_tweets`, `twitter_account_overviews`
- **Video**: `video_drafts`, `video_published`, `video_presets`
- **System**: `chat_state`, `persona_cache`

---

## Self-Hosted Philosophy

Muse is designed to be **your bot, on your infrastructure**:

- **You own your API keys** — credentials never leave your Cloudflare account
- **You own your data** — everything lives in your D1 database and R2 bucket
- **You control the costs** — Cloudflare's free tier is generous (100K Worker requests/day, 5GB D1, 10GB R2)
- **You decide what publishes** — nothing goes live without your approval (unless you enable auto-approve)
- **Zero vendor lock-in on content** — your tweets, your drafts, your images, all accessible in your database

---

## License

MIT
