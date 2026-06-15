import { ExtractedJob } from '../extractors/json-extractor';

/**
 * Check if a job title matches any of the provided keywords (case-insensitive, partial match)
 */
function matchesKeywords(title: string, keywords: string[]): boolean {
  const lowerTitle = title.toLowerCase();
  return keywords.some(keyword =>
    lowerTitle.includes(keyword.toLowerCase().trim())
  );
}

/**
 * Filter jobs by title keywords
 * @param jobs - Array of extracted jobs
 * @param keywords - Array of keywords to match (OR logic)
 * @returns Filtered array of jobs that match at least one keyword
 */
export function filterJobsByTitle(
  jobs: ExtractedJob[],
  keywords: string[]
): ExtractedJob[] {
  if (!keywords || keywords.length === 0) {
    return jobs; // If no keywords configured, return all jobs
  }

  return jobs.filter(job => matchesKeywords(job.title, keywords));
}

/**
 * Parse keywords from comma-separated string
 * @param keywordsString - Comma-separated keywords (e.g., "software,engineer,developer")
 * @returns Array of trimmed, non-empty keywords
 */
export function parseKeywords(keywordsString: string): string[] {
  return keywordsString
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}
