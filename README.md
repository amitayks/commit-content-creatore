# 🚀 Commit Content Tracker

**AI-powered content generation from GitHub commits to X (Twitter) threads.**

Transform your code commits and PRs into engaging developer content automatically. Get notified via Telegram, review and approve drafts, then publish to X - all without leaving your chat app.

## ✨ Features

- **🔗 GitHub Integration** - Webhooks for PR merges and pushes
- **🤖 AI Content Generation** - Grok AI creates natural, engaging threads
- **💬 Telegram Bot** - Review, edit, approve, or reject drafts
- **🐦 X Publishing** - Automatic thread posting with rate limit handling
- **⚙️ Per-Project Config** - Different tones and styles per repository
- **📦 Draft Workflow** - Nothing publishes without your approval

## 🏗️ Architecture

```
GitHub Push/PR → Webhook → AI Generation → Draft Created
                                              ↓
Telegram Notification ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
        ↓
   [Approve] → Publish to X
   [Reject]  → Archive
   [Edit]    → Update draft
   [Regen]   → New AI generation
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/commit-content-tracker.git
cd commit-content-tracker
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

**Required API Keys:**
- **Grok API** - Get from [xAI Console](https://console.x.ai/)
- **GitHub Token** - Personal access token with `repo` scope
- **X API** - Developer account at [developer.x.com](https://developer.x.com/)
- **Telegram Bot** - Create via [@BotFather](https://t.me/botfather)

### 3. Create Project Config

Create `config/projects/your-project.yaml`:

```yaml
project:
  id: my-project
  name: My Project
  repository: username/repo-name

triggers:
  branches:
    - main
  events:
    - pr_merged
    - push

content:
  types:
    - technical
    - feature
  tone: professional-casual

formatting:
  hashtags:
    always:
      - "#DevLife"
    project:
      - "#MyProject"
  emojis: true
```

### 4. Set Up GitHub Secrets

Add these secrets to your repository:

| Secret | Description |
|--------|-------------|
| `GROK_API_KEY` | xAI Grok API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `X_API_KEY` | X API consumer key |
| `X_API_SECRET` | X API consumer secret |
| `X_ACCESS_TOKEN` | X access token |
| `X_ACCESS_SECRET` | X access token secret |

### 5. Enable GitHub Actions

The workflows will automatically:
- Generate content on push/PR merge
- Publish approved drafts every 4 hours
- Handle Telegram bot interactions

## 📱 Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/pending` | List drafts waiting for review |
| `/approved` | List approved drafts in queue |
| `/stats` | Show content statistics |
| `/publish` | Publish next approved draft |
| `/help` | Show available commands |

**Editing a draft:** Reply to a draft preview with `1: New text here` to edit tweet #1.

## 📁 Project Structure

```
commit-content-tracker/
├── .github/workflows/       # GitHub Actions
│   ├── generate-content.yml # Content generation on push/PR
│   ├── publish-drafts.yml   # Scheduled publishing
│   └── telegram-handler.yml # Bot update handling
├── src/
│   ├── services/            # Core services
│   │   ├── github.service.ts
│   │   ├── grok.service.ts
│   │   ├── telegram.service.ts
│   │   ├── x.service.ts
│   │   ├── storage.service.ts
│   │   └── config.service.ts
│   ├── workflows/           # Entry points
│   │   ├── generate-content.ts
│   │   ├── telegram-handler.ts
│   │   └── publish-drafts.ts
│   ├── types/               # TypeScript types
│   └── utils/               # Logger, retry
├── config/
│   └── projects/            # Project configs
├── data/
│   ├── drafts/              # Pending drafts
│   └── published/           # Archived content
└── package.json
```

## ⚙️ Configuration Options

### Content Types
- `technical` - Deep dives into code patterns
- `feature` - What the change accomplishes
- `learning` - Tech discoveries and tools
- `mixed` - AI decides based on context

### Tone Settings
- `formal` - Professional, business-like
- `casual` - Friendly, conversational
- `technical` - Code-focused, detailed
- `enthusiastic` - Excited, energetic
- `professional-casual` - Balanced (recommended)

### Thread Settings
- `minCommitsForThread: 3` - When to create threads vs single tweets
- `maxTweets: 10` - Maximum thread length
- `alwaysGenerateImage: true` - AI images for threads
- `singleTweetImageProbability: 0.7` - Image chance for singles

## 🔧 Development

```bash
# Type check
npm run typecheck

# Lint (Biome)
npm run lint

# Fix lint issues
npm run lint:fix

# Run locally (polling mode for Telegram)
npm run telegram
```

## 📝 License

MIT

---

Built with TypeScript, Grok AI, and ❤️
