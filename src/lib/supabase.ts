import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns a Supabase browser client (singleton).
 * Returns null if env vars are not configured.
 */
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    client = createBrowserClient(url, key);
    return client;
  } catch {
    return null;
  }
}
