// ESLint flat config (ESLint 9 / Next 16).
//
// Next 16 removed the `next lint` command, and ESLint 9 defaults to flat
// config — so the old `.eslintrc.json` ("extends": next/core-web-vitals +
// next/typescript) no longer loads (its plugin chain throws a circular-
// structure error through the legacy loader). eslint-config-next@16 ships
// these same presets as native flat-config arrays; we compose them here for
// a 1:1 replacement. Run with `npm run lint` (= `eslint .`).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    // `react-hooks` 7 (Next 16 upgrade) added these two rules. The pre-existing
    // violations they surfaced were fixed on 2026-06-21 (next-themes mount guard
    // → useSyncExternalStore; elapsed-timer resets moved out of the effect;
    // `Date.now()` reads moved into plain helpers), so they're enforced at
    // `error` again — keep them red so the patterns don't creep back.
    rules: {
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
    },
  },
];

export default eslintConfig;
