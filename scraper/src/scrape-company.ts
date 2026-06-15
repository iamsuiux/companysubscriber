import type { Browser, BrowserContext, Page } from 'playwright';
import { extractJobs } from './extractors';
import { detectPagination } from './pagination/detector';
import { handlePagination } from './pagination/handler';
import { generateDedupHash } from './utils/dedup';
import { filterJobsByTitle, parseKeywords } from './utils/filter';
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

    // Generate dedup hashes and upsert jobs
    let jobsNew = 0;
    const currentHashes = new Set<string>();

    for (const job of allJobs) {
      const hash = generateDedupHash(company.id, job.title, job.url);
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
          .update({ last_seen_at: new Date().toISOString(), is_active: true })
          .eq('id', existing.id);
      } else {
        // Insert new job
        const { error } = await supabase.from('jobs').insert({
          company_id: company.id,
          title: job.title,
          job_url: job.url,
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

    log(`  Done: ${allJobs.length} found, ${jobsNew} new`);

    return {
      jobsFound: allJobs.length,
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
