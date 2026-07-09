-- Add LLM title-classification support: US-based remote software-engineer filtering.

-- Region/location string inferred from the job title (e.g. "Remote - US"); nullable.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location TEXT;

-- Cache of title classification verdicts (accepted AND rejected) keyed by dedup_hash,
-- so repeated scrapes never re-call the LLM for a title we've already judged.
CREATE TABLE IF NOT EXISTS job_classifications (
  dedup_hash    TEXT PRIMARY KEY,
  is_us_remote  BOOLEAN NOT NULL,
  location      TEXT,
  reason        TEXT,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single-user app uses the service_role key for all access (RLS disabled elsewhere).
ALTER TABLE job_classifications DISABLE ROW LEVEL SECURITY;
