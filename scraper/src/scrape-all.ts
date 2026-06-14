import { chromium } from 'playwright';
import { supabase } from './utils/db';
import { scrapeCompany } from './scrape-company';
import { config } from './config';
import { log, logError } from './utils/logger';

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeAll(): Promise<void> {
  // Clean up old "running" records (older than 30 minutes) before checking for active scrapes
  // This handles cases where the scraper crashed and left stale records
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from('scrape_logs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: 'Timed out - likely crashed or stalled',
      })
      .eq('status', 'running')
      .lt('started_at', thirtyMinutesAgo);

    if (cleanupError) {
      logError('Error cleaning up old scrape logs:', cleanupError.message);
    }
  } catch (err) {
    logError('Error during timeout cleanup:', err instanceof Error ? err.message : String(err));
  }

  // Concurrency guard: check if any scrape is currently running
  const { data: runningLogs } = await supabase
    .from('scrape_logs')
    .select('id')
    .eq('status', 'running')
    .limit(1);

  if (runningLogs && runningLogs.length > 0) {
    log('Scrape already in progress, skipping');
    return;
  }

  // Get active companies
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, career_page_url')
    .eq('is_active', true)
    .order('name');

  if (error) {
    logError('Failed to fetch companies:', error.message);
    logError('  Error details:', JSON.stringify(error));
    return;
  }

  if (!companies || companies.length === 0) {
    log('No active companies to scrape');
    log(`  Query returned: data=${companies === null ? 'null' : '[]'}, error=${error}`);
    return;
  }

  log(`Starting scrape for ${companies.length} companies`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  try {
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];

      // Create scrape log entry
      const { data: logEntry } = await supabase
        .from('scrape_logs')
        .insert({
          company_id: company.id,
          status: 'running',
        })
        .select()
        .single();

      try {
        const result = await scrapeCompany(browser, company);

        // Update scrape log with success
        if (logEntry) {
          await supabase
            .from('scrape_logs')
            .update({
              status: 'success',
              completed_at: new Date().toISOString(),
              jobs_found: result.jobsFound,
              jobs_new: result.jobsNew,
              pages_scraped: result.pagesScraped,
            })
            .eq('id', logEntry.id);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logError(`Failed to scrape ${company.name}: ${errorMsg}`);

        // Update scrape log with error
        if (logEntry) {
          await supabase
            .from('scrape_logs')
            .update({
              status: 'error',
              completed_at: new Date().toISOString(),
              error_message: errorMsg,
            })
            .eq('id', logEntry.id);
        }

        // Retry once
        if (config.retryCount > 0) {
          log(`  Retrying ${company.name} in ${config.retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, config.retryDelay));

          try {
            const retryResult = await scrapeCompany(browser, company);
            if (logEntry) {
              await supabase
                .from('scrape_logs')
                .update({
                  status: 'success',
                  completed_at: new Date().toISOString(),
                  jobs_found: retryResult.jobsFound,
                  jobs_new: retryResult.jobsNew,
                  pages_scraped: retryResult.pagesScraped,
                  error_message: `Succeeded on retry. Original error: ${errorMsg}`,
                })
                .eq('id', logEntry.id);
            }
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            logError(`  Retry failed for ${company.name}: ${retryMsg}`);
          }
        }
      }

      // Random delay between companies (except after last one)
      if (i < companies.length - 1) {
        await randomDelay(
          config.delayBetweenCompanies.min,
          config.delayBetweenCompanies.max
        );
      }
    }
  } finally {
    await browser.close();
  }

  log('Scrape complete');
}
