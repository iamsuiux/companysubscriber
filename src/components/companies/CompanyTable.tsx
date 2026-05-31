'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Company } from '@/types';

interface CompanyTableProps {
  companies: Company[];
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  onToggleActive: (company: Company) => void;
}

export function CompanyTable({
  companies,
  onEdit,
  onDelete,
  onToggleActive,
}: CompanyTableProps) {
  if (companies.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 mb-2">No companies added yet.</p>
        <p className="text-sm text-gray-400">
          Add a company career page URL to start monitoring.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Company
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Career Page URL
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Last Scraped
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Active
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {companies.map((company) => (
            <tr key={company.id} className={!company.is_active ? 'opacity-50' : ''}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {company.name}
              </td>
              <td className="px-4 py-3 text-sm">
                <a
                  href={company.career_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 truncate block max-w-xs"
                  title={company.career_page_url}
                >
                  {truncateUrl(company.career_page_url)}
                </a>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {company.last_scraped_at
                  ? formatDistanceToNow(new Date(company.last_scraped_at), {
                      addSuffix: true,
                    })
                  : 'Never'}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onToggleActive(company)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    company.is_active ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      company.is_active ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(company)}
                  className="text-sm text-gray-600 hover:text-gray-900 mr-3"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(company)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    const display = parsed.hostname + (path.length > 30 ? path.slice(0, 30) + '...' : path);
    return display;
  } catch {
    return url.length > 50 ? url.slice(0, 50) + '...' : url;
  }
}
