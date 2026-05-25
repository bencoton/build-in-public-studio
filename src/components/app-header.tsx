// Header shown above the main content area on every page.
// For Stage 1 it's just the title + a placeholder for the "Last run / Next run"
// indicator we'll wire up in Stage 9 when we add the scheduler.

export function AppHeader() {
  return (
    <header className="border-b px-8 py-4 flex items-center justify-between">
      <h1 className="text-sm font-heading font-medium tracking-tight text-muted-foreground">
        Dashboard
      </h1>
      <div className="text-xs text-muted-foreground font-mono">
        Last run: — &nbsp;·&nbsp; Next run: —
      </div>
    </header>
  );
}
