/**
 * Normalize CSS hex strings for prefs UI (catalog swatches / kind backgrounds).
 * Native color inputs accept #RRGGBB — we coerce short form and casing for APIs.
 */
import { COLOR_HEX_PICKER_FALLBACK } from '@/lib/constants/css-color';

const FULL_HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const SHORT_HEX_RE = /^#[0-9A-Fa-f]{3}$/;

function expandShortHex(hex3: string): string {
  const body = hex3.slice(1);
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`.toUpperCase();
}

/** Parses #RGB or #RRGGBB; returns uppercase #RRGGBB or null if invalid / empty */
export function parseCssHexToFull(input: string | undefined | null): string | null {
  const t = input?.trim() ?? '';
  if (!t) return null;
  if (FULL_HEX_RE.test(t)) return t.toUpperCase();
  if (SHORT_HEX_RE.test(t)) return expandShortHex(t);
  return null;
}

/**
 * Hex value for bridging to `<input type="color">`. Invalid / empty drafts use `fallback`.
 */
export function bridgeHexForNativePicker(hexDraft: string, fallback = COLOR_HEX_PICKER_FALLBACK): string {
  return parseCssHexToFull(hexDraft) ?? fallback;
}

/** Value to send to API: null clears override; rejects invalid partial strings */
export function normalizeHexDraftForApi(hexDraft: string): string | null | 'invalid' {
  const trimmed = hexDraft.trim();
  if (!trimmed) return null;
  const full = parseCssHexToFull(trimmed);
  return full ?? 'invalid';
}
