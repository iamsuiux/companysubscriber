# Company Subscribe - Requirements

## 1. Project Overview

**Project Name:** Company Subscribe

**Purpose:** A web application that automates monitoring of company career pages for new job postings. A software engineer actively job-searching can add career page URLs from companies they're interested in. The system scrapes those pages daily using a headless browser, stores all discovered job listings, and surfaces newly found jobs on a dashboard.

**Target User:** A single software engineer who wants to track career pages across multiple companies without manually visiting each site every day.

**Core Value:** Automates the daily check of company career pages and surfaces new postings in one place. Instead of visiting 10-50+ career pages manually, the user checks one dashboard.

**Approach:** Pure web scraping only. No third-party job APIs. The scraper visits the exact URLs the user provides (preserving all query parameters like location filters) and extracts job listings from the rendered page.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14+ (App Router) | TypeScript, React Server Components |
| Database | Supabase (PostgreSQL) | New project, hosted on Supabase free tier |
| Scraping | Playwright | Headless Chromium for JS-rendered pages |
| Styling | Tailwind CSS | Utility-first, responsive |
| Auth | NextAuth.js (Credentials provider) | Single-user login |
| Scheduling (prod) | Vercel Cron | Hits API route on schedule |
| Scheduling (dev) | node-cron or manual trigger | For local development |
| Deployment | Vercel (frontend) + separate scraper service | See Architecture section |

---

## 3. Architecture

### Two-Service Design

```
[Browser] --> [Next.js on Vercel] --> [Supabase PostgreSQL]
                                            ^
                                            |
                          [Scraper Service] -+
                          (Playwright, separate host)
```

**Frontend (Next.js on Vercel):**
- Serves all 4 pages: Dashboard, Companies, History, Settings
- API routes for CRUD operations on companies
- API route to trigger scrape (calls scraper service)
- Reads job and scrape data from Supabase
- Vercel Cron triggers the daily scrape schedule

**Scraper Service (separate host):**
- Runs Playwright headless Chromium
- Triggered by HTTP request from frontend API or cron
- Reads company URLs from Supabase `companies` table
- Writes scraped jobs to Supabase `jobs` table
- Writes run metadata to `scrape_logs` table
- Authenticated via shared API key

**Why two services:**
- Playwright's Chromium binary is ~400MB, exceeding Vercel's 250MB function size limit
- Scraping multiple paginated pages can take minutes, exceeding Vercel's serverless timeout (10s hobby / 60s pro)
- The scraper communicates directly with Supabase, no need to proxy through the frontend

**Local Development:** Both services run on the same machine. The scraper is triggered manually via the Settings page "Run Now" button or a CLI command.

---

## 4. Database Schema

### Table: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| username | text | NOT NULL, UNIQUE | |
| password_hash | text | NOT NULL | bcrypt hashed |
| created_at | timestamptz | NOT NULL, default NOW() | |

Single-user system. Credentials seeded via migration or environment variables.

### Table: `companies`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| name | text | NOT NULL | User-provided company name |
| career_page_url | text | NOT NULL | Full URL including query params |
| is_active | boolean | default TRUE | Pause/resume scraping |
| created_at | timestamptz | NOT NULL, default NOW() | |
| updated_at | timestamptz | NOT NULL, default NOW() | |
| last_scraped_at | timestamptz | nullable | Last successful scrape time |

Index: `idx_companies_is_active` on `is_active`

### Table: `jobs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| company_id | uuid | FK -> companies.id, NOT NULL | |
| title | text | NOT NULL | Job title as displayed on page |
| job_url | text | nullable | Direct link to job posting |
| first_seen_at | timestamptz | NOT NULL, default NOW() | When scraper first discovered this job |
| last_seen_at | timestamptz | NOT NULL, default NOW() | Updated each scrape if job still present |
| is_active | boolean | default TRUE | Set FALSE when job disappears from page |
| dedup_hash | text | UNIQUE, NOT NULL | Hash for deduplication |

Indexes: `idx_jobs_company_id`, `idx_jobs_first_seen_at`, `idx_jobs_is_active`, `idx_jobs_dedup_hash`

**Deduplication:** `dedup_hash` = MD5 of `company_id + lowercase(title) + job_url`. On duplicate hash, update `last_seen_at` instead of inserting a new row.

### Table: `scrape_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| company_id | uuid | FK -> companies.id, NOT NULL | |
| started_at | timestamptz | NOT NULL, default NOW() | |
| completed_at | timestamptz | nullable | |
| status | text | NOT NULL, default 'running' | running / success / error |
| jobs_found | integer | default 0 | Total jobs found on page |
| jobs_new | integer | default 0 | Newly discovered jobs this run |
| error_message | text | nullable | Error details if status = error |
| pages_scraped | integer | default 1 | Pagination pages visited |

Indexes: `idx_scrape_logs_company_id`, `idx_scrape_logs_started_at`

