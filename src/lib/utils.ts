import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn = "class names". Merges Tailwind classes safely.
 * Example: cn("p-2", isActive && "p-4") returns "p-4" because tailwind-merge
 * understands that two "p-*" classes conflict and the later one should win.
 * This is the helper every shadcn/ui component imports.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
