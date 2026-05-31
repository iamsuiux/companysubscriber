import type { Page } from 'playwright';
import { extractJobsFromJSON, type ExtractedJob } from './json-extractor';
import { extractJobsFromDOM } from './dom-extractor';
import { log } from '../utils/logger';

export type { ExtractedJob };

export async function extractJobs(page: Page): Promise<ExtractedJob[]> {
  // Try JSON extraction first (more reliable when available)
  const jsonJobs = await extractJobsFromJSON(page);
  if (jsonJobs && jsonJobs.length > 0) {
    return jsonJobs;
  }

  // Fall back to DOM extraction
  log('  JSON extraction found nothing, trying DOM extraction...');
  return extractJobsFromDOM(page);
}
