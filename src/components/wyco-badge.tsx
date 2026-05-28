// The "by WyCo Digital" badge — appears at the bottom of the sidebar so visitors
// see the parent brand association on every page.

export function WycoBadge() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>by</span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4 text-wyco-teal"
        fill="currentColor"
      >
        <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
      </svg>
      <span className="font-heading font-medium tracking-tight text-foreground/80">
        WyCo Digital
      </span>
    </div>
  );
}
