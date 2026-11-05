/**
 * Piece codes and external tags (Human-Friendly Codes P3).
 *
 * piece_code `<order_item_srno>-<piece_seq>` is built by the DB at insert (trg_ord_piece_code_set) and never changes.
 * barcode is the optional external tag staff attach to a piece.
 *
 * Tag rules (plan section 20, A-35..A-38; DB side in migration 0683_ord_piece_code_human):
 * - A-35 a tag is on at most one live piece per tenant (uq_ord_piece_barcode). A tag is freed when its piece is
 *   removed or when its order is delivered, closed or cancelled; the old value stays on the piece as history.
 * - A-36 the tag is trimmed and upper-cased; only A-Z 0-9 - _ . /, 1..64 characters (ck_ord_piece_barcode_fmt).
 * - A-37 a tag must not look like one of our codes (ck_ord_piece_barcode_not_code, trg_ord_piece_tag_rules).
 * - A-38 a batch is checked in full before anything is saved (validateBatchTags).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { externalTagSchema, looksLikeCode, STATIC_CODE_PREFIXES } from '@/lib/validations/code-format-schemas';

export const PIECE_TAG_ERROR_CODES = {
  IN_USE: 'PIECE_TAG_IN_USE',
  INVALID: 'PIECE_TAG_INVALID',
  LOOKS_LIKE_CODE: 'PIECE_TAG_LOOKS_LIKE_CODE',
  DUPLICATE_IN_BATCH: 'PIECE_TAG_DUPLICATE_IN_BATCH',
} as const;

export type PieceTagErrorCode = (typeof PIECE_TAG_ERROR_CODES)[keyof typeof PIECE_TAG_ERROR_CODES];

/** Order statuses that free the tags of the order's pieces (A-35). Same list as fn_ord_piece_tag_release. */
export const TAG_RELEASING_ORDER_STATUSES: readonly string[] = ['delivered', 'closed', 'cancelled'];

export function isTagReleasingStatus(status: string | null | undefined): boolean {
  return !!status && TAG_RELEASING_ORDER_STATUSES.includes(status.trim().toLowerCase());
}

/** A live piece that already carries a tag. */
export interface PieceTagHolder {
  id: string;
  order_id: string;
  order_item_id: string;
  piece_seq: number;
  piece_code: string | null;
  barcode: string;
}

/** The piece a tag is being written to: by id, or by line + piece number (batch-update accepts both). */
export interface PieceTagTarget {
  pieceId?: string | null;
  orderId: string;
  itemId?: string | null;
  pieceNumber?: number | null;
}

export type PieceTagCheck =
  | { ok: true; tag: string }
  | {
      ok: false;
      code: typeof PIECE_TAG_ERROR_CODES.INVALID | typeof PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE;
      tag: string;
      reason: string;
    };

/**
 * Validate and normalise (trim + upper-case) one tag.
 * @param prefixes doc type prefixes from loadCodePrefixes (STATIC_CODE_PREFIXES are always included)
 */
export function checkPieceTagFormat(raw: string, prefixes: readonly string[] = STATIC_CODE_PREFIXES): PieceTagCheck {
  // The staff QR shape (CMX1:...) is reported as a code look-alike, not as "bad characters".
  if (looksLikeCode(raw, prefixes)) {
    return { ok: false, code: PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE, tag: raw, reason: PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE };
  }
  const parsed = externalTagSchema.safeParse(raw);
  if (parsed.success) return { ok: true, tag: parsed.data };
  return {
    ok: false,
    code: PIECE_TAG_ERROR_CODES.INVALID,
    tag: raw,
    reason: parsed.error.issues[0]?.message ?? PIECE_TAG_ERROR_CODES.INVALID,
  };
}

/** True when the holder is the target piece itself (re-saving the same tag is not a conflict). */
export function isSamePiece(holder: PieceTagHolder, target: PieceTagTarget): boolean {
  if (target.pieceId && holder.id === target.pieceId) return true;
  return (
    holder.order_id === target.orderId &&
    !!target.itemId &&
    holder.order_item_id === target.itemId &&
    target.pieceNumber != null &&
    holder.piece_seq === target.pieceNumber
  );
}

/** True when two batch targets are the same piece (same id, or same line + piece number). */
export function isSameTarget(a: PieceTagTarget, b: PieceTagTarget): boolean {
  if (a.pieceId && b.pieceId && a.pieceId === b.pieceId) return true;
  return !!a.itemId && a.itemId === b.itemId && a.pieceNumber != null && a.pieceNumber === b.pieceNumber;
}

