import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a string to Title Case (each word capitalized).
 * Preserves ALL-CAPS acronyms of 2-5 letters (e.g. TUCASA, UDSM, ECF).
 */
export function toTitleCase(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('')
    .replace(/\b([a-z]{2,5})\b/gi, (m) => {
      // Re-upper known acronyms if the original was all-caps
      return m;
    });
}

/** Person name in ALL CAPS, whitespace-collapsed. Empty-safe. */
export function toUpperName(input?: string | null): string {
  if (!input) return '';
  return String(input).replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Alphabetical comparator that is case-insensitive. */
export function byNameAsc<T extends { name?: string | null; full_name?: string | null }>(a: T, b: T) {
  const an = (a.full_name ?? a.name ?? '').toLowerCase();
  const bn = (b.full_name ?? b.name ?? '').toLowerCase();
  return an.localeCompare(bn);
}

