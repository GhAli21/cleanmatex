/**
 * Formats of human-friendly codes and external tags (Human-Friendly Codes P3).
 *
 * External tag (piece barcode): trimmed and upper-cased, only A-Z 0-9 - _ . /, 1..64 characters (A-36), and never
 * shaped like one of our codes (A-37). The DB enforces the same rules (migration 0683_ord_piece_code_human:
 * ck_ord_piece_barcode_fmt, ck_ord_piece_barcode_not_code, trg_ord_piece_tag_rules).
 *
 * Codes: order `ORD-YYYYMMDD-NNNN[-S<n>]`, line `<order>-<n>`, piece `<line>-<n>`, staff QR `CMX<v>:<TYPE>:<code>`.
 */

import { z } from 'zod';
import { ORDER_NUMBER_PATTERN } from '@/lib/services/order-numbering/order-number-format';

/** Longest external tag (heat-seal, clip or RFID label) stored on a piece. */
export const EXTERNAL_TAG_MAX_LENGTH = 64;

/** Allowed tag after normalising: A-Z, 0-9, hyphen, underscore, dot, slash. Same as the DB check. */
export const EXTERNAL_TAG_PATTERN = /^[A-Z0-9._/-]+$/;

export const EXTERNAL_TAG_ERROR = {
  EMPTY: 'PIECE_TAG_EMPTY',
  TOO_LONG: 'PIECE_TAG_TOO_LONG',
  BAD_CHARACTERS: 'PIECE_TAG_BAD_CHARACTERS',
} as const;

/** Prefixes that always belong to us, even before sys_doc_seq_type_cd is read (order, line, piece). */
export const STATIC_CODE_PREFIXES: readonly string[] = ['ORD', 'ITM', 'PEC'];

/** Staff QR payload `CMX<version>:<TYPE>:<code>` (any letter case). */
export const CMX_PAYLOAD_PREFIX_RE = /^CMX\d+:/i;

/** Order number body (no anchors), from the one order-number format. */
const ORDER_NO_BODY = ORDER_NUMBER_PATTERN.source.replace(/^\^/, '').replace(/\$$/, '');
export const ORDER_NO_RE = new RegExp(`^${ORDER_NO_BODY}$`);
export const ITEM_SRNO_RE = new RegExp(`^${ORDER_NO_BODY}-\\d+$`);
export const PIECE_CODE_RE = new RegExp(`^${ORDER_NO_BODY}-\\d+-\\d+$`);