/** Map a DB error on a piece write to the tag error code (null when it is another error). */
export function mapPieceTagDbError(message: string | null | undefined): PieceTagErrorCode | null {
  if (!message) return null;
  if (message.includes('uq_ord_piece_barcode')) return PIECE_TAG_ERROR_CODES.IN_USE;
  if (message.includes('ck_ord_piece_barcode_not_code') || message.includes('PIECE_TAG_LOOKS_LIKE_CODE')) {
    return PIECE_TAG_ERROR_CODES.LOOKS_LIKE_CODE;
  }
  if (message.includes('ck_ord_piece_barcode_fmt')) return PIECE_TAG_ERROR_CODES.INVALID;
  return null;
}

/** One problem found in a batch. */
export interface PieceTagIssue {
  /** Position of the update in the batch. */
  index: number;
  code: PieceTagErrorCode;
  /** Tag as sent (format errors) or normalised (other errors). */
  tag: string;
  pieceId?: string | null;
  /** EMPTY / TOO_LONG / BAD_CHARACTERS reason for PIECE_TAG_INVALID. */
  reason?: string;
  /** Piece code of the live piece that already has the tag (PIECE_TAG_IN_USE). */
  heldByPieceCode?: string | null;
}

export interface PieceTagBatchEntry {
  index: number;
  raw: string;
  target: PieceTagTarget;
}

export interface PieceTagBatchResult {
  /** Normalised tag per batch index (only entries without issues). */
  tags: Map<number, string>;
  issues: PieceTagIssue[];
}

const PREFIX_CACHE_MS = 5 * 60 * 1000;
let prefixCache: { at: number; prefixes: string[] } | null = null;

/** Test hook: forget the cached prefixes. */
export function resetCodePrefixCache(): void {
  prefixCache = null;
}

export class PieceCodeService {
  /**
   * Printed and reserved prefixes of every doc type (sys_doc_seq_type_cd.prefix and type_prefix), plus
   * STATIC_CODE_PREFIXES. Platform table (no tenant column). Cached 5 minutes. If the read fails the static list
   * is used; the DB trigger trg_ord_piece_tag_rules still checks the full list on write.
   */
  static async loadCodePrefixes(supabase: SupabaseClient): Promise<string[]> {
    if (prefixCache && Date.now() - prefixCache.at < PREFIX_CACHE_MS) return prefixCache.prefixes;
    const { data, error } = await supabase.from('sys_doc_seq_type_cd').select('prefix, type_prefix');
    if (error || !data) return [...STATIC_CODE_PREFIXES];
    const set = new Set<string>(STATIC_CODE_PREFIXES);
    for (const row of data as Array<{ prefix: string | null; type_prefix: string | null }>) {
      for (const p of [row.prefix, row.type_prefix]) {
        const v = (p ?? '').trim().toUpperCase();
        if (/^[A-Z0-9]+$/.test(v)) set.add(v);
      }
    }
    const prefixes = [...set];
    prefixCache = { at: Date.now(), prefixes };
    return prefixes;
  }

