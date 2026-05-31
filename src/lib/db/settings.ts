import { supabaseServer } from '@/lib/supabase/server';
import type { Setting } from '@/types';

export async function getAllSettings(): Promise<Setting[]> {
  const { data, error } = await supabaseServer
    .from('settings')
    .select('*')
    .order('key');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data?.value || null;
}

export async function updateSetting(key: string, value: string): Promise<Setting> {
  const { data, error } = await supabaseServer
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