/** Trim, then upper-case (what staff scan or type becomes the stored tag). */
export function normalizeExternalTag(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Format of an external tag (no code look-alike check; see `looksLikeCode`).
 * Output is the normalised tag.
 */
export const externalTagSchema = z
  .string()
  .transform(normalizeExternalTag)
  .refine((value) => value.length > 0, { message: EXTERNAL_TAG_ERROR.EMPTY })
  .refine((value) => value.length <= EXTERNAL_TAG_MAX_LENGTH, { message: EXTERNAL_TAG_ERROR.TOO_LONG })
  .refine((value) => value.length === 0 || EXTERNAL_TAG_PATTERN.test(value), { message: EXTERNAL_TAG_ERROR.BAD_CHARACTERS });

export type ExternalTag = z.output<typeof externalTagSchema>;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/**
 * Pattern of values that look like one of our codes: `<prefix>` then an optional - _ . / then a digit, for every
 * prefix given plus STATIC_CODE_PREFIXES. Same rule as the DB (fn_ord_piece_tag_rules).
 * @param prefixes printed and reserved prefixes from sys_doc_seq_type_cd (prefix, type_prefix)
 */
export function codeLookalikePattern(prefixes: readonly string[] = []): RegExp {
  const all = [...new Set([...STATIC_CODE_PREFIXES, ...prefixes].map((p) => p.trim().toUpperCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeForRegExp);
  return new RegExp(`^(?:${all.join('|')})[-_./]?\\d`);
}

/**
 * True when a (normalised) value looks like one of our codes: an order number, line number or piece code, any code
 * whose doc type prefix is given, or a staff QR payload.
 */
export function looksLikeCode(value: string, prefixes: readonly string[] = []): boolean {
  const v = value.trim().toUpperCase();
  return CMX_PAYLOAD_PREFIX_RE.test(v) || codeLookalikePattern(prefixes).test(v);
}

// ---------------------------------------------------------------------------------------------------------------------
// Scan and search input (Human-Friendly Codes P3b, plan sections 6.5 and 6.6)
// ---------------------------------------------------------------------------------------------------------------------

/** Longest raw value a scan or typed lookup may send (before normalising). */
export const SCAN_RAW_MAX_LENGTH = 128;

/** Where a scan comes from; passed back to the UI only (domain checks stay in the calling service). */
export const SCAN_CONTEXTS = ['assembly', 'qa', 'packing', 'pickup', 'intake', 'any'] as const;
export type ScanContext = (typeof SCAN_CONTEXTS)[number];

/** Arabic-Indic (U+0660..0669) and Extended Arabic-Indic / Persian (U+06F0..06F9) digits to ASCII. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/** AIM symbology identifier some scanners put in front of the data (`]C0`, `]Q1`, `]E0`, ...). */
const AIM_PREFIX_RE = /^\][A-Za-z][0-9A-Za-z]/;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Normalise a scanned or typed value: drop control characters (CR, LF, TAB, GS, ...), drop an AIM prefix, map
 * Arabic-Indic digits to ASCII, trim. Letter case is kept (codes are compared upper-cased by the caller).
 */
export function normalizeScanInput(raw: string): string {
  let v = raw.replace(CONTROL_CHARS_RE, '');
  v = v.trim();
  if (AIM_PREFIX_RE.test(v)) v = v.slice(3);
  return toAsciiDigits(v).trim();
}

export type CodeKind = 'CMX' | 'ORDER' | 'ITEM' | 'PIECE' | 'UNKNOWN';

/** What a (normalised) value looks like. UNKNOWN can still be an external tag. */
export function classifyCode(raw: string): CodeKind {
  const v = normalizeScanInput(raw).toUpperCase();
  if (CMX_PAYLOAD_PREFIX_RE.test(v)) return 'CMX';
  if (ORDER_NO_RE.test(v)) return 'ORDER';
  if (ITEM_SRNO_RE.test(v)) return 'ITEM';
  if (PIECE_CODE_RE.test(v)) return 'PIECE';
  return 'UNKNOWN';
}

/**
 * The order number inside an order number, line code or piece code (search fast path, T3.9).
 * `ORD-20261031-0007-2-1` gives `ORD-20261031-0007`. Anything else (tags, staff QR, partial text) gives null.
 */
export function orderNoFromCode(raw: string): string | null {
  const v = normalizeScanInput(raw).toUpperCase();
  if (ORDER_NO_RE.test(v)) return v;
  if (ITEM_SRNO_RE.test(v)) return v.replace(/-\d+$/, '');
  if (PIECE_CODE_RE.test(v)) return v.replace(/-\d+-\d+$/, '');
  return null;
}

/** Body of POST /api/v1/scan/resolve. */
export const scanInputSchema = z.object({
  raw: z.string().min(1).max(SCAN_RAW_MAX_LENGTH),
  context: z.enum(SCAN_CONTEXTS).default('any'),
});
export type ScanInput = z.output<typeof scanInputSchema>;

/** Exact order number (root or sub-order), normalised. */
export const orderNoSchema = z
  .string()
  .transform((v) => normalizeScanInput(v).toUpperCase())
  .refine((v) => ORDER_NO_RE.test(v), { message: 'ORDER_NO_INVALID' });

/** Exact piece code, normalised. */
export const pieceCodeSchema = z
  .string()
  .transform((v) => normalizeScanInput(v).toUpperCase())
  .refine((v) => PIECE_CODE_RE.test(v), { message: 'PIECE_CODE_INVALID' });

/** Search box text: partial values allowed (search only, never a write). */
export const codeSearchSchema = z
  .string()
  .transform((v) => normalizeScanInput(v))
  .refine((v) => v.length >= 2 && v.length <= 64, { message: 'CODE_SEARCH_LENGTH' });
