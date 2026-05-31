import type { Page } from 'playwright';
import { log } from '../utils/logger';

export interface ExtractedJob {
  title: string;
  url: string | null;
}

export async function extractJobsFromJSON(page: Page): Promise<ExtractedJob[] | null> {
  // Strategy 1: window.__appData (Ashby HQ pattern)
  const appDataJobs = await page.evaluate(() => {
    const appData = (window as unknown as Record<string, unknown>).__appData;
    if (!appData || typeof appData !== 'object') return null;

    const data = appData as Record<string, unknown>;
    const jobBoard = data.jobBoard as Record<string, unknown> | undefined;
    if (!jobBoard) return null;

    const postings = jobBoard.jobPostings as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(postings)) return null;

    // Log sample posting keys for debugging
    if (postings.length > 0) {
      console.log('[json-extractor] Sample posting keys:', Object.keys(postings[0]).join(', '));
    }

    const basePath = window.location.origin + window.location.pathname;

    return postings
      .filter((p) => p.isListed !== false)
      .map((p) => {
        // Try multiple fields for URL construction
        const postingId = p.jobPostingId || p.id || p.externalLink;
        const directUrl = p.publishedJobUrl || p.jobUrl || p.url || p.externalUrl;

        let url: string | null = null;
        if (directUrl) {
          url = String(directUrl);
        } else if (postingId) {
          url = `${basePath}/${postingId}`;
        }

        return {
          title: String(p.title || ''),
          url,
        };
      })
      .filter((j) => j.title.length > 0);
  });

  if (appDataJobs && appDataJobs.length > 0) {
    log(`  JSON extractor (appData): found ${appDataJobs.length} jobs`);
    return appDataJobs;
  }

  // Strategy 2: window.__NEXT_DATA__ (Next.js pattern)
  const nextDataJobs = await page.evaluate(() => {
    const nextData = (window as unknown as Record<string, unknown>).__NEXT_DATA__;
    if (!nextData || typeof nextData !== 'object') return null;

    const data = nextData as Record<string, unknown>;
    const props = data.props as Record<string, unknown> | undefined;
    if (!props) return null;

    const pageProps = props.pageProps as Record<string, unknown> | undefined;
    if (!pageProps) return null;

    // Search recursively for arrays that look like job listings
    function findJobArrays(obj: unknown, depth: number = 0): Array<{ title: string; url: string | null }> {
      if (depth > 5 || !obj || typeof obj !== 'object') return [];
      if (Array.isArray(obj)) {
        const hasJobs = obj.some(
          (item) =>
            item &&
            typeof item === 'object' &&
            ('title' in item || 'name' in item || 'jobTitle' in item)
        );
        if (hasJobs && obj.length > 0) {
          return obj
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
              const record = item as Record<string, unknown>;
              return {
                title: String(record.title || record.name || record.jobTitle || ''),
                url: record.url
                  ? String(record.url)
                  : record.slug
                    ? `${window.location.origin}/jobs/${record.slug}`
                    : null,
              };
            })
            .filter((j) => j.title.length > 0);
        }
      }
      const record = obj as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const result = findJobArrays(record[key], depth + 1);
        if (result.length > 0) return result;
      }
      return [];
    }

    return findJobArrays(pageProps);
  });

  if (nextDataJobs && nextDataJobs.length > 0) {
    log(`  JSON extractor (__NEXT_DATA__): found ${nextDataJobs.length} jobs`);
    return nextDataJobs;
  }

  // Strategy 3: JSON-LD scripts
  const jsonLdJobs = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const jobs: Array<{ title: string; url: string | null }> = [];

    scripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (Array.isArray(data)) {
          data.forEach((item: Record<string, unknown>) => {
            if (item['@type'] === 'JobPosting' && item.title) {
              jobs.push({
                title: String(item.title),
                url: item.url ? String(item.url) : null,
              });
            }
          });
        } else if (data['@type'] === 'JobPosting' && data.title) {
          jobs.push({
            title: String(data.title),
            url: data.url ? String(data.url) : null,
          });
        } else if (data['@graph'] && Array.isArray(data['@graph'])) {
          data['@graph'].forEach((item: Record<string, unknown>) => {
            if (item['@type'] === 'JobPosting' && item.title) {
              jobs.push({
                title: String(item.title),
                url: item.url ? String(item.url) : null,
              });
            }
          });
        }
      } catch {
        // Skip invalid JSON-LD
      }
    });

    return jobs.length > 0 ? jobs : null;
  });

  if (jsonLdJobs && jsonLdJobs.length > 0) {
    log(`  JSON extractor (JSON-LD): found ${jsonLdJobs.length} jobs`);
    return jsonLdJobs;
  }

  return null;
}