  /**
   * Live pieces of the tenant that hold any of the tags (A-35): not removed, and their order is not delivered,
   * closed or cancelled (status or current_status, like trg_ord_piece_tag_release). Tenant-scoped. Works before and
   * after migration 0683 (reads the order status, not tag_released_at; for a reopened order this is stricter than
   * the DB, which keeps an old tag released until it is saved again).
   */
  static async findLiveTagHolders(
    supabase: SupabaseClient,
    tenantId: string,
    tags: readonly string[],
  ): Promise<PieceTagHolder[]> {
    const unique = [...new Set(tags.filter((t) => t.length > 0))];
    if (unique.length === 0) return [];
    const { data, error } = await supabase
      .from('org_order_item_pieces_dtl')
      .select('id, order_id, order_item_id, piece_seq, piece_code, barcode')
      .eq('tenant_org_id', tenantId)
      .in('barcode', unique)
      .is('deleted_order_change_id', null);
    if (error) throw new Error(`PIECE_TAG_LOOKUP_FAILED: ${error.message}`);
    const holders = (data ?? []) as PieceTagHolder[];
    if (holders.length === 0) return [];

    const orderIds = [...new Set(holders.map((h) => h.order_id))];
    const { data: orders, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id, status, current_status')
      .eq('tenant_org_id', tenantId)
      .in('id', orderIds);
    if (orderError) throw new Error(`PIECE_TAG_LOOKUP_FAILED: ${orderError.message}`);
    const released = new Set(
      ((orders ?? []) as Array<{ id: string; status: string | null; current_status?: string | null }>)
        .filter((o) => isTagReleasingStatus(o.status) || isTagReleasingStatus(o.current_status))
        .map((o) => o.id),
    );
    return holders.filter((h) => !released.has(h.order_id));
  }

  /**
   * A-38: check every tag of a batch before anything is saved: format, code look-alike, the same tag twice in the
   * batch, and a tag already on another live piece. Returns all issues (empty = safe to save).
   */
  static async validateBatchTags(
    supabase: SupabaseClient,
    tenantId: string,
    entries: readonly PieceTagBatchEntry[],
  ): Promise<PieceTagBatchResult> {
    const tags = new Map<number, string>();
    const issues: PieceTagIssue[] = [];
    if (entries.length === 0) return { tags, issues };

    const prefixes = await PieceCodeService.loadCodePrefixes(supabase);
    for (const entry of entries) {
      const check = checkPieceTagFormat(entry.raw, prefixes);
      // `'reason' in` narrows the union without relying on strictNullChecks.
      if ('reason' in check) {
        issues.push({ index: entry.index, code: check.code, tag: entry.raw, pieceId: entry.target.pieceId, reason: check.reason });
      } else {
        tags.set(entry.index, check.tag);
      }
    }

    // The same tag on two different pieces of the batch (the same piece twice is fine).
    const firstIndexByTag = new Map<string, number>();
    for (const [index, tag] of tags) {
      const first = firstIndexByTag.get(tag);
      if (first === undefined) {
        firstIndexByTag.set(tag, index);
        continue;
      }
      const a = entries.find((e) => e.index === first)?.target;
      const b = entries.find((e) => e.index === index)?.target;
      if (a && b && !isSameTarget(a, b)) {
        issues.push({ index, code: PIECE_TAG_ERROR_CODES.DUPLICATE_IN_BATCH, tag, pieceId: b.pieceId });
      }
    }

    const holders = await PieceCodeService.findLiveTagHolders(supabase, tenantId, [...firstIndexByTag.keys()]);
    for (const [index, tag] of tags) {
      const target = entries.find((e) => e.index === index)?.target;
      if (!target) continue;
      const other = holders.find((h) => h.barcode === tag && !isSamePiece(h, target));
      if (other) {
        issues.push({
          index,
          code: PIECE_TAG_ERROR_CODES.IN_USE,
          tag,
          pieceId: target.pieceId,
          heldByPieceCode: other.piece_code,
        });
      }
    }

    issues.sort((a, b) => a.index - b.index);
    for (const issue of issues) tags.delete(issue.index);
    return { tags, issues };
  }
}

/** HTTP status for a tag error: 400 for format problems, 409 for a tag held by another piece (same as batch-update). */
export function pieceTagHttpStatus(code: PieceTagErrorCode): 400 | 409 {
  return code === PIECE_TAG_ERROR_CODES.IN_USE || code === PIECE_TAG_ERROR_CODES.DUPLICATE_IN_BATCH ? 409 : 400;
}

/** Error body for one-piece tag writes (PATCH piece, external-tag PUT). Same fields as batch-update. */
export interface PieceTagErrorBody {
  success: false;
  error: string;
  code: PieceTagErrorCode;
  tag?: string;
  reason?: string;
  heldByPieceCode?: string | null;
  issues?: PieceTagIssue[];
}

export function pieceTagErrorBody(code: PieceTagErrorCode, issue?: PieceTagIssue): PieceTagErrorBody {
  return {
    success: false,
    error: pieceTagHttpStatus(code) === 409 ? 'Piece tag already in use' : 'Invalid piece tag',
    code,
    tag: issue?.tag,
    reason: issue?.reason,
    heldByPieceCode: issue?.heldByPieceCode ?? null,
    issues: issue ? [issue] : undefined,
  };
}

export type SinglePieceTagCheck = { ok: true; tag: string } | { ok: false; issue: PieceTagIssue };

/**
 * One tag for one piece (PATCH piece, external-tag PUT): the same checks as validateBatchTags (A-35..A-37).
 * @param pieceId piece that gets the tag (re-saving its own tag is fine)
 * @param orderId the piece's order
 */
export async function checkSinglePieceTag(
  supabase: SupabaseClient,
  tenantId: string,
  pieceId: string,
  orderId: string,
  raw: string,
): Promise<SinglePieceTagCheck> {
  const result = await PieceCodeService.validateBatchTags(supabase, tenantId, [
    { index: 0, raw, target: { pieceId, orderId } },
  ]);
  const issue = result.issues[0];
  if (issue) return { ok: false, issue };
  return { ok: true, tag: result.tags.get(0) as string };
}
