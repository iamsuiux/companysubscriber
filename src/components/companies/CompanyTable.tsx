'use client';

import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
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
      <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
        <div className="flex justify-center mb-4">
          <div className="text-4xl text-gray-300">📋</div>
        </div>
        <p className="text-gray-900 font-medium text-lg mb-2">No companies added yet.</p>
        <p className="text-gray-600">
          Add a company career page URL to start monitoring for new job postings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Company
            </th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Career Page URL
            </th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Last Scraped
            </th>
            <th className="text-center px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Active
            </th>
            <th className="text-right px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((company) => (
            <tr
              key={company.id}
              className={`hover:bg-blue-50 transition-colors ${!company.is_active ? 'opacity-50 bg-gray-50' : ''}`}
            >
              <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                {company.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                <a
                  href={company.career_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2 max-w-xs truncate"
                  title={company.career_page_url}
                >
                  <span className="truncate">{truncateUrl(company.career_page_url)}</span>
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                </a>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {company.last_scraped_at
                  ? formatDistanceToNow(new Date(company.last_scraped_at), {
                      addSuffix: true,
                    })
                  : 'Never'}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() => onToggleActive(company)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${
                    company.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  aria-label={company.is_active ? 'Disable monitoring' : 'Enable monitoring'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      company.is_active ? 'translate-x-5.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </td>
              <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                <button
                  onClick={() => onEdit(company)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit company"
                  aria-label={`Edit ${company.name}`}
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(company)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete company"
                  aria-label={`Delete ${company.name}`}
                >
                  <Trash2 className="w-5 h-5" />
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
