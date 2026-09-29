import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers.js';
import { getSupabasePublishableKey, getSupabaseUrl } from './environment.ts';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // El método setAll se invocó desde un Server Component
          }
        },
      },
    }
  );
}
