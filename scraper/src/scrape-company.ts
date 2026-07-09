import type { Browser, BrowserContext, Page } from 'playwright';
import { extractJobs } from './extractors';
import { detectPagination } from './pagination/detector';
import { handlePagination } from './pagination/handler';
import { generateDedupHash } from './utils/dedup';
import { filterJobsByTitle, parseKeywords } from './utils/filter';
import { classifyTitles, isClassifierEnabled } from './utils/classifier';
import { supabase } from './utils/db';
import { config } from './config';
import { log, logError } from './utils/logger';

interface ScrapeResult {
  jobsFound: number;
  jobsNew: number;
  pagesScraped: number;
}

export async function scrapeCompany(
  browser: Browser,
  company: { id: string; name: string; career_page_url: string }
): Promise<ScrapeResult> {
  // Fetch job title keywords from settings
  const { data: keywordsSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'job_title_keywords')
    .single();

  const keywords = keywordsSetting
    ? parseKeywords(keywordsSetting.value)
    : ['software', 'engineer', 'developer']; // Fallback defaults

  log(`Using keywords filter: ${keywords.join(', ')}`);

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Create context with timeout protection
    try {
      context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    } catch (err) {
      throw new Error(`Failed to create browser context: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Create page with timeout protection
    try {
      page = await context.newPage();
    } catch (err) {
      throw new Error(`Failed to create page: ${err instanceof Error ? err.message : String(err)}`);
    }
    log(`Scraping: ${company.name} (${company.career_page_url})`);

    // Navigate to career page
    await page.goto(company.career_page_url, {
      waitUntil: 'domcontentloaded',
      timeout: config.pageTimeout,
    });

    // Wait for page content to render (SPAs need extra time after DOM load)
    await page.waitForTimeout(3000);

    // Extract jobs from first page
    const initialJobs = await extractJobs(page);
    log(`  Initial extraction: ${initialJobs.length} jobs`);

    // Filter jobs by title keywords
    const filteredInitialJobs = filterJobsByTitle(initialJobs, keywords);
    log(`  After title filter: ${filteredInitialJobs.length} jobs`);

    // Detect and handle pagination
    const pagination = await detectPagination(page);
    const { allJobs, pagesScraped } = await handlePagination(
      page,
      pagination,
      filteredInitialJobs,
      keywords
    );

    log(`  Total after pagination: ${allJobs.length} jobs across ${pagesScraped} pages`);

    // --- Classification stage: keep only US-based remote software-engineer titles ---
    // Each candidate carries its precomputed dedup hash; accepted jobs also carry a location.
    type CandidateJob = { title: string; url: string | null; hash: string };
    const candidates: CandidateJob[] = allJobs.map((job) => ({
      title: job.title,
      url: job.url,
      hash: generateDedupHash(company.id, job.title, job.url),
    }));

    type AcceptedJob = CandidateJob & { location: string | null };
    let acceptedJobs: AcceptedJob[];

    if (!isClassifierEnabled()) {
      // No OpenAI key: fall back to today's behavior (keyword-filtered titles only).
      acceptedJobs = candidates.map((c) => ({ ...c, location: null }));
      log('  Classifier disabled (no OPENAI_API_KEY): keeping all keyword-matched jobs');
    } else {
      // 1. Look up cached verdicts for these hashes (chunked; Supabase caps .in() lists).
      const hashes = candidates.map((c) => c.hash);
      const cached = new Map<string, { is_us_remote: boolean; location: string | null }>();

      for (let i = 0; i < hashes.length; i += 200) {
        const chunk = hashes.slice(i, i + 200);
        const { data } = await supabase
          .from('job_classifications')
          .select('dedup_hash, is_us_remote, location')
          .in('dedup_hash', chunk);
        if (data) {
          for (const row of data) {
            cached.set(row.dedup_hash, {
              is_us_remote: row.is_us_remote,
              location: row.location,
            });
          }
        }
      }

      // 2. Classify titles for jobs not in cache.
      const uncached = candidates.filter((c) => !cached.has(c.hash));
      const verdictsByTitle = await classifyTitles(uncached.map((c) => c.title));

      // 3. Cache fresh verdicts (one row per dedup_hash). Titles with no verdict
      //    (e.g. a failed batch) are intentionally left uncached so they retry next scrape.
      const newRows = uncached
        .filter((c) => verdictsByTitle.has(c.title))
        .map((c) => {
          const v = verdictsByTitle.get(c.title)!;
          return {
            dedup_hash: c.hash,
            is_us_remote: v.isUsRemote,
            location: v.location,
            reason: v.reason,
          };
        });
      if (newRows.length > 0) {
        const { error: cacheErr } = await supabase
          .from('job_classifications')
          .upsert(newRows, { onConflict: 'dedup_hash' });
        if (cacheErr) {
          logError(`  Failed to cache classifications: ${cacheErr.message}`);
        }
      }

      // 4. Build the accepted set from cache hits + fresh verdicts.
      acceptedJobs = [];
      for (const c of candidates) {
        const cachedVerdict = cached.get(c.hash);
        if (cachedVerdict) {
          if (cachedVerdict.is_us_remote) {
            acceptedJobs.push({ ...c, location: cachedVerdict.location });
          }
          continue;
        }
        const fresh = verdictsByTitle.get(c.title);
        if (fresh && fresh.isUsRemote) {
          acceptedJobs.push({ ...c, location: fresh.location });
        }
      }

      log(`  Accepted ${acceptedJobs.length} / scanned ${candidates.length} (US-remote SWE)`);
    }

    // Upsert accepted jobs
    let jobsNew = 0;
    const currentHashes = new Set<string>();

    for (const job of acceptedJobs) {
      const hash = job.hash;
      currentHashes.add(hash);

      // Check if job already exists
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('dedup_hash', hash)
        .single();

      if (existing) {
        // Update last_seen_at
        await supabase
          .from('jobs')
          .update({
            last_seen_at: new Date().toISOString(),
            is_active: true,
            location: job.location,
          })
          .eq('id', existing.id);
      } else {
        // Insert new job
        const { error } = await supabase.from('jobs').insert({
          company_id: company.id,
          title: job.title,
          job_url: job.url,
          location: job.location,
          dedup_hash: hash,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          is_active: true,
        });

        if (error) {
          // Handle race condition on unique constraint
          if (!error.message.includes('duplicate')) {
            logError(`  Failed to insert job "${job.title}": ${error.message}`);
          }
        } else {
          jobsNew++;
        }
      }
    }

    // Mark jobs not seen in this scrape as inactive
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('id, dedup_hash')
      .eq('company_id', company.id)
      .eq('is_active', true);

    if (activeJobs) {
      for (const job of activeJobs) {
        if (!currentHashes.has(job.dedup_hash)) {
          await supabase
            .from('jobs')
            .update({ is_active: false })
            .eq('id', job.id);
        }
      }
    }

    // Update company last_scraped_at
    await supabase
      .from('companies')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', company.id);

    log(`  Done: ${acceptedJobs.length} kept (${jobsNew} new) of ${allJobs.length} scanned`);

    return {
      jobsFound: acceptedJobs.length,
      jobsNew,
      pagesScraped,
    };
  } finally {
    // Ensure context is closed, even if page creation failed
    if (page) {
      try {
        await page.close();
      } catch (err) {
        logError(`Failed to close page: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (context) {
      try {
        await context.close();
      } catch (err) {
        logError(`Failed to close context: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
