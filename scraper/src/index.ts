import express from 'express';
import cron from 'node-cron';
import { config } from './config';
import { scrapeAll } from './scrape-all';
import { log, logError } from './utils/logger';
import { supabase } from './utils/db';

const app = express();
app.use(express.json());

let isShuttingDown = false;

// Clean up stale scrape logs on startup
async function cleanupStaleScrapeLogs() {
  try {
    const { data: stuckLogs } = await supabase
      .from('scrape_logs')
      .select('id')
      .eq('status', 'running');

    if (stuckLogs && stuckLogs.length > 0) {
      const { error } = await supabase
        .from('scrape_logs')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: 'Cleared stale scrape from previous run',
        })
        .eq('status', 'running');

      if (error) {
        logError('Failed to cleanup stale logs:', error.message);
      } else {
        log(`Cleaned up ${stuckLogs.length} stale scrape log(s) from previous run`);
      }
    }
  } catch (err) {
    logError('Error during startup cleanup:', err instanceof Error ? err.message : String(err));
  }
}

// Graceful shutdown handler
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('Shutting down gracefully...');

  try {
    // Mark all running scrapes as errors
    const { error } = await supabase
      .from('scrape_logs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: 'Scraper service stopped',
      })
      .eq('status', 'running');

    if (error) {
      logError('Error marking scrapes as stopped:', error.message);
    } else {
      log('Marked running scrapes as stopped');
    }
  } catch (err) {
    logError('Error during shutdown:', err instanceof Error ? err.message : String(err));
  }

  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Auth middleware for scrape endpoint
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== config.scraperApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Trigger scrape
app.post('/api/scrape', authMiddleware, (_req, res) => {
  // Return immediately, run scrape in background
  res.json({ data: { message: 'Scrape started' } });

  scrapeAll().catch((err) => {
    logError('Scrape failed:', err);
  });
});

// Schedule the daily auto-scrape. Reuses scrapeAll(), whose own running-check
// makes this safe to overlap with manual triggers (the second one is skipped).
// node-cron fires only on schedule (never on startup).
function scheduleDailyScrape() {
  if (!config.scrapeCronEnabled) {
    log('Daily auto-scrape disabled (SCRAPE_CRON_ENABLED=false)');
    return;
  }

  if (!cron.validate(config.scrapeCronExpr)) {
    logError(
      `Invalid SCRAPE_CRON_EXPR "${config.scrapeCronExpr}" - daily auto-scrape not scheduled`
    );
    return;
  }

  cron.schedule(
    config.scrapeCronExpr,
    () => {
      log(
        `Scheduled scrape firing (${config.scrapeCronExpr} ${config.scrapeCronTimezone})`
      );
      scrapeAll().catch((err) => logError('Scheduled scrape failed:', err));
    },
    { timezone: config.scrapeCronTimezone }
  );

  log(
    `Daily auto-scrape scheduled: ${config.scrapeCronExpr} (${config.scrapeCronTimezone})`
  );
}

const server = app.listen(config.port, async () => {
  log(`Scraper service running on port ${config.port}`);
  // Clean up any stale scrape logs from previous runs
  await cleanupStaleScrapeLogs();
  // Register the recurring daily scrape
  scheduleDailyScrape();
});

// Ensure graceful shutdown when server closes
server.on('close', gracefulShutdown);
