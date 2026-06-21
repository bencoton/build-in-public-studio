/**
 * Race a promise against a timer that rejects after `ms`. The timer is always
 * cleared (via finally) so a winning promise doesn't leave a dangling timeout
 * keeping a serverless function alive. No dependency — plain Promise.race.
 *
 * Shared by the per-repo generate path (dashboard-actions) and the Reddit
 * auto-generation pass (claude). Runtime-agnostic — no Next.js imports.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
