"use client";

// Three select dropdowns wired to URL search params. Changing any one pushes
// the new URL; the server component re-renders with the new searchParams.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "posted", label: "Posted" },
  { value: "rejected", label: "Rejected" },
] as const;

const VARIANT_OPTIONS = [
  { value: "all", label: "Both variants" },
  { value: "x_thread", label: "X thread" },
  { value: "ih_long", label: "Indie Hackers" },
] as const;

const RATING_OPTIONS = [
  { value: "all", label: "Any rating" },
  { value: "star", label: "★ Starred" },
  { value: "neutral", label: "– Neutral" },
  { value: "flop", label: "👎 Flopped" },
  { value: "unrated", label: "Unrated" },
] as const;

export function HistoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const selectClass =
    "rounded-md border border-input bg-card px-2 py-1.5 text-sm font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={searchParams.get("status") ?? "all"}
        onChange={(e) => updateParam("status", e.target.value)}
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("variant") ?? "all"}
        onChange={(e) => updateParam("variant", e.target.value)}
        aria-label="Filter by variant"
      >
        {VARIANT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("rating") ?? "all"}
        onChange={(e) => updateParam("rating", e.target.value)}
        aria-label="Filter by rating"
      >
        {RATING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {pending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
