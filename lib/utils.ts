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

// Period boundaries for dashboard totals, as ISO strings. Computed in the
// server's local time. NOTE: on Vercel the server runs in UTC; pin the runtime
// to Africa/Tunis (e.g. TZ env var) if calendar days must match Tunisian time.
export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfWeekISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Week starts Monday. getDay(): 0 = Sunday … 6 = Saturday.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.toISOString();
}

export function startOfMonthISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// A register counts as "active" if it reported activity within the last N
// minutes (default 5). Kept here (not inline in the component) so the render
// stays free of direct impure time calls.
export function isRegisterActive(
  lastSeen: string | null,
  withinMinutes = 5,
): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < withinMinutes * 60 * 1000;
}
