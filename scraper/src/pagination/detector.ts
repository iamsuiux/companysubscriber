import type { Page } from 'playwright';
import { log } from '../utils/logger';

export type PaginationType = 'next-button' | 'numbered' | 'load-more' | 'none';

export interface PaginationInfo {
  type: PaginationType;
  selector?: string;
}

export async function detectPagination(page: Page): Promise<PaginationInfo> {
  const result = await page.evaluate(() => {
    // Check for "Next" button
    const nextSelectors = [
      'a[aria-label*="next" i]',
      'a[aria-label*="Next"]',
      'button[aria-label*="next" i]',
      'button[aria-label*="Next"]',
      'a:has-text("Next")',
      'button:has-text("Next")',
      'a[rel="next"]',
      '[class*="next" i] a',
      '[class*="next" i] button',
      'a[class*="pagination-next" i]',
      '.pagination a:last-child',
      'nav[aria-label*="pagination" i] a:last-child',
    ];

    for (const selector of nextSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && !el.hasAttribute('disabled') && !el.classList.contains('disabled')) {
          return { type: 'next-button' as const, selector };
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Check for "Load More" button
    const loadMoreSelectors = [
      'button:has-text("Load More")',
      'button:has-text("Show More")',
      'button:has-text("View More")',
      'a:has-text("Load More")',
      'a:has-text("Show More")',
      '[class*="load-more" i]',
      '[class*="loadMore" i]',
      '[class*="show-more" i]',
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          return { type: 'load-more' as const, selector };
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Check for numbered pagination
    const paginationSelectors = [
      '.pagination',
      '[class*="pagination"]',
      'nav[aria-label*="pagination" i]',
      '[role="navigation"]',
    ];

    for (const selector of paginationSelectors) {
      try {
        const container = document.querySelector(selector);
        if (container) {
          const links = container.querySelectorAll('a, button');
          const hasNumbers = Array.from(links).some((link) => /^\d+$/.test(link.textContent?.trim() || ''));
          if (hasNumbers && links.length > 2) {
            return { type: 'numbered' as const, selector };
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }

    return { type: 'none' as const };
  });

  log(`  Pagination detected: ${result.type}${result.selector ? ` (${result.selector})` : ''}`);
  return result;
}
