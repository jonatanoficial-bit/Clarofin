import type { User } from '@supabase/supabase-js';
import { parseFinanceBackup, type FinanceState } from './finance-store';
import { supabase } from './supabase';

export type CloudFinanceState = { state: FinanceState; revision: number; updatedAt: string };

export class CloudConflictError extends Error {
  constructor(public readonly remote: CloudFinanceState) { super('Os dados foram alterados em outro dispositivo.'); }
}

function asFinanceState(value: unknown): FinanceState { return parseFinanceBackup(JSON.stringify(value)); }
function asCloudRecord(value: { state: unknown; revision: number; updated_at: string }): CloudFinanceState { return { state: asFinanceState(value.state), revision: Number(value.revision), updatedAt: value.updated_at }; }

export async function ensureCloudProfile(user: User) {
  const metadata = user.user_metadata || {};
  const displayName = typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : user.email?.split('@')[0] || 'Usuário Clarofin';
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null;
  const { error } = await supabase.from('clarofin_profiles').upsert({ user_id: user.id, display_name: displayName.slice(0, 120), avatar_url: avatarUrl }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function loadCloudFinanceState(userId: string): Promise<CloudFinanceState | null> {
  const { data, error } = await supabase.from('clarofin_states').select('state, revision, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? asCloudRecord(data) : null;
}

export async function saveCloudFinanceState(userId: string, state: FinanceState, expectedRevision: number | null): Promise<CloudFinanceState> {
  const updatedAt = new Date().toISOString();
  if (expectedRevision === null) {
    const { data, error } = await supabase.from('clarofin_states').insert({ user_id: userId, state, revision: 1, updated_at: updatedAt }).select('state, revision, updated_at').single();
    if (!error && data) return asCloudRecord(data);
    const remote = await loadCloudFinanceState(userId);
    if (remote) throw new CloudConflictError(remote);
    throw error || new Error('Não foi possível iniciar a sincronização.');
  }
  const { data, error } = await supabase.from('clarofin_states').update({ state, revision: expectedRevision + 1, updated_at: updatedAt }).eq('user_id', userId).eq('revision', expectedRevision).select('state, revision, updated_at').maybeSingle();
  if (!error && data) return asCloudRecord(data);
  const remote = await loadCloudFinanceState(userId);
  if (remote) throw new CloudConflictError(remote);
  throw error || new Error('Não foi possível confirmar o salvamento na nuvem.');
}

export function watchCloudFinanceState(userId: string, onUpdate: (value: CloudFinanceState) => void) {
  return supabase.channel(`clarofin-state-${userId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clarofin_states', filter: `user_id=eq.${userId}` }, (payload) => {
    const record = payload.new as { state?: unknown; revision?: number; updated_at?: string };
    if (record.state && typeof record.revision === 'number' && typeof record.updated_at === 'string') onUpdate(asCloudRecord(record as { state: unknown; revision: number; updated_at: string }));
  }).subscribe();
}

