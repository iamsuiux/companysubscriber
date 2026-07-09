import OpenAI from 'openai';
import { config } from '../config';
import { log, logError } from './logger';

export interface TitleVerdict {
  isUsRemote: boolean;
  location: string | null;
  reason: string;
}

// Lazily-built singleton client. Null when no API key is configured.
let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export function isClassifierEnabled(): boolean {
  return Boolean(config.openaiApiKey);
}

// Titles per OpenAI request. Titles are short, so we batch generously.
const BATCH_SIZE = 40;

const SYSTEM_PROMPT = `You classify job titles for a board that only wants US-based remote software engineering roles.

For each title decide is_us_remote = true only if the title plausibly denotes a software engineering / software development role that is remote and open to people based in the United States.

Rules (inclusive, high recall):
- Accept software-engineering titles: engineer, developer, SWE, programmer, SDE, backend/frontend/full-stack/mobile/platform/infrastructure/data/ML engineer, etc.
- Accept these as US-eligible remote: "Remote - US", "Remote (US)", "Remote - North America", "Remote - Americas", "US/Canada remote", "Remote US/Canada".
- When a software-engineering title gives NO location/remote signal at all (e.g. plain "Software Engineer", "Senior Backend Engineer"), ACCEPT it (assume it may be US-remote).
- Reject only when the title CLEARLY signals otherwise:
  - clearly not a software-engineering role (e.g. "Sales", "Recruiter", "Designer", "Product Manager", "Accountant", "Engineering Manager" with no IC engineering work).
  - clearly on-site or hybrid only (e.g. "Onsite", "In-office", "Hybrid").
  - clearly a non-US region only (e.g. "London", "EMEA only", "India", "Remote - Germany", "Remote - APAC", "Remote - LATAM (non-US)").
- location: a short region string if the title states one (e.g. "Remote - US", "London"), otherwise null.

Return ONLY JSON of the form:
{"results":[{"index":0,"is_us_remote":true,"location":"Remote - US","reason":"..."}, ...]}
There must be exactly one result object per input title, matched by its index.`;

/**
 * Classify a batch of job titles. Returns a Map keyed by the exact title string.
 * Throws on API/parse failure so the caller can exclude-without-caching.
 */
async function classifyBatch(
  openai: OpenAI,
  titles: string[]
): Promise<Map<string, TitleVerdict>> {
  const numbered = titles.map((t, i) => `${i}: ${t}`).join('\n');

  const completion = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Classify these ${titles.length} job titles:\n${numbered}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  const parsed = JSON.parse(content) as {
    results?: Array<{
      index?: number;
      is_us_remote?: boolean;
      location?: string | null;
      reason?: string;
    }>;
  };

  if (!parsed.results || !Array.isArray(parsed.results)) {
    throw new Error('OpenAI response missing "results" array');
  }

  const verdicts = new Map<string, TitleVerdict>();
  for (const r of parsed.results) {
    if (typeof r.index !== 'number' || r.index < 0 || r.index >= titles.length) {
      continue;
    }
    const title = titles[r.index];
    verdicts.set(title, {
      isUsRemote: r.is_us_remote === true,
      location: r.location ? String(r.location) : null,
      reason: r.reason ? String(r.reason) : '',
    });
  }

  return verdicts;
}

/**
 * Classify many job titles in batched OpenAI calls.
 * Returns a Map keyed by the exact title string. Titles missing from the result
 * (e.g. a failed batch) are simply absent and should be excluded by the caller
 * without caching, so they are retried next scrape.
 */
export async function classifyTitles(
  titles: string[]
): Promise<Map<string, TitleVerdict>> {
  const openai = getClient();
  const results = new Map<string, TitleVerdict>();

  if (!openai || titles.length === 0) {
    return results;
  }

  // De-duplicate identical titles before sending.
  const uniqueTitles = Array.from(new Set(titles));

  for (let i = 0; i < uniqueTitles.length; i += BATCH_SIZE) {
    const batch = uniqueTitles.slice(i, i + BATCH_SIZE);
    try {
      const verdicts = await classifyBatch(openai, batch);
      for (const [title, verdict] of verdicts) {
        results.set(title, verdict);
      }
      log(`  Classified ${verdicts.size}/${batch.length} titles in batch`);
    } catch (err) {
      // Leave this batch's titles unclassified -> excluded this run, not cached.
      logError(
        `  Title classification batch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return results;
}
