### Requirement: HTTP route handlers extracted from index.ts
Each HTTP route handler SHALL be in its own file under `routes/` directory. `index.ts` SHALL only contain the `fetch()` and `scheduled()` entry points with route matching that delegates to the route handlers.

#### Scenario: Telegram webhook route
- **WHEN** a POST request arrives at `/webhook`
- **THEN** `index.ts` delegates to `routes/webhook.ts` which handles parsing, authorization, and routing to the command dispatch system

#### Scenario: GitHub webhook route
- **WHEN** a POST request arrives at `/github-webhook`
- **THEN** `index.ts` delegates to `routes/github.ts`

#### Scenario: Setup route
- **WHEN** a request arrives at `/setup`
- **THEN** `index.ts` delegates to `routes/setup.ts` which verifies admin secret and sets up the Telegram webhook

#### Scenario: Migrate route
- **WHEN** a request arrives at `/migrate`
- **THEN** `index.ts` delegates to `routes/migrate.ts`

#### Scenario: Image route
- **WHEN** a request arrives at `/image/*`
- **THEN** `index.ts` delegates to `routes/image.ts` which validates the R2 key and serves the image

#### Scenario: Test routes
- **WHEN** a request arrives at `/test-x` or `/test-generate`
- **THEN** `index.ts` delegates to the corresponding route file in `routes/`

### Requirement: index.ts becomes a thin routing shell
The main `index.ts` SHALL contain only: the `fetch()` method with URL matching and delegation to route files, the `scheduled()` cron handler, and rate limiting logic. All handler implementations SHALL live in `routes/`.

#### Scenario: index.ts size
- **WHEN** the refactor is complete
- **THEN** `index.ts` SHALL be under 80 lines, containing only route matching, rate limiting, and delegation

### Requirement: Rate limiting stays in index.ts
Rate limiting logic (checking `checkRateLimit`, returning `rateLimitResponse`, adding `addRateLimitHeaders`) SHALL remain in `index.ts` since it applies before route handlers execute.

#### Scenario: Rate-limited request
- **WHEN** a request exceeds the rate limit
- **THEN** `index.ts` returns the rate limit response before the route handler is invoked

### Requirement: Account callback handler in router
The router SHALL register an `account` callback handler that dispatches `account:ACCOUNT_ID` callbacks to `accountDetailAction`, rendering the account detail view.

#### Scenario: Account detail navigation
- **WHEN** user clicks an account button with `callback_data: 'account:ABC123'`
- **THEN** the router SHALL dispatch to `accountDetailAction` with `value='ABC123'`

### Requirement: Account-related action sub-handlers
The router SHALL register action sub-handlers for account operations: `add_account` (show add prompt), `tw_gen` (generate repost draft from tweet), `tw_follow` (start watching), `tw_unfollow` (stop watching), `tw_delete` (delete account), `tw_delete_yes` (confirm delete), `tw_bootstrap` (bootstrap persona).

#### Scenario: Generate repost from batch notification
- **WHEN** user clicks [Generate] with `callback_data: 'action:tw_gen:TWEET_ID'`
- **THEN** the router SHALL dispatch to the tweet generate handler

#### Scenario: Delete account with confirmation
- **WHEN** user clicks delete on account detail
- **THEN** `action:tw_delete:ACCOUNT_ID` shows confirmation
- **AND** `action:tw_delete_yes:ACCOUNT_ID` performs the deletion

### Requirement: Account config toggle handler
The router SHALL register `tw_config` callback handler for toggling account settings. Format: `tw_config:SETTING:ACCOUNT_ID`. Settings: `language`, `hashtags`, `img`, `img_pct`, `threshold`, `tone`, `auto_approve`.

#### Scenario: Toggle threshold
- **WHEN** callback `tw_config:threshold:ABC123` is received
- **THEN** the handler SHALL increment the threshold by 1 (wrapping 10→1) and re-render account detail

#### Scenario: Toggle tone
- **WHEN** callback `tw_config:tone:ABC123` is received
- **THEN** the handler SHALL cycle through tone options and re-render

### Requirement: View change handler for accounts
The view change handler SHALL support `view:accounts` (render accounts list), `view:account_add` (render add account prompt), and `view:drafts_repost` (render repost drafts list).

#### Scenario: Navigate to accounts
- **WHEN** `view:accounts` callback is received
- **THEN** the handler SHALL render `renderAccountsList(env, chatId)`

#### Scenario: Navigate to repost drafts
- **WHEN** `view:drafts_repost` callback is received
- **THEN** the handler SHALL render `renderDraftsList(env, chatId, 0, 'repost', pageSize)`

### Requirement: Account input handler for add flow
The router SHALL register an input handler for `add_account` awaiting_input context. When the user sends text while in this state, it SHALL be processed as a Twitter username to follow.

#### Scenario: Username input received
- **WHEN** user sends "@vercel" while `awaiting_input='add_account'`
- **THEN** the input handler SHALL strip @, validate via X API lookup, create the account, and render the accounts list

#### Scenario: Invalid username
- **WHEN** user sends an invalid username that X API rejects
- **THEN** the input handler SHALL show an error and re-prompt

### Requirement: Pagination handler for accounts
The existing pagination handler SHALL support `page:accounts:N` callbacks, rendering `renderAccountsList(env, chatId, page)`.

#### Scenario: Accounts page navigation
- **WHEN** callback `page:accounts:2` is received
- **THEN** the handler SHALL render accounts list page 2

### Requirement: Schedule day picker action handler
The router SHALL register `sched_day` action handler for the day picker. Format: `action:sched_day:DRAFT_ID:YYYY-MM-DD`. It SHALL store the selected date in context and prompt for time input.

#### Scenario: Day selected
- **WHEN** callback `action:sched_day:DRAFT123:2026-02-21` is received
- **THEN** the handler SHALL update chat state to `awaiting_input='schedule_time'` with the date and draft ID in context

### Requirement: Schedule time input handler
The router SHALL register an input handler for `schedule_time` awaiting_input context. It SHALL parse HH:MM input, combine with the stored date, convert to UTC using user timezone, and schedule the draft.

#### Scenario: Valid time input
- **WHEN** user sends "14:30" with schedule context containing date "2026-02-21" and timezone "UTC+2"
- **THEN** the handler SHALL schedule the draft for "2026-02-21 12:30:00" UTC and render draft detail
