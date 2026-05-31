import type { Page } from 'playwright';
import { log } from '../utils/logger';
import type { ExtractedJob } from './json-extractor';

export async function extractJobsFromDOM(page: Page): Promise<ExtractedJob[]> {
  const jobs = await page.evaluate(() => {
    const baseUrl = window.location.origin;
    const results: Array<{ title: string; url: string | null }> = [];
    const seen = new Set<string>();

    // Use object methods to avoid esbuild __name injection in browser context.
    // esbuild's --keep-names wraps all named variable assignments (const/let/var)
    // with __name(), which doesn't exist in the browser. Object methods are safe.
    const _ = {
      resolveUrl(href: string): string {
        try {
          return new URL(href, baseUrl).href;
        } catch {
          return href;
        }
      },
      isJobTitle(text: string): boolean {
        const trimmed = text.trim();
        return trimmed.length >= 3 && trimmed.length <= 200 && !trimmed.includes('\n');
      },
    };

    // Strategy 1: Links with job-related href patterns
    const jobLinkSelectors = [
      'a[href*="/jobs/"]',
      'a[href*="/job/"]',
      'a[href*="/careers/"]',
      'a[href*="/career/"]',
      'a[href*="/positions/"]',
      'a[href*="/position/"]',
      'a[href*="/openings/"]',
      'a[href*="/opening/"]',
      'a[href*="/apply/"]',
      'a[href*="/role/"]',
      'a[href*="/roles/"]',
    ];

    for (const selector of jobLinkSelectors) {
      const links = document.querySelectorAll<HTMLAnchorElement>(selector);
      links.forEach((link) => {
        const title = link.textContent?.trim() || '';
        const href = link.getAttribute('href');
        if (!href || !_.isJobTitle(title)) return;

        // Skip navigation links, footer links, etc.
        const parent = link.closest('nav, footer, header');
        if (parent) return;

        const url = _.resolveUrl(href);
        const key = `${title}|${url}`;
        if (seen.has(key)) return;
        seen.add(key);

        results.push({ title, url });
      });
    }

    if (results.length > 0) return results;

    // Strategy 2: Links inside containers with job-related class/id names
    const containerSelectors = [
      '[class*="job"] a',
      '[class*="Job"] a',
      '[class*="position"] a',
      '[class*="Position"] a',
      '[class*="opening"] a',
      '[class*="Opening"] a',
      '[class*="career"] a',
      '[class*="Career"] a',
      '[class*="listing"] a',
      '[class*="Listing"] a',
      '[id*="job"] a',
      '[id*="Job"] a',
      '[data-testid*="job"] a',
    ];

    for (const selector of containerSelectors) {
      try {
        const links = document.querySelectorAll<HTMLAnchorElement>(selector);
        links.forEach((link) => {
          const title = link.textContent?.trim() || '';
          const href = link.getAttribute('href');
          if (!_.isJobTitle(title)) return;

          const url = href ? _.resolveUrl(href) : null;
          const key = `${title}|${url}`;
          if (seen.has(key)) return;
          seen.add(key);

          results.push({ title, url });
        });
      } catch {
        // Invalid selector, skip
      }
    }

    if (results.length > 0) return results;

    // Strategy 3: Look for repeated list items or card patterns with links
    const listItems = document.querySelectorAll('li a, [role="listitem"] a, .card a, [class*="card"] a');
    listItems.forEach((link) => {
      const anchor = link as HTMLAnchorElement;
      const title = anchor.textContent?.trim() || '';
      const href = anchor.getAttribute('href');
      if (!_.isJobTitle(title) || !href) return;

      const parent = anchor.closest('nav, footer, header');
      if (parent) return;

      const url = _.resolveUrl(href);
      const key = `${title}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);

      results.push({ title, url });
    });

    return results;
  });

  log(`  DOM extractor: found ${jobs.length} jobs`);
  return jobs;
}
