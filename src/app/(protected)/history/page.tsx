'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import type { JobWithCompany } from '@/types';

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobWithCompany[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchJobs = useCallback(async (offset: number, append: boolean = false) => {
    try {
      const res = await fetch(`/api/jobs?offset=${offset}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (data.data) {
        setJobs((prev) => (append ? [...prev, ...data.data.jobs] : data.data.jobs));
        setTotal(data.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  }, []);

  useEffect(() => {
    fetchJobs(0).finally(() => setLoading(false));
  }, [fetchJobs]);

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
          fetchJobs(0);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, fetchJobs]);

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

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchJobs(jobs.length, true);
    setLoadingMore(false);
  };

  const hasMore = jobs.length < total;

  if (loading) {
    return (
      <div>
        <PageHeader title="History" description="All scraped jobs across all time" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="History"
          description={`${total} ${total === 1 ? 'job' : 'jobs'} found`}
        />
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

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">No jobs found yet.</p>
          <p className="text-sm text-gray-400">
            Run a scrape to discover jobs from your career pages.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Job Title
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    URL
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    First Seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 text-sm">
                      {job.job_url ? (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {job.title}
                        </a>
                      ) : (
                        <span className="text-gray-900 font-medium">{job.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {job.company?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job.job_url ? (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 truncate block max-w-[250px]"
                          title={job.job_url}
                        >
                          {job.job_url}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {format(new Date(job.first_seen_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore
                  ? 'Loading...'
                  : `Load More (${total - jobs.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
