export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export type UserWithoutPassword = Omit<User, 'password_hash'>;

export interface Company {
  id: string;
  name: string;
  career_page_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_scraped_at: string | null;
}

export interface Job {
  id: string;
  company_id: string;
  title: string;
  job_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  dedup_hash: string;
}

export interface JobWithCompany extends Job {
  company: Pick<Company, 'name'>;
}

export interface ScrapeLog {
  id: string;
  company_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  jobs_found: number;
  jobs_new: number;
  error_message: string | null;
  pages_scraped: number;
}

export interface ScrapeLogWithCompany extends ScrapeLog {
  company: Pick<Company, 'name'>;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}
