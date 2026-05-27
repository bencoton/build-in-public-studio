// Standard shadcn/ui Skeleton primitive. Renders a pulsing placeholder block.
// Compose into page-shaped placeholders inside route-level loading.tsx files.

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  );
}
