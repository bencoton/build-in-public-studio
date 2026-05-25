import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/*
  Server-side Supabase client singleton.

  Uses the SERVICE ROLE key (not the anon key) because all our DB access
  happens from server actions or server components. The service role key
  bypasses Row Level Security entirely, which is the right behaviour for a
  single-user tool with no end-user authentication — we just want admin-style
  access to the user's own data.

  IMPORTANT: this module must never be imported by a client component.
  The service role key is a secret that absolutely cannot ship to the
  browser. Next.js's compile-time checks should prevent this (the env var
  name doesn't start with NEXT_PUBLIC_, so it's only available server-side),
  but treat this file as server-only by convention too.

  Sessions and token refresh are disabled because we're not handling user
  sessions — every call is a one-shot server-side query.
*/

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local — see .env.local.example.",
  );
}
if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local — see .env.local.example.",
  );
}

export const supabase = createClient<Database>(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
