import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with space thousand separators: 1234567 → "1 234 567" */
export function fmtMRU(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

/** Format a MRU amount: 1234567 → "1 234 567 MRU" */
export function formatCurrency(amount: number): string {
  return fmtMRU(amount) + '\u00A0MRU';
}
