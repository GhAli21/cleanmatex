/**
 * `?piece=` on the order page (HFC P3b, T3.9): which piece to scroll to and highlight.
 * The value is a piece id (what the scan dialog sends) or a piece code (what staff can type or share).
 */
import { normalizeScanInput, PIECE_CODE_RE } from '@/lib/validations/code-format-schemas';

/** How many pieces a line needs before the pieces panel shows the code / tag filter. */
export const PIECE_FILTER_MIN_PIECES = 6;

/**
 * The cleaned `?piece=` value, or null when it is empty or too long to be a piece id or code.
 * @param raw - the raw `?piece=` search param
 * @returns the cleaned value or null
 */
export function readPieceParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = normalizeScanInput(raw);
  return v.length > 0 && v.length <= 128 ? v : null;
}

/**
 * True when the piece is the one named by `?piece=` (id, or piece code in any letter case).
 * @param piece - the piece to test
 * @param piece.id - the piece id
 * @param piece.piece_code - the piece code, when it has one
 * @param ref - the cleaned `?piece=` value
 * @returns whether the piece should be highlighted
 */
export function isHighlightedPiece(
  piece: { id: string; piece_code?: string | null },
  ref: string | null | undefined,
): boolean {
  if (!ref) return false;
  if (piece.id === ref) return true;
  return Boolean(piece.piece_code) && piece.piece_code!.toUpperCase() === ref.toUpperCase();
}

/**
 * The line code a piece code belongs to (`ORD-20261031-0007-2-1` gives `ORD-20261031-0007-2`), so the order page
 * can open the right line. A piece id gives null (the page then opens every line).
 * @param ref - the cleaned `?piece=` value
 * @returns the line code or null
 */
export function lineCodeOfPieceRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const v = ref.toUpperCase();
  return PIECE_CODE_RE.test(v) ? v.replace(/-\d+$/, '') : null;
}

/**
 * True when the piece matches the pieces-panel filter (HFC T3.9b): part of its piece code or of its live tag.
 * Letter case, spaces and Arabic-Indic digits don't matter. A released tag no longer matches. An empty filter matches all.
 * @param piece - the piece to test
 * @param piece.piece_code - the piece code, when it has one
 * @param piece.barcode - the external tag, when one is linked
 * @param piece.tag_released_at - set when the tag was released (then it is ignored)
 * @param query - what staff typed or scanned in the filter
 * @returns whether the piece stays in the list
 */
export function matchesPieceCodeFilter(
  piece: { piece_code?: string | null; barcode?: string | null; tag_released_at?: string | Date | null },
  query: string | null | undefined,
): boolean {
  const q = normalizeScanInput(query ?? '').toUpperCase();
  if (!q) return true;
  if ((piece.piece_code ?? '').toUpperCase().includes(q)) return true;
  const tag = piece.tag_released_at ? '' : (piece.barcode ?? '');
  return tag.toUpperCase().includes(q);
}
