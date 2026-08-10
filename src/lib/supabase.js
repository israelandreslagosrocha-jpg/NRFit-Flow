import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Fallback checking to prevent crashes if anon key is not set yet
export const isSupabaseConfigured = Boolean(supabaseAnonKey && supabaseAnonKey !== 'TU_SUPABASE_ANON_KEY_AQUI');

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
