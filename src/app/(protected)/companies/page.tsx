'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { CompanyModal } from '@/components/companies/CompanyModal';
import { DeleteConfirmDialog } from '@/components/companies/DeleteConfirmDialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Company } from '@/types';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(data.data || []);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleAdd = () => {
    setEditingCompany(null);
    setShowModal(true);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingCompany(null);
    fetchCompanies();
  };

  const handleToggleActive = async (company: Company) => {
    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !company.is_active }),
      });

      if (response.ok) {
        toast.success(`Company ${!company.is_active ? 'activated' : 'deactivated'}`, {
          description: `${company.name} is now ${!company.is_active ? 'active' : 'inactive'}`,
        });
        fetchCompanies();
      } else {
        toast.error('Failed to update company', {
          description: 'Could not change active status',
        });
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
      toast.error('Failed to update company', {
        description: 'An error occurred while updating the company',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    try {
      const response = await fetch(`/api/companies/${deletingCompany.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Company deleted successfully', {
          description: `${deletingCompany.name} has been removed`,
        });
        setDeletingCompany(null);
        fetchCompanies();
      } else {
        toast.error('Failed to delete company', {
          description: 'Could not delete the company',
        });
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
      toast.error('Failed to delete company', {
        description: 'An error occurred while deleting the company',
      });
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Companies"
          description="Manage company career page URLs"
          action={<Skeleton className="h-10 w-32" />}
        />

        {/* Skeleton Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="text-left px-4 sm:px-6 py-4">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="text-left px-4 sm:px-6 py-4">
                  <Skeleton className="h-4 w-32" />
                </th>
                <th className="text-left px-4 sm:px-6 py-4">
                  <Skeleton className="h-4 w-20" />
                </th>
                <th className="text-right px-4 sm:px-6 py-4">
                  <Skeleton className="h-4 w-24 ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <tr key={i} className="hover:bg-blue-50">
                  <td className="px-4 sm:px-6 py-4">
                    <Skeleton className="h-5 w-32" />
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <Skeleton className="h-9 w-9 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage company career page URLs"
        action={
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Company</span>
            <span className="sm:hidden">Add</span>
          </button>
        }
      />

      <CompanyTable
        companies={companies}
        onEdit={handleEdit}
        onDelete={(company) => setDeletingCompany(company)}
        onToggleActive={handleToggleActive}
      />

      {showModal && (
        <CompanyModal
          company={editingCompany}
          onClose={() => {
            setShowModal(false);
            setEditingCompany(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {deletingCompany && (
        <DeleteConfirmDialog
          companyName={deletingCompany.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCompany(null)}
        />
      )}
    </div>
  );
}
