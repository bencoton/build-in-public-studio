"use client";

// Thin wrapper around next-themes' ThemeProvider. Lives as a separate file
// because next-themes is client-only and our root layout is a server component;
// importing the provider directly into layout.tsx would force the whole layout
// to be a client component.
//
// `React.ComponentProps<typeof NextThemesProvider>` derives the prop type
// without depending on next-themes' internal type exports (which can shift
// between versions).

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
