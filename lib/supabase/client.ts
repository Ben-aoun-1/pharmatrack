import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — use inside Client Components.
// Uses the public anon key; row-level security enforces per-pharmacy isolation.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
