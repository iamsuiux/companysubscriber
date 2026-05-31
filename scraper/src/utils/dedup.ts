import { createHash } from 'crypto';

export function generateDedupHash(
  companyId: string,
  title: string,
  jobUrl: string | null
): string {
  const input = `${companyId}${title.toLowerCase().trim()}${jobUrl || ''}`;
  return createHash('md5').update(input).digest('hex');
}
