"use client";

// Sun/moon button that flips between light and dark themes via next-themes.
//
// Hydration-safe pattern: useTheme() returns undefined on the server but the
// real value after mounting, which would cause a server/client markup mismatch
// if rendered naively. The `mounted` gate renders a disabled placeholder until
// the client takes over.

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

// Hydration detection without set-state-in-effect: the server snapshot is
// false, the client snapshot is true, so `mounted` flips on hydration with no
// effect and no cascading render (react-hooks/set-state-in-effect).
const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    // Placeholder keeps the header layout from jumping. Disabled until hydrated.
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Loading theme toggle"
        disabled
        className="opacity-50"
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
