import { readFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const CSV_PATH = resolve(import.meta.dirname, '..', 'greenhouse_company_career_pages.csv');

function parseCSV(content: string): Array<{ name: string; career_page_url: string }> {
  const lines = content.trim().split('\n');
  // Skip header row
  const dataLines = lines.slice(1);
  const results: Array<{ name: string; career_page_url: string }> = [];

  for (const line of dataLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let name: string;
    let career_page_url: string;

    if (trimmed.startsWith('"')) {
      // Quoted company name (e.g., "Keyfactor, Inc.",https://...)
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      name = trimmed.substring(1, closingQuote);
      // Skip the closing quote and comma
      career_page_url = trimmed.substring(closingQuote + 2);
    } else {
      const commaIndex = trimmed.indexOf(',');
      if (commaIndex === -1) continue;
      name = trimmed.substring(0, commaIndex);
      career_page_url = trimmed.substring(commaIndex + 1);
    }

    name = name.trim();
    career_page_url = career_page_url.trim();

    if (name && career_page_url) {
      results.push({ name, career_page_url });
    }
  }

  return results;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    redirect: 'manual',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }

  const setCookie = res.headers.getSetCookie();
  const sessionCookie = setCookie.find((c) => c.startsWith('session='));
  if (!sessionCookie) {
    throw new Error('No session cookie returned from login');
  }

  // Extract just the cookie value (session=<token>; Path=/; ...)
  const token = sessionCookie.split(';')[0];
  return token;
}

async function addCompany(
  cookie: string,
  name: string,
  career_page_url: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ name, career_page_url }),
  });

  if (res.ok) {
    return { ok: true };
  }

  const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
  return { ok: false, error: body?.error?.message || `HTTP ${res.status}` };
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  let limit = 10; // default
  if (limitArg) {
    const eqIndex = limitArg.indexOf('=');
    if (eqIndex !== -1) {
      limit = parseInt(limitArg.substring(eqIndex + 1), 10);
    } else {
      const nextIdx = process.argv.indexOf(limitArg) + 1;
      if (nextIdx < process.argv.length) {
        limit = parseInt(process.argv[nextIdx], 10);
      }
    }
  }

  if (process.argv.includes('--all')) {
    limit = Infinity;
  }

  console.log(`Reading CSV from: ${CSV_PATH}`);
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const companies = parseCSV(csvContent);
  const batch = companies.slice(0, limit);

  console.log(`Found ${companies.length} companies in CSV, importing first ${Math.min(limit, companies.length)}`);
  console.log(`Target: ${BASE_URL}\n`);

  console.log('Logging in...');
  const cookie = await login();
  console.log('Logged in successfully.\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const { name, career_page_url } = batch[i];
    const result = await addCompany(cookie, name, career_page_url);

    if (result.ok) {
      success++;
      console.log(`[${i + 1}/${batch.length}] Added: ${name}`);
    } else {
      failed++;
      console.log(`[${i + 1}/${batch.length}] FAILED: ${name} -- ${result.error}`);
    }

    // Small delay between requests
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nDone. ${success} added, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
