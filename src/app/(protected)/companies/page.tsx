'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { CompanyModal } from '@/components/companies/CompanyModal';
import { DeleteConfirmDialog } from '@/components/companies/DeleteConfirmDialog';
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
      await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !company.is_active }),
      });
      fetchCompanies();
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    try {
      await fetch(`/api/companies/${deletingCompany.id}`, {
        method: 'DELETE',
      });
      setDeletingCompany(null);
      fetchCompanies();
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Companies" description="Manage company career page URLs" />
        <p className="text-gray-500">Loading...</p>
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
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Add Company
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