### Table: `settings`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| key | text | UNIQUE, NOT NULL | Setting identifier |
| value | text | NOT NULL | Setting value (JSON-encoded if complex) |
| updated_at | timestamptz | NOT NULL, default NOW() | |

Seed data: `{ key: "scrape_schedule", value: "0 12 * * *" }` (daily at 12:00 PM CST)

---

## 5. Pages

### 5.1 Dashboard (`/dashboard`)

**Purpose:** Show jobs discovered within the last 7 days.

**Definition of "new":** A job is new if `first_seen_at >= NOW() - 7 days`. Based on when the scraper first found the job, not the posting date on the company's site.

**Layout:**
- Summary stats at top: total new jobs count, number of companies monitored, last scrape timestamp
- Jobs grouped by company name
- Each company group shows a count badge and lists its new jobs
- Each job row shows:
  - Job title (linked to `job_url`, opens in new tab)
  - Company name
  - First seen date (relative format, e.g., "2 days ago")
- Sorted by most recently seen first

**Empty state:** "No new jobs found in the last 7 days."

### 5.2 Company Career Pages (`/companies`)

**Purpose:** CRUD management of career page URLs.

**List view:**
- Table with columns: Company Name, Career Page URL (truncated, linked), Last Scraped, Active toggle, Actions (Edit, Delete)
- Sorted alphabetically by company name

**Add company (modal or inline form):**
- Fields:
  - Company Name (required, text input)
  - Career Page URL (required, URL input with format validation)
- Save button

**Edit:** Same form, pre-populated with existing values.

**Delete:** Confirmation dialog before deletion. Hard delete cascades to associated jobs.

### 5.3 History (`/history`)

**Purpose:** Chronological list of all scraped jobs across all time.

**Layout:**
- Simple table with columns: Job Title (linked to `job_url`), Company Name, First Seen At (formatted date)
- Sorted chronologically, newest first
- Pagination: load 50 jobs initially, load more on scroll or "Load More" button

**No filtering for v1.** Filtering is a future enhancement.

### 5.4 Settings (`/settings`)

**Purpose:** Configure scraping and view scrape status.

**V1 features:**
- Display current schedule: "Daily at 12:00 PM CST"
- Toggle auto-check on/off
- "Run Now" button to trigger an immediate scrape of all active companies
- Last scrape run summary: timestamp, total jobs found, new jobs found, any errors

**Future extensibility:** This page is designed to accommodate additional settings in later versions (notification preferences, scrape frequency, data retention, etc.).

---

## 6. Scraping Engine

### 6.1 Pipeline (per company)

1. Launch headless Chromium (or reuse browser context for batch)
2. Navigate to the company's career page URL (exact URL with all query params)
3. Wait for page to fully render (`networkidle` or custom wait)
4. Detect extraction strategy and extract job listings (see 6.2)
5. Detect and handle pagination (see 6.3)
6. Normalize extracted data (trim whitespace, resolve relative URLs)
7. Generate `dedup_hash` for each job
8. Insert new jobs / update `last_seen_at` for existing jobs
9. Mark jobs not seen in this scrape as `is_active = false`
10. Log scrape run to `scrape_logs`
11. Update `last_scraped_at` on the company record

### 6.2 Extraction Strategies

The scraper must handle multiple career page architectures:

| Strategy | Detection | Example |
|----------|-----------|---------|
| Embedded JSON | `window.__appData`, `window.__NEXT_DATA__`, JSON-LD `<script>` tags | Ashby HQ (jobs.ashbyhq.com) |
| DOM Parsing | Query selectors for repeated job link containers | Generic career pages |

**For each job, extract:**
- **Job title** (required) - text content of the job link or heading
- **Job URL** (optional but preferred) - `href` of the job link, resolved to absolute URL

### 6.3 Pagination Handling

After extracting jobs from the current page, detect if more pages exist:

**Detection heuristics:**
- "Next" button or ">" arrow that is not disabled
- Numbered page links (1, 2, 3...)
- "Load More" button
- Infinite scroll (scroll to bottom, wait for new items)
- URL query parameters like `page=`, `offset=`, `start=`

**Iteration:**
- Navigate to each subsequent page and extract jobs
- Stop when: no "Next" button / disabled, no new jobs appear, or safety limit reached (max 20 pages)

**Example reference:** `dropbox.jobs` uses `pagesize=20` with multiple pages. `jobs.ashbyhq.com` loads all jobs client-side with no pagination.

### 6.4 Error Handling

- Per-company page timeout: 30 seconds (configurable)
- Retry: 1 retry with 5-second delay on timeout or network error
- Graceful degradation: if one company fails, log the error and continue to the next
- Anti-bot measures: randomized delays between requests (1-3 seconds), realistic User-Agent header
- All errors logged to `scrape_logs` with error details

### 6.5 Deduplication

- `dedup_hash` = MD5 of `company_id + lowercase(title) + job_url`
- If hash already exists in DB: update `last_seen_at`, keep existing `first_seen_at`
- If hash is new: insert as a new job record

