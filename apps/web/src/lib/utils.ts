import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const selectClass = cn(
  "mb-2 flex h-9 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground shadow-sm",
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "dark:bg-input/80",
)

export const inputFieldClass = cn(
  "mb-0 border-border bg-input text-foreground placeholder:text-muted-foreground",
)
