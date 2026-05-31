'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import type { JobWithCompany } from '@/types';

interface DashboardData {
  stats: {
    newJobCount: number;
    companyCount: number;
    lastScrapeAt: string | null;
  };
  jobsByCompany: Array<{
    companyName: string;
    jobs: JobWithCompany[];
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Check initial scrape status
  useEffect(() => {
    fetch('/api/scrape/status')
      .then((res) => res.json())
      .then((data) => setIsRunning(data.data?.isRunning || false))
      .catch(() => {});
  }, []);

  // Poll for status while running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scrape/status');
        const data = await res.json();
        if (!data.data?.isRunning) {
          setIsRunning(false);
          fetchData();
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, fetchData]);

  const handleRunNow = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/scrape/trigger', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setIsRunning(true);
      } else {
        alert(data.error?.message || 'Failed to trigger scrape');
      }
    } catch {
      alert('Failed to trigger scrape');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Jobs discovered in the last 7 days" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Jobs discovered in the last 7 days" />
        <p className="text-red-500">Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Dashboard" description="Jobs discovered in the last 7 days" />
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="text-sm text-gray-500">Scraping in progress...</span>
          )}
          <button
            onClick={handleRunNow}
            disabled={triggering || isRunning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isRunning
              ? 'Scraping...'
              : triggering
                ? 'Triggering...'
                : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">New Jobs</p>
          <p className="text-2xl font-bold text-gray-900">{data.stats.newJobCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Companies Monitored</p>
          <p className="text-2xl font-bold text-gray-900">{data.stats.companyCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Last Scrape</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.stats.lastScrapeAt
              ? formatDistanceToNow(new Date(data.stats.lastScrapeAt), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Jobs by Company */}
      {data.jobsByCompany.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">No new jobs found in the last 7 days.</p>
          <p className="text-sm text-gray-400">
            Add companies and run a scrape to discover jobs.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.jobsByCompany.map((group) => (
            <div
              key={group.companyName}
              className="bg-white rounded-lg border border-gray-200"
            >
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{group.companyName}</h3>
                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {group.jobs.length} {group.jobs.length === 1 ? 'job' : 'jobs'}
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.jobs.map((job) => (
                  <li key={job.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-4">
                      {job.job_url ? (
                        <>
                          <a
                            href={job.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 block"
                          >
                            {job.title}
                          </a>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{job.job_url}</p>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {job.title}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(job.first_seen_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
