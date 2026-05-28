/*
  Read the API-key state from .env.local. Server-side only — these names
  intentionally do NOT start with NEXT_PUBLIC_ because they must never reach
  the browser. Server-only access keeps the keys out of the client bundle.
*/

export type KeyStatus = "missing" | "set";

export type ApiKeyState = {
  anthropic: KeyStatus;
  github: KeyStatus;
};

/**
 * Returns the env-state of each key WITHOUT exposing the actual value.
 * The page can safely render this; the keys themselves stay server-side.
 */
export function readApiKeyState(): ApiKeyState {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY ? "set" : "missing",
    github: process.env.GITHUB_TOKEN ? "set" : "missing",
  };
}

/**
 * Internal getters — used by server actions that need to MAKE the API call
 * (validation, the sync/draft endpoints in later stages). Never export the
 * raw values to a React component or a client action.
 */
export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

export function getGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}
