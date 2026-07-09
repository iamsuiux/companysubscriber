'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Briefcase, Building2, Clock, Play, Loader2, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { JobWithCompany } from '@/types';

interface DashboardData {
  stats: {
    newJobCount: number;
    companyCount: number;
    lastScrapeAt: string | null;
  };
  jobs: JobWithCompany[];
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
        toast.success('Scrape started successfully', {
          description: 'The scraper is now running. This may take several minutes...',
        });
      } else {
        toast.error('Failed to start scrape', {
          description: data.error?.message || 'An error occurred while starting the scrape',
        });
      }
    } catch {
      toast.error('Failed to start scrape', {
        description: 'Could not connect to the scraper service',
      });
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Jobs discovered in the last 7 days" />

        {/* Skeleton Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Skeleton Button */}
        <Skeleton className="h-10 w-32 mb-8" />

        {/* Skeleton Jobs List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-6 py-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
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
            <span className="text-sm text-muted-foreground">Scraping in progress...</span>
          )}
          <button
            onClick={handleRunNow}
            disabled={triggering || isRunning}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
          >
            {triggering || isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRunning ? 'Scraping...' : 'Starting...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Run Now</span>
                <span className="sm:hidden">Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* New Jobs Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">New Jobs</p>
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.stats.newJobCount}</p>
          <p className="text-xs text-blue-600 mt-2">in the last 7 days</p>
        </div>

        {/* Companies Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Companies</p>
            <Building2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.stats.companyCount}</p>
          <p className="text-xs text-green-600 mt-2">being monitored</p>
        </div>

        {/* Last Scrape Card */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Last Scrape</p>
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.stats.lastScrapeAt
              ? formatDistanceToNow(new Date(data.stats.lastScrapeAt), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* All new jobs, sorted by date (newest first) */}
      {data.jobs.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No new jobs found in the last 7 days."
          description="Add companies and run a scrape to discover job postings."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">New Jobs</h3>
            <span className="inline-block text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              {data.jobs.length} {data.jobs.length === 1 ? 'job' : 'jobs'}
            </span>
          </div>
          <ul className="divide-y divide-gray-100 list-none">
            {data.jobs.map((job) => (
              <li
                key={job.id}
                className="px-4 sm:px-6 py-4 hover:bg-blue-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  {job.job_url ? (
                    <>
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2 group"
                      >
                        {job.title}
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                      <p className="text-xs text-gray-500 truncate mt-1">{job.job_url}</p>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">
                      {job.title}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {job.company?.name || 'Unknown'}
                    </span>
                    {job.location && (
                      <span className="inline-block text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {job.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(job.first_seen_at), 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
