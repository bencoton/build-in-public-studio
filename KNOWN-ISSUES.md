# Known issues

## Open

(nothing right now)

## Resolved

- **2026-05-25** — Same class of bug for `node-cron`. Despite marking it in `experimental.serverComponentsExternalPackages`, webpack still tried to bundle node-cron's `background-scheduled-task` worker chain and failed on `require('path')`. Resolved by dropping `node-cron` and rolling the scheduler ourselves with `setTimeout` + `cron-parser` (which we already had as a dep for the header). Updated BIPS-L5 with the empirical finding that `serverComponentsExternalPackages` doesn't reliably help the instrumentation bundle pass.
- **2026-05-25** — Stage 9 dev server 500-ing on every route after adding `node-notifier`. Webpack couldn't resolve the package's transitive Node built-ins (`fs`, `net`) imported via `is-wsl`, `is-docker`, `growly`. Resolved by dropping `node-notifier` entirely and replacing desktop toasts with dev-terminal logging plus the existing "Last run" header indicator. See lesson BIPS-L5 in `CLAUDE.md`.
- **2026-05-25** — `Only plain objects ... can be passed to Client Components` runtime error on the dashboard. Caused by `node:sqlite` returning null-prototype row objects which Next.js's RSC serializer rejects when passed as Client Component props. Resolved by spreading each row (`{...row}`) inside `getLatestGeneration` and `getAllDrafts`. See lesson BIPS-L4 in `CLAUDE.md`.
- **2026-05-25** — `db.transaction is not a function` runtime error when inserting moments. Caused by writing better-sqlite3-style code on a `node:sqlite` database — the built-in module has no `.transaction()` helper. Resolved with an explicit `transaction()` helper in `src/lib/db.ts` using BEGIN/COMMIT/ROLLBACK. See lesson BIPS-L3 in `CLAUDE.md`.
- **2026-05-25** — `npm install` failed on `better-sqlite3` because no prebuilt binary exists for Node 24.14.0 and Visual Studio Build Tools weren't installed to compile from source. Resolved by switching to Node's built-in `node:sqlite` module. See lesson BIPS-L2 in `CLAUDE.md`.
- **2026-05-25** — Corrupted `node_modules/` left over from interrupted Cowork-sandbox `npm install` attempts. Resolved by deleting and reinstalling from PowerShell. See lesson BIPS-L1 in `CLAUDE.md`.
