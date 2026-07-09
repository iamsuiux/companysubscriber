# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Company Subscribe is a job tracking application that automates monitoring of company career pages. It consists of two services:

1. **Next.js Frontend** - Dashboard and UI for managing companies and viewing jobs
2. **Scraper Service** - Separate Playwright-based service that scrapes company career pages

The scraper runs independently because Playwright's Chromium binary (~400MB) exceeds Vercel's serverless limits, and scraping operations can take several minutes.

Scraped titles pass through a two-stage filter before storage: (1) a keyword filter, then (2) an optional OpenAI classification stage that keeps only US-based remote software-engineering roles (enabled when `OPENAI_API_KEY` is set).

## Development Commands

### Main Application (Next.js)

```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

### Scraper Service

```bash
cd scraper
npm run dev          # Start scraper in watch mode (tsx watch)
npm run start        # Run scraper once
npm run build        # Compile TypeScript
npm run scrape       # Run scrape CLI (NOTE: points at src/scrape-cli.ts, which does not exist yet)
```

### Utility Scripts

Run these from the project root using tsx:

```bash
npx tsx scripts/import-companies.ts      # Import companies from CSV
npx tsx scripts/delete-all-companies.ts  # Delete all companies
npx tsx scripts/clear-stuck-scrapes.ts   # Clear stuck scrape logs
```

## Architecture

### Two-Service Design

```
[Browser] --> [Next.js on Vercel] --> [Supabase PostgreSQL]
                                            ^
                                            |
                          [Scraper Service] -+
