/*
  ESM resolver hook for running TypeScript dev scripts under Node's native
  --experimental-strip-types loader.

  Why this exists: src/lib/*.ts uses extensionless relative imports
  (e.g. humanize.ts does `import ... from "./tell-scanner"`). That's correct for
  Next's bundler `moduleResolution` and passes `tsc --noEmit`, but Node's strict
  ESM loader requires explicit ".ts" extensions, and the old
  --experimental-specifier-resolution=node flag was removed in Node 24. Rather
  than change the source imports (which the Next build relies on), this hook
  transparently appends ".ts" when an extensionless relative specifier fails to
  resolve — affecting dev scripts only, never the app build.

  Usage (from the project root):
    node --experimental-strip-types --import ./scripts/ts-resolve-hook.mjs \
         --env-file=.env.local scripts/humanize-verify.mjs

  No dependencies. The file registers its own hooks on the main thread; on the
  hooks worker thread (isMainThread === false) it only exports `resolve`.
*/
import { register } from "node:module";
import { isMainThread } from "node:worker_threads";

if (isMainThread) {
  register(import.meta.url);
}

// Specifiers that already carry an extension we recognise — leave them alone.
const HAS_KNOWN_EXT = /\.([mc]?[jt]sx?|json|node|wasm)$/;

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (
      err?.code === "ERR_MODULE_NOT_FOUND" &&
      relative &&
      !HAS_KNOWN_EXT.test(specifier)
    ) {
      // Retry with an explicit ".ts" — the only extension src/lib/* uses.
      return nextResolve(specifier + ".ts", context);
    }
    throw err;
  }
}
