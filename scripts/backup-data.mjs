// One-shot data backup before the Neon migration. Uses the project's
// existing @supabase/supabase-js dependency and .env.local credentials.
// Writes one JSON file per table to migration-backups/build-in-public-studio/data-2026-05-26/.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Manual .env.local parse — avoids needing dotenv as a dep.
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const eq = line.indexOf('=');
      return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
console.log('Backing up project:', url);

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ['notes', 'watched_repos', 'commits', 'moments', 'drafts', 'settings'];
const outDir = path.join('migration-backups', 'build-in-public-studio', 'data-2026-05-26');
fs.mkdirSync(outDir, { recursive: true });

let total = 0;
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`FAILED to dump ${table}:`, error);
    process.exit(1);
  }
  const file = path.join(outDir, `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  ${table.padEnd(15)} ${String(data.length).padStart(5)} rows -> ${file}`);
  total += data.length;
}
console.log(`Done. ${total} rows total across ${tables.length} tables.`);
