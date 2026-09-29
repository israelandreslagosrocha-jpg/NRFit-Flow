import { createClient } from '@supabase/supabase-js';
import { getSupabaseSecretKey, getSupabaseUrl } from './environment.ts';

/**
 * Cliente administrativo de Supabase con Service Role Key.
 * Usado exclusivamente en Server Routes de backend (Webhooks, Outbox Worker)
 * para transacciones atómicas seguras y operaciones fuera del contexto de sesión de usuario.
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
