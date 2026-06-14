const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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

  return sessionCookie.split(';')[0];
}

interface Company {
  id: string;
  name: string;
}

async function getAllCompanies(cookie: string): Promise<Company[]> {
  const res = await fetch(`${BASE_URL}/api/companies`, {
    headers: { Cookie: cookie },
  });

  if (!res.ok) throw new Error(`Failed to fetch companies (${res.status})`);

  const body = await res.json();
  return body.data;
}

async function deleteCompany(cookie: string, id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/companies/${id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });

  return res.ok;
}

async function main() {
  console.log(`Target: ${BASE_URL}\n`);

  console.log('Logging in...');
  const cookie = await login();
  console.log('Logged in successfully.\n');

  console.log('Fetching all companies...');
  const companies = await getAllCompanies(cookie);
  console.log(`Found ${companies.length} companies to delete.\n`);

  if (companies.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const { id, name } = companies[i];
    const ok = await deleteCompany(cookie, id);

    if (ok) {
      success++;
      console.log(`[${i + 1}/${companies.length}] Deleted: ${name}`);
    } else {
      failed++;
      console.log(`[${i + 1}/${companies.length}] FAILED: ${name}`);
    }
  }

  console.log(`\nDone. ${success} deleted, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