```

- **Frontend**: Handles UI, API routes, and triggers scraper via HTTP
- **Scraper**: Runs Playwright, reads from/writes to Supabase directly
- **Communication**: Authenticated via shared API key (`X-API-Key` header)

### Database (Supabase)

Key tables:
- `companies` - Career page URLs to monitor
- `jobs` - Scraped job listings with deduplication via `dedup_hash` (includes a `location` column from classification)
- `job_classifications` - Cached OpenAI verdicts keyed by `dedup_hash` (see Job Classification below)
- `scrape_logs` - Metadata about each scrape run
- `users` - Single-user authentication
- `settings` - App configuration (scrape schedule, etc.)

Migrations are in `supabase/migrations/`. RLS is disabled (see 002_disable_rls.sql).

## Next.js App Router Structure

The app uses Next.js 14 App Router with route groups:

- `(auth)/` - Unauthenticated routes (login page)
- `(protected)/` - Auth-required routes (dashboard, companies, history, settings)
- `api/` - API routes for CRUD operations and scraper control

**Protected Layout**: `src/app/(protected)/layout.tsx` enforces authentication and provides navigation sidebar.

**Middleware**: `src/middleware.ts` handles session validation and redirects.

## Key Patterns

### Scraper Extraction Strategies

The scraper handles different career page architectures:

1. **Embedded JSON** - Extracts from `window.__appData`, `window.__NEXT_DATA__`, or JSON-LD scripts (e.g., Ashby HQ)
2. **DOM Parsing** - Generic selector-based extraction for standard career pages

Extractors are in `scraper/src/extractors/`.

### Deduplication

Jobs are deduplicated using `dedup_hash = MD5(company_id + lowercase(title) + job_url)`. If a hash exists:
- Update `last_seen_at` (job still exists)
- Keep existing `first_seen_at` (when we first discovered it)

If hash is new, insert as a new job record.

The same `dedup_hash` also keys the `job_classifications` cache, so each unique job is classified by OpenAI only once and the verdict is reused across scrapes.

### Job Title Filtering

Jobs are filtered by title keywords before being stored in the database:

- Keywords are configurable via Settings page
- Matching uses OR logic (job must contain at least one keyword)
- Case-insensitive partial matching (e.g., "engineering" matches "engineer")
- Default keywords: "software", "engineer", "developer"
- Filtering happens early: after extraction but before pagination/deduplication
- Filter utility: `scraper/src/utils/filter.ts`

To modify keywords: Settings page → Job Title Filtering section

**Implementation details**:
- Keywords stored in `settings` table with key `job_title_keywords`
- Format: comma-separated string (e.g., "software,engineer,developer")
- Filter applied in two places:
  1. After initial extraction (`scraper/src/scrape-company.ts`)
  2. During pagination (`scraper/src/pagination/handler.ts`)

Keyword filtering is stage 1. Titles that survive it are then passed to the OpenAI classification stage (below).

### Job Classification (US-remote SWE)

After keyword filtering and pagination, the scraper uses OpenAI to keep only US-based remote software-engineering roles. This stage is **optional**: if `OPENAI_API_KEY` is unset, it is skipped and all keyword-matched jobs are kept with `location = null`.

- **Utility**: `scraper/src/utils/classifier.ts`
  - `classifyTitles(titles)` — batches **40 unique titles** per request to `config.openaiModel` (default `gpt-4o-mini`), `temperature: 0`, `response_format: json_object`. Returns `Map<title, TitleVerdict>` where `TitleVerdict = { isUsRemote, location, reason }`.
  - `isClassifierEnabled()` — true when `OPENAI_API_KEY` is set.
  - The system prompt is **high-recall**: a software-engineering title with no location signal is accepted (assumed possibly US-remote). Titles are rejected only when they clearly signal a non-SWE role, onsite/hybrid-only, or a non-US region.
- **Caching**: verdicts are cached in the `job_classifications` table keyed by `dedup_hash`, so each unique job is classified once. Cache lookups are chunked in groups of 200 (Supabase caps `.in()` list length).
- **Failure handling**: a failed OpenAI batch leaves those titles unclassified — they are excluded from this run and **not** cached, so they retry on the next scrape.
- **Enrichment**: accepted jobs are stamped with `location` (e.g. `"Remote - US"`), stored on the `jobs` row and shown in the UI (dashboard badge; History "Location" column, em-dash when null).
- **Config**: `OPENAI_API_KEY` and `OPENAI_MODEL` (see Environment Variables). Requires the `openai` npm dependency in `scraper/`.
- **Pipeline location**: classification stage in `scraper/src/scrape-company.ts` (after pagination, before upserting to `jobs`).

### Pagination

The scraper detects and handles multiple pagination patterns:
- "Next" button / arrow navigation
- URL parameter-based (page=, offset=, etc.)
- "Load More" buttons
- Infinite scroll

Safety limit: max 20 pages per company.

### Scheduled Scraping

The scraper service self-schedules a **daily full scrape at 1:00 PM Central time** using
`node-cron` in `scraper/src/index.ts` (`scheduleDailyScrape()`). It reuses `scrapeAll()`, so the
existing concurrency guard makes it safe to overlap with a manual "Run Now" trigger (whichever
starts second logs "Scrape already in progress, skipping").

- Timezone `America/Chicago` → DST-aware (19:00 UTC in winter / CST, 18:00 UTC in summer / CDT).
- Configurable via env (see `scraper/.env.example`): `SCRAPE_CRON_ENABLED` (default `true`),
  `SCRAPE_CRON_EXPR` (default `0 13 * * *`), `SCRAPE_CRON_TZ` (default `America/Chicago`). An
  invalid expression is logged and the schedule is skipped rather than crashing the service.
- **Caveat**: the scheduler lives in the (locally-run) scraper process, so a run only fires if the
  machine is on and the service is running at 1pm Central. A missed run is not caught up later.

## API Routes

Key endpoints:

- `POST /api/scrape/trigger` - Trigger scraper service (sends HTTP request to scraper)
- `GET /api/scrape/status` - Check current scrape status
- `GET /api/scrape/logs` - Fetch scrape history
- `GET /api/companies` - List companies
- `POST /api/companies` - Add company
- `PUT /api/companies/[id]` - Update company
- `DELETE /api/companies/[id]` - Delete company
- `GET /api/dashboard` - Dashboard data (jobs from last 7 days)
- `GET /api/jobs` - Job history

## Environment Variables

There are two `.env` files — one for the Next.js app (root) and one for the scraper (`scraper/`). Both access Supabase directly.

**Root app** (see `.env.example`):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth (min 32 chars)
JWT_SECRET=

# Admin credentials (for DB seed)
ADMIN_USERNAME=
ADMIN_PASSWORD=

# Scraper
SCRAPER_API_URL=http://localhost:4000
SCRAPER_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Vercel Cron (production only)
CRON_SECRET=
```