---

## 7. Authentication

- Single-user system, no registration flow
- Login page at `/login`
- Credentials: username + password, seeded via environment variables or migration
- Session management via NextAuth.js with Credentials provider
- All pages except `/login` require authentication (enforced via Next.js middleware)
- Session duration: 7 days with automatic refresh

---

## 8. Scheduling

**Production (Vercel):**
- Vercel Cron Job configured in `vercel.json`
- Triggers a Next.js API route (`/api/cron/scrape`) daily at 12:00 PM CST (18:00 UTC)
- That API route sends an HTTP request to the external scraper service
- Scraper service endpoint is authenticated with a shared API key

**Local Development:**
- Manual trigger via "Run Now" button on Settings page
- Optionally use `node-cron` in a local process

**Concurrency guard:** Only one scrape run at a time. Check `scrape_logs` for `status = 'running'` before starting a new run.

---

## 9. Project Structure

```
company-subscribe/
  src/
    app/
      (auth)/
        login/
          page.tsx
      (protected)/
        layout.tsx              # Auth-protected layout wrapper
        dashboard/
          page.tsx
        companies/
          page.tsx
        history/
          page.tsx
        settings/
          page.tsx
      api/
        auth/[...nextauth]/
          route.ts
        companies/
          route.ts              # GET (list), POST (create)
          [id]/
            route.ts            # PUT (update), DELETE
        scrape/
          trigger/
            route.ts            # POST - trigger scrape run
          status/
            route.ts            # GET - current scrape status
        cron/
          scrape/
            route.ts            # GET - Vercel cron endpoint
      layout.tsx
      page.tsx                  # Redirect to /dashboard
    lib/
      supabase.ts               # Supabase client setup
      auth.ts                   # NextAuth configuration
    components/
      ui/                       # Shared UI components (nav, layout, etc.)
      dashboard/
      companies/
      history/
      settings/
    types/
      index.ts                  # TypeScript interfaces
  scraper/
    src/
      index.ts                  # Entry point - scrape all active companies
      scrape-company.ts         # Per-company scrape logic
      extractors/
        json-extractor.ts       # Embedded JSON extraction (Ashby pattern)
        dom-extractor.ts        # Generic DOM-based extraction
      pagination/
        detector.ts             # Detect pagination type
        handlers.ts             # Handle click-next, URL-param, load-more, infinite-scroll
      utils/
        dedup.ts                # Deduplication hash generation
        db.ts                   # Supabase client for scraper
    package.json
    tsconfig.json
    Dockerfile                  # For deploying scraper service
  supabase/
    migrations/
      001_initial_schema.sql    # All tables, indexes, RLS policies
    seed.sql                    # Seed admin user + default settings
  .env.local
  .env.example
  package.json
  tsconfig.json
  tailwind.config.ts
  next.config.ts
  vercel.json                   # Cron schedule configuration
  middleware.ts                 # Auth route protection
```

---

## 10. Environment Variables

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Admin credentials (for seeding)
ADMIN_USERNAME=
ADMIN_PASSWORD=

# Scraper service
SCRAPER_API_URL=http://localhost:4000
SCRAPER_API_KEY=
```

---

## 11. Deployment Plan

### Phase 1: Local Development
- Next.js dev server on `localhost:3000`
- Scraper runs locally as a Node.js process on `localhost:4000`
- Supabase cloud project (free tier) for database
- Manual scrape trigger via Settings page "Run Now" button
- Environment variables in `.env.local`

### Phase 2: Production (future)
- **Frontend:** Deploy Next.js to Vercel, connect GitHub repo, configure env vars and cron
- **Scraper:** Deploy to Railway, Render, Fly.io, or a VPS (decision deferred)
- **Communication:** Vercel cron hits Next.js API route, which forwards request to scraper service with API key auth

---

## 12. Example Career Pages (for testing)

These URLs are the initial test cases for the scraper:

1. **Ashby HQ (Scribd)** - No pagination, JS-rendered, jobs in embedded JSON (`window.__appData`)
   `https://jobs.ashbyhq.com/ScribdInc?departmentId=44254239-8425-4aea-9399-b70b7545a111&workplaceType=remote`

2. **Dropbox (filtered, no pagination)**
   `https://www.dropbox.jobs/en/jobs/?search=software&location=Remote+-+US%3A+All+locations&pagesize=20#results`

3. **Dropbox (all jobs, with pagination)** - Has multiple pages of 20 results each
   `https://www.dropbox.jobs/en/jobs/?search=&pagesize=20#results`

---

## 13. Future Considerations (out of scope for v1)

- Email or push notifications when new jobs are found
- Job filtering on History page (by company, date range, keyword)
- Per-company scrape frequency configuration
- Job description extraction and keyword matching
- Multi-user support
- Export to CSV/JSON
- AI-powered job relevance scoring
- Data retention / auto-archive old jobs
- Browser extension for one-click "add this career page"
