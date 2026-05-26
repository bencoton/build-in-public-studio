// Shared utility type for jsonb / json values. Row types now live in
// their callsite modules (src/lib/notes.ts, src/lib/moments.ts, etc.)
// alongside the queries that return them.
//
// The Supabase-generated `Database<...>` wrapper was removed when the app
// migrated from supabase-js to postgres.js — postgres.js returns plain
// rows and we type each query inline with `sql<Row[]>` template generics.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
