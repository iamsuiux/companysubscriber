import express from 'express';
import { config } from './config';
import { scrapeAll } from './scrape-all';
import { log, logError } from './utils/logger';

const app = express();
app.use(express.json());

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

app.listen(config.port, () => {
  log(`Scraper service running on port ${config.port}`);
});
