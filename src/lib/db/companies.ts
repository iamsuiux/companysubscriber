import { supabaseServer } from '@/lib/supabase/server';
import type { Company } from '@/types';

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await supabaseServer
    .from('companies')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getActiveCompanies(): Promise<Company[]> {
  const { data, error } = await supabaseServer
    .from('companies')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await supabaseServer
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function createCompany(
  name: string,
  careerPageUrl: string
): Promise<Company> {
  const { data, error } = await supabaseServer
    .from('companies')
    .insert({ name, career_page_url: careerPageUrl })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCompany(
  id: string,
  updates: Partial<Pick<Company, 'name' | 'career_page_url' | 'is_active'>>
): Promise<Company> {
  const { data, error } = await supabaseServer
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
