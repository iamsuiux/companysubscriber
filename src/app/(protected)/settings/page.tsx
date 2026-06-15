'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from 'sonner';
import type { ScrapeLogWithCompany } from '@/types';

export default function SettingsPage() {
  const [logs, setLogs] = useState<ScrapeLogWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTitleKeywords, setJobTitleKeywords] = useState<string>('');
  const [savingKeywords, setSavingKeywords] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/scrape/logs');
      const data = await res.json();
      setLogs(data.data?.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      const { data } = await response.json();

      const keywordsSetting = data?.find((s: any) => s.key === 'job_title_keywords');
      if (keywordsSetting) {
        setJobTitleKeywords(keywordsSetting.value);
      } else {
        setJobTitleKeywords('software,engineer,developer');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setJobTitleKeywords('software,engineer,developer');
    }
  }, []);

  const saveKeywords = async () => {
    setSavingKeywords(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'job_title_keywords',
          value: jobTitleKeywords
        })
      });

      if (response.ok) {
        toast.success('Keywords updated successfully');
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to update keywords');
      }
    } catch (error) {
      console.error('Failed to save keywords:', error);
      toast.error('Failed to update keywords');
    } finally {
      setSavingKeywords(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [fetchData, fetchSettings]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" description="Scrape logs and diagnostics" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Scrape logs and diagnostics" />

      {/* Job Title Filtering Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Job Title Filtering</h2>
        <p className="text-sm text-gray-600 mb-4">
          Only jobs containing these keywords will be saved. Separate keywords with commas.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={jobTitleKeywords}
              onChange={(e) => setJobTitleKeywords(e.target.value)}
              placeholder="software,engineer,developer"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: software,engineer,developer
            </p>
          </div>

          <button
            onClick={saveKeywords}
            disabled={savingKeywords}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {savingKeywords ? 'Saving...' : 'Save Keywords'}
          </button>
        </div>
      </div>

      {/* Scrape Logs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Scrape Logs</h2>

        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No scrape logs yet.</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pr-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Company
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Jobs Found
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    New
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Error
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="pr-4 py-2 text-sm text-gray-900">
                      {log.company?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : log.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {log.jobs_found}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {log.jobs_new}
                    </td>
                    <td className="px-4 py-2 text-sm text-red-500 max-w-[250px] truncate" title={log.error_message || ''}>
                      {log.error_message || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.started_at), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
