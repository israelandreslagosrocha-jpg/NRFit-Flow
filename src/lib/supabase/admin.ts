import { createClient } from '@supabase/supabase-js';

/**
 * Cliente administrativo de Supabase con Service Role Key.
 * Usado exclusivamente en Server Routes de backend (Webhooks, Outbox Worker)
 * para transacciones atómicas seguras y operaciones fuera del contexto de sesión de usuario.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Nunca degradar operaciones privilegiadas a la anon key: una operación de
  // pagos, contenido o administración debe fallar explícitamente si el entorno
  // no fue configurado con una credencial de servidor.
  if (!supabaseServiceKey) {
    throw new Error('SERVER_CONFIGURATION_ERROR: SUPABASE_SERVICE_ROLE_KEY is required for privileged operations.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
