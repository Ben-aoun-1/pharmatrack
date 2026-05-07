import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui classname helper: merge conditional + conflicting classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a number as Tunisian dinar with 3 decimals, e.g. 3.45 -> "3.450 DT".
// Uses a literal dot (not the fr-FR comma) to match the displayed currency style.
export function formatPrice(amount: number): string {
  return `${amount.toFixed(3)} DT`;
}

// Format a date as "dd/mm/yyyy HH:MM" using the French locale.
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
