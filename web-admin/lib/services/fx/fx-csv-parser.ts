/**
 * Minimal RFC4180 CSV parser for the tenant FX rate-import template (plan 01
 * §7.1). Pure string logic, no I/O — deliberately not a third-party
 * dependency: the template is a fixed, small column set, and CleanMateX
 * already treats `xlsx` as a cautionary tale (F7) for pulling in a parsing
 * library without a hard look at its security posture.
 *
 * Handles quoted fields (embedded commas, embedded quotes via `""`), and
 * both CRLF and LF line endings. Does not support multi-line quoted fields
 * spanning more than the expected flat rows — the FX import template never
 * needs that.
 */

export const FX_CSV_TEMPLATE_HEADERS = [
  'from_currency',
  'to_currency',
  'rate_date',
  'rate_type',
  'rate',
  'source_reference',
] as const;

export interface CsvParseResult {
  header: string[];
  rows: string[][];
}

/** Splits raw CSV text into a header row + data rows of raw string cells. */
export function parseCsvText(text: string): CsvParseResult {
  const allRows = parseCsvRows(text);
  const [header = [], ...rows] = allRows;
  return { header, rows };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let sawAnyContentInRow = false;
  let i = 0;
  const len = text.length;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAnyContentInRow = false;
  };

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      sawAnyContentInRow = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      sawAnyContentInRow = true;
      endField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      if (sawAnyContentInRow || field.length > 0) endRow();
      i += 1;
      continue;
    }
    field += char;
    sawAnyContentInRow = true;
    i += 1;
  }

  if (sawAnyContentInRow || field.length > 0) {
    endRow();
  }

  return rows;
}

/** Trims each header cell and lower-cases it for case-insensitive, whitespace-tolerant matching. */
export function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase();
}
