"use client";

// Last-resort error boundary. Catches errors thrown in the root layout itself
// (where `error.tsx` cannot reach because the layout is what renders it).
// Must include its own <html> and <body> tags — at this depth, the layout has
// not rendered, so we re-establish the document.
//
// Kept deliberately minimal: no Tailwind utility classes that depend on the
// layout's font variables, no shared components that might also be broken.
// Inline styles only, so this renders even if the CSS pipeline is the thing
// that errored.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "3rem 1.5rem",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#020617",
          color: "#e2e8f0",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 600,
              margin: "0 0 1rem",
              color: "#14b8a6",
            }}
          >
            Something broke at the root level
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "#94a3b8" }}>
            The application layout itself failed to render. This is unusual.
            The error message is below; the full stack is in your browser
            console.
          </p>
          <pre
            style={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "0.375rem",
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: "0 0 1.5rem",
            }}
          >
            {error.message || "(no message)"}
          </pre>
          {error.digest && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#64748b",
                margin: "0 0 1.5rem",
              }}
            >
              Vercel digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#14b8a6",
              color: "#020617",
              border: "none",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.375rem",
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
