/**
 * Runtime configuration for Supabase.
 *
 * New Supabase publishable/secret keys are preferred. The legacy anon and
 * service_role variables remain only as an explicit compatibility path while
 * the production rollout is verified.
 */
export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error('SERVER_CONFIGURATION_ERROR: NEXT_PUBLIC_SUPABASE_URL is required.');
  }

  return value;
}

export function getSupabasePublishableKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error(
      'SERVER_CONFIGURATION_ERROR: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is supported temporarily).'
    );
  }

  return value;
}

export function getSupabaseSecretKey(): string {
  const value = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error(
      'SERVER_CONFIGURATION_ERROR: SUPABASE_SECRET_KEY is required (legacy SUPABASE_SERVICE_ROLE_KEY is supported temporarily).'
    );
  }

  return value;
}
