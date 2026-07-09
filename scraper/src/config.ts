import dotenv from 'dotenv';
import path from 'path';

// Load env: try scraper/.env first, then project root .env.local
// Use process.cwd() instead of __dirname for reliable resolution with tsx
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env.local') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  scraperApiKey: process.env.SCRAPER_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // OpenAI (title classification). If empty, classification is skipped.
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Daily auto-scrape schedule. Defaults to 1:00 PM America/Chicago (DST-aware).
  scrapeCronEnabled: (process.env.SCRAPE_CRON_ENABLED ?? 'true') !== 'false',
  scrapeCronExpr: process.env.SCRAPE_CRON_EXPR || '0 13 * * *', // 1:00 PM
  scrapeCronTimezone: process.env.SCRAPE_CRON_TZ || 'America/Chicago',

  // Scraping settings
  pageTimeout: 30000, // 30 seconds per page
  maxPages: 20, // max pagination pages per company
  delayBetweenCompanies: { min: 1000, max: 3000 }, // ms
  delayBetweenPages: { min: 500, max: 1500 }, // ms
  retryCount: 1,
  retryDelay: 5000, // ms
};

// Startup debug logging
const mask = (s: string) => s ? `${s.slice(0, 8)}...${s.slice(-4)}` : '(empty)';
console.log('[config] cwd:', process.cwd());
console.log('[config] supabaseUrl:', mask(config.supabaseUrl));
console.log('[config] serviceRoleKey:', mask(config.supabaseServiceRoleKey));
console.log('[config] scraperApiKey:', config.scraperApiKey ? '(set)' : '(empty)');
console.log('[config] openaiApiKey:', config.openaiApiKey ? '(set)' : '(empty)');
console.log('[config] openaiModel:', config.openaiModel);
console.log(
  '[config] scrapeCron:',
  config.scrapeCronEnabled
    ? `${config.scrapeCronExpr} (${config.scrapeCronTimezone})`
    : '(disabled)'
);
