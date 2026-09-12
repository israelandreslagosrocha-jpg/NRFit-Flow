import { createClient } from '@supabase/supabase-js';

/**
 * Cliente administrativo de Supabase con Service Role Key.
 * Usado exclusivamente en Server Routes de backend (Webhooks, Outbox Worker)
 * para transacciones atómicas seguras y operaciones fuera del contexto de sesión de usuario.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
  // En producción se usa SUPABASE_SERVICE_ROLE_KEY; si no está definida en dev/test, fallback a anon key
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
