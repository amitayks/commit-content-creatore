## ADDED Requirements

### Requirement: Separate Cloudflare Worker for Twitter polling
The system SHALL have a dedicated Cloudflare Worker (`twitter-poller`) in a `twitter-poller/` directory at the repo root, with its own `wrangler.toml`, `src/index.ts`, and `tsconfig.json`. It SHALL bind to the same D1 database and R2 bucket as the existing `content-bot` worker.

#### Scenario: Worker configuration
- **WHEN** the twitter-poller worker is deployed
- **THEN** its `wrangler.toml` SHALL reference the same `database_id` and `bucket_name` as content-bot
- **AND** it SHALL have `crons = ["*/15 * * * *"]` for 15-minute polling

#### Scenario: Shared secrets
- **WHEN** the twitter-poller is deployed
- **THEN** it SHALL require the same X API secrets (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`), `GOOGLE_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`

### Requirement: Worker entry point with cron handler
The twitter-poller `src/index.ts` SHALL export a `scheduled()` handler that runs the Twitter polling pipeline. It SHALL NOT handle HTTP requests (no `fetch()` handler needed).

#### Scenario: Cron trigger
- **WHEN** the 15-minute cron fires
- **THEN** the `scheduled()` handler SHALL execute the polling pipeline: fetch accounts → poll timelines → detect threads → score tweets → generate auto-approve drafts → send batch notifications

#### Scenario: No watching accounts
- **WHEN** the cron fires and no accounts have `is_watching=1`
- **THEN** the handler SHALL log "No accounts to poll" and exit

### Requirement: Chunked account processing
The poller SHALL process accounts in chunks of 10 per cron cycle. Chunk assignment SHALL use consistent hashing (account ID based) so each account is polled once per ~60 minutes across 4 cycles.

#### Scenario: 40 accounts across 4 cycles
- **WHEN** 40 accounts are watching
- **THEN** each 15-min cycle SHALL process ~10 accounts
- **AND** each account SHALL be polled approximately once per hour

#### Scenario: Few accounts
- **WHEN** fewer than 10 accounts are watching
- **THEN** all accounts SHALL be processed every cycle (every 15 min)

### Requirement: Env type for twitter-poller
The twitter-poller SHALL define its own `Env` interface with bindings: `DB` (D1Database), `IMAGES` (R2Bucket), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `GOOGLE_API_KEY`.

#### Scenario: Env interface
- **WHEN** the twitter-poller code references `env`
- **THEN** it SHALL use a locally defined `Env` type matching the required bindings
