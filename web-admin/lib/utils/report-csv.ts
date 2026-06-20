/**
 * Minimal CSV serialiser for report exports (D-09 reconciliation reports and any
 * other `format=csv` report route). Quotes only fields that need it (comma,
 * double-quote, or newline) and escapes embedded quotes per RFC 4180.
 */

type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialise a header row + data rows to a CSV string.
 *
 * @param headers column headers, in order.
 * @param rows data rows; each inner array must align to `headers`.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}
