import { getAnthropicKey, getGithubToken } from "./env-keys";

/*
  Tiny "is this key actually valid" probes. We use plain fetch rather than
  the SDKs because:
  - It's one HTTP call each.
  - The SDKs add weight we don't need until Stages 4 (Octokit) and 5 (Anthropic).
  - The shape we care about is binary: it worked / it didn't.

  Both functions ALWAYS resolve (never throw). The returned object describes
  the outcome so the UI can render a clear message without try/catching.
*/

export type ValidationResult =
  | { ok: true; detail: string }
  | { ok: false; error: string };

/**
 * Validate the Anthropic API key by making the smallest possible Messages call.
 * We ask claude-haiku for one token of output — typically <£0.0001 per call.
 */
export async function validateAnthropicKey(): Promise<ValidationResult> {
  const key = getAnthropicKey();
  if (!key) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not set in .env.local." };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Cheap model for the smoke-test — we just want to verify the key works.
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.ok) {
      return { ok: true, detail: "Anthropic key works." };
    }
    // Non-2xx — surface the error body so the user can see what went wrong.
    const text = await res.text();
    const friendly = friendlyAnthropicError(res.status, text);
    return { ok: false, error: friendly };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error.";
    return { ok: false, error: `Network error talking to Anthropic: ${message}` };
  }
}

/**
 * Validate the GitHub token by hitting GET /user. Returns the username on
 * success so the UI can show "Validated as bencoton".
 */
export async function validateGithubToken(): Promise<ValidationResult> {
  const token = getGithubToken();
  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN is not set in .env.local." };
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.ok) {
      const body = (await res.json()) as { login?: string };
      const login = body.login ?? "unknown user";
      return { ok: true, detail: `Validated as ${login}.` };
    }
    if (res.status === 401) {
      return { ok: false, error: "GitHub rejected the token (401). It may be expired or have no scopes." };
    }
    if (res.status === 403) {
      return { ok: false, error: "GitHub returned 403 — the token works but is rate-limited or has insufficient permissions." };
    }
    return { ok: false, error: `GitHub returned ${res.status}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error.";
    return { ok: false, error: `Network error talking to GitHub: ${message}` };
  }
}

/** Convert an Anthropic error response into a beginner-friendly message. */
function friendlyAnthropicError(status: number, body: string): string {
  if (status === 401) {
    return "Anthropic rejected the key (401). Double-check it was copied in full from console.anthropic.com.";
  }
  if (status === 403) {
    return "Anthropic returned 403 — the key may not have access to the requested model. Make sure your workspace has claude-haiku-4-5 enabled.";
  }
  if (status === 429) {
    return "Anthropic returned 429 (rate limit). Wait a few seconds and try again.";
  }
  if (status >= 500) {
    return `Anthropic API error (${status}). Probably transient — try again in a minute.`;
  }
  // Truncate long error bodies so we don't spam the UI.
  const snippet = body.length > 200 ? body.slice(0, 200) + "…" : body;
  return `Anthropic returned ${status}: ${snippet}`;
}
