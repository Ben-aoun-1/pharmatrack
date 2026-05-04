import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client — admin operations only (creating pharmacies,
// generating license keys, ingesting agent transactions). Bypasses RLS.
//
// NEVER import this into a Client Component or expose the service-role key to
// the browser. Server-side code paths only (Route Handlers / Server Actions).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
