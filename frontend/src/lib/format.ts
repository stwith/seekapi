/** Standard dash for empty values */
export const DASH = "\u2014";

/** Format ISO timestamp to locale string, returns dash if empty */
export function formatDate(iso?: string | null): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleString();
}

/** Format ISO timestamp to short date (date only) */
export function formatShortDate(iso?: string | null): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleDateString();
}