**Scraper** (see `scraper/.env.example`):

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Scraper
SCRAPER_API_KEY=
PORT=4000

# OpenAI (optional — toggles the job classification stage)
# If OPENAI_API_KEY is empty, classification is skipped and only keyword filtering applies.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

The scraper loads `scraper/.env` first, then falls back to the root `../.env.local` (see `scraper/src/config.ts`).

## Testing Company URLs

Reference URLs for testing scraper:

1. **Ashby HQ (Scribd)** - JSON extraction, no pagination:
   `https://jobs.ashbyhq.com/ScribdInc?departmentId=44254239-8425-4aea-9399-b70b7545a111&workplaceType=remote`

2. **Dropbox (filtered)** - DOM extraction, no pagination:
   `https://www.dropbox.jobs/en/jobs/?search=software&location=Remote+-+US%3A+All+locations&pagesize=20#results`

3. **Dropbox (all jobs)** - DOM extraction with pagination:
   `https://www.dropbox.jobs/en/jobs/?search=&pagesize=20#results`

## Common Development Tasks

### Running the Full Stack Locally

1. Start Next.js frontend: `npm run dev` (port 3000)
2. Start scraper service: `cd scraper && npm run dev` (port 4000)
3. Trigger scrape via Settings page "Run Now" button or POST to `/api/scrape/trigger`

### Adding a New Extraction Strategy

1. Create extractor in `scraper/src/extractors/`
2. Implement detection logic to identify when to use this strategy
3. Add to extraction pipeline in `scraper/src/scrape-company.ts`
4. Return array of `{ title: string, job_url?: string }`

### Modifying Database Schema

1. Create new migration in `supabase/migrations/` (latest is `004_add_job_classification.sql`)
2. Name with incremented number (e.g., `005_add_column.sql`)
3. Apply via Supabase dashboard or CLI
4. Update TypeScript types in `src/types/database.types.ts`

## Important Constraints

- **Single-user system**: No multi-tenancy, auth is for one person only
- **Job definition**: "New" jobs are `first_seen_at >= NOW() - 7 days`
- **Concurrency**: Only one scrape run at a time (checked via `scrape_logs.status = 'running'`)
- **Error handling**: Per-company failures don't stop batch; errors logged to `scrape_logs.error_message`
- **Pagination limit**: Max 20 pages per company to prevent runaway scrapes

## Data Retention

### Job Records

**Jobs are never deleted** from the database - this is intentional for historical tracking:

- Removed jobs are marked with `is_active = false` when no longer found on career pages
- `first_seen_at` timestamp is immutable and shows when the job was originally discovered
- `last_seen_at` timestamp updates each time the job is found in a scrape
- Database will grow indefinitely as jobs accumulate over time
- PostgreSQL efficiently handles millions of rows with proper indexing

### Why Jobs Are Kept Forever

- Preserves complete historical record of job postings
- Allows tracking job posting patterns (duration, frequency, reoccurrence)
- Enables historical analysis of hiring trends
- If job reappears later (reposted), original discovery date is preserved

### Job Lifecycle States

```
New Job Discovery:
  → inserted with is_active = true
  → first_seen_at = current time
  → last_seen_at = current time

Job Found Again (recurring):
  → is_active remains true
  → first_seen_at unchanged (preserved)
  → last_seen_at = updated to current time

Job Removed/Closed:
  → is_active = false
  → first_seen_at unchanged
  → last_seen_at = unchanged (stays as when it was last seen)

Job Reappears:
  → is_active = true (re-activated)
  → first_seen_at unchanged (preserved from original discovery)
  → last_seen_at = updated to current time
```

### Future Cleanup Options

If database growth becomes a concern, potential solutions include:
- Periodic deletion of inactive jobs older than X days
- Archival of old jobs to separate table
- Configurable retention policy via Settings page
