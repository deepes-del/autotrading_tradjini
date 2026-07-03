import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Clears the cached Supabase client instance.
 * Useful when environment variables are updated on-the-fly.
 */
export function clearSupabaseClient(): void {
  supabaseClientInstance = null;
}

/**
 * Checks if Supabase credentials have been configured in the environment.
 */
export function isSupabaseConfigured(): boolean {
  try {
    const isServer = typeof process !== 'undefined' && process.env;
    const url = isServer 
      ? (process.env.SUPABASE_URL || (process.env as any).VITE_SUPABASE_URL)
      : ((import.meta as any).env.VITE_SUPABASE_URL);
    const key = isServer
      ? (process.env.SUPABASE_ANON_KEY || (process.env as any).VITE_SUPABASE_ANON_KEY)
      : ((import.meta as any).env.VITE_SUPABASE_ANON_KEY);
      
    return !!(url && key);
  } catch {
    return false;
  }
}

/**
 * Returns a lazily-initialized Supabase Client instance.
 */
export function getSupabase(): SupabaseClient {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const isServer = typeof process !== 'undefined' && process.env;
  
  const supabaseUrl = isServer 
    ? (process.env.SUPABASE_URL || (process.env as any).VITE_SUPABASE_URL)
    : ((import.meta as any).env.VITE_SUPABASE_URL);
    
  const supabaseKey = isServer
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || (process.env as any).VITE_SUPABASE_ANON_KEY)
    : ((import.meta as any).env.VITE_SUPABASE_ANON_KEY);

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not defined in the environment.');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY is not defined in the environment.');
  }

  supabaseClientInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClientInstance;
}
