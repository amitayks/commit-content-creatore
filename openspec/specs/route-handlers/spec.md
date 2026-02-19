## ADDED Requirements

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
