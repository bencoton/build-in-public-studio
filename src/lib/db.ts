// src/lib/db.ts
// Single Postgres connection for the app. Uses postgres.js against
// Neon's pooled (transaction-mode) connection. Replaces the retired
// src/lib/supabase.ts singleton.
//
// Notes for future-me:
// - `prepare: false` is REQUIRED for Neon's transaction-mode pooler — it
//   does not support session-level prepared statements.
// - We coerce int8/bigserial columns to plain `number`. Our `id` columns
//   are bigserials that will not exceed 2^53; every call-site treats
//   them as numbers and TS types declare them as `number`.
// - Server-side only. Never import from a client component — DATABASE_URL
//   is the DB password and the missing NEXT_PUBLIC_ prefix is what
//   keeps it out of the browser bundle.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local — see .env.local.example.",
  );
}

const sql = postgres(url, {
  // MUST be "verify-full", never "require". In postgres.js, ssl: "require"
  // (also "allow"/"prefer") sets rejectUnauthorized: false — no certificate
  // and no hostname verification at all. "verify-full" is not special-cased,
  // so it falls through to Node's tls.connect defaults (rejectUnauthorized
  // true) with servername set, which is the verification we actually want.
  // Note this explicit option OVERRIDES sslmode= in DATABASE_URL: postgres.js
  // resolves `k in o ? o[k] : query[k]`, so the option wins. The URL carries
  // sslmode=verify-full too, and the two must be kept in agreement.
  ssl: "verify-full",
  max: 5,
  prepare: false,
  types: {
    bigint: {
      to: 20,
      from: [20, 1700],
      serialize: (n: bigint | number) => String(n),
      parse: (s: string) => {
        const n = Number(s);
        if (!Number.isSafeInteger(n)) {
          throw new Error(
            `bigint value ${s} exceeds Number.MAX_SAFE_INTEGER`,
          );
        }
        return n;
      },
    },
  },
});

export default sql;
