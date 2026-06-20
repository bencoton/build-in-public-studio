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
    // `react-hooks` 7 (pulled in by the Next 16 upgrade) added two rules that
    // fire on components written before they existed — the standard next-themes
    // mount-guard (`setState` in a mount effect), elapsed-timer resets, and a
    // `Date.now()` freshness check in render. None are in the Reddit work; they
    // predate the rules. Downgraded to warnings so they stay visible without
    // blocking, pending a dedicated cleanup pass (see NOTES 2026-06-20).
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
