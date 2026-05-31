import type { Page } from 'playwright';
import type { PaginationInfo } from './detector';
import { extractJobs } from '../extractors';
import type { ExtractedJob } from '../extractors';
import { config } from '../config';
import { log } from '../utils/logger';

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handlePagination(
  page: Page,
  pagination: PaginationInfo,
  initialJobs: ExtractedJob[]
): Promise<{ allJobs: ExtractedJob[]; pagesScraped: number }> {
  if (pagination.type === 'none') {
    return { allJobs: initialJobs, pagesScraped: 1 };
  }

  const allJobs = [...initialJobs];
  const seenTitles = new Set(initialJobs.map((j) => `${j.title}|${j.url}`));
  let pagesScraped = 1;

  for (let pageNum = 2; pageNum <= config.maxPages; pageNum++) {
    await randomDelay(config.delayBetweenPages.min, config.delayBetweenPages.max);

    let navigated = false;

    if (pagination.type === 'next-button') {
      navigated = await clickNextButton(page);
    } else if (pagination.type === 'load-more') {
      navigated = await clickLoadMore(page, pagination.selector);
    } else if (pagination.type === 'numbered') {
      navigated = await clickPageNumber(page, pageNum, pagination.selector);
    }

    if (!navigated) {
      log(`  No more pages after page ${pagesScraped}`);
      break;
    }

    // Wait for content to update
    await page.waitForTimeout(2000);

    const pageJobs = await extractJobs(page);
    let newCount = 0;

    for (const job of pageJobs) {
      const key = `${job.title}|${job.url}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allJobs.push(job);
        newCount++;
      }
    }

    pagesScraped++;
    log(`  Page ${pagesScraped}: found ${pageJobs.length} jobs (${newCount} new)`);

    // If no new jobs found, stop paginating
    if (newCount === 0) {
      log('  No new jobs on this page, stopping pagination');
      break;
    }
  }

  return { allJobs, pagesScraped };
}

async function clickNextButton(page: Page): Promise<boolean> {
  const selectors = [
    'a[aria-label*="next" i]',
    'a[aria-label*="Next"]',
    'button[aria-label*="next" i]',
    'button[aria-label*="Next"]',
    'a[rel="next"]',
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isDisabled = await el.evaluate(
          (node) =>
            node.hasAttribute('disabled') ||
            node.classList.contains('disabled') ||
            node.getAttribute('aria-disabled') === 'true'
        );
        if (!isDisabled) {
          await el.click();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  // Try text-based selectors
  try {
    const nextLink = await page.$('a:has-text("Next"), button:has-text("Next")');
    if (nextLink) {
      await nextLink.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return true;
    }
  } catch {
    // No next button found
  }

  return false;
}

async function clickLoadMore(page: Page, selector?: string): Promise<boolean> {
  try {
    if (selector) {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await page.waitForTimeout(2000);
        return true;
      }
    }

    // Try common load more text patterns
    const el = await page.$(
      'button:has-text("Load More"), button:has-text("Show More"), a:has-text("Load More")'
    );
    if (el) {
      await el.click();
      await page.waitForTimeout(2000);
      return true;
    }
  } catch {
    // No load more button
  }

  return false;
}

async function clickPageNumber(
  page: Page,
  pageNum: number,
  containerSelector?: string
): Promise<boolean> {
  try {
    const selector = containerSelector
      ? `${containerSelector} a:has-text("${pageNum}"), ${containerSelector} button:has-text("${pageNum}")`
      : `.pagination a:has-text("${pageNum}"), [class*="pagination"] a:has-text("${pageNum}")`;

    const el = await page.$(selector);
    if (el) {
      await el.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return true;
    }
  } catch {
    // No page number button
  }

  return false;
}
