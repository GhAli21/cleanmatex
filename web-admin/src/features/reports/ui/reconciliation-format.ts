/**
 * Shared display helpers for the D-09 reconciliation report tables. Matches the
 * lightweight money formatting used by the existing finance reports
 * (`financial-reports-client`) — 3-decimal amount with an optional currency
 * prefix — so the reconciliation tab is visually consistent with the others.
 */

/** Format a money amount as `CUR 0.000`; `—` for null/undefined. */
export function fmtAmount(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return '—';
  return `${currency ?? ''} ${n.toFixed(3)}`.trim();
}

/** Format an ISO timestamp as a locale date; `—` for null. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}
