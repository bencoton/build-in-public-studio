# Known issues

## Open

(nothing right now)

## Resolved

- **2026-05-25** — Corrupted `node_modules/` left over from interrupted Cowork-sandbox `npm install` attempts. Resolved by deleting and reinstalling from PowerShell. See lesson BIPS-L1 in `CLAUDE.md`.
- **2026-05-25** — `npm install` failed on `better-sqlite3` because no prebuilt binary exists for Node 24.14.0 and Visual Studio Build Tools weren't installed to compile from source. Resolved by switching to Node's built-in `node:sqlite` module. See lesson BIPS-L2 in `CLAUDE.md`.
