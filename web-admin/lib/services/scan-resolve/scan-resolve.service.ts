/**
 * Scan and code lookup (Human-Friendly Codes P3b, plan section 6.5).
 *
 * One entry point for every scanner, search box and lookup API: a raw value (staff QR `CMX1:<TYPE>:<code>`, an
 * order number, a line code, a piece code or an external tag) becomes the order / line / piece it points to.
 *
 * Rules:
 * - Every query is scoped by tenant_org_id. A code of another tenant and a missing code give the same
 *   SCAN_NOT_FOUND (no enumeration).
 * - A value shaped like one of our codes is looked up as a code only. Anything else is looked up as a live
 *   external tag only (tag_released_at IS NULL, piece not removed). Tags can never look like codes (A-37,
 *   ck_ord_piece_barcode_not_code), so SCAN_AMBIGUOUS cannot happen today; the code stays in the contract.
 * - Read only. Status changes (scan_state etc.) stay in the calling domain service.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCmxPayload } from '@/lib/services/scan-resolve/cmx-code-payload';
import {
  classifyCode,
  normalizeExternalTag,
  normalizeScanInput,
  EXTERNAL_TAG_PATTERN,
  SCAN_RAW_MAX_LENGTH,
  type ScanContext,
} from '@/lib/validations/code-format-schemas';

export const SCAN_ERROR_CODES = {
  NOT_FOUND: 'SCAN_NOT_FOUND',
  AMBIGUOUS: 'SCAN_AMBIGUOUS',
  UNSUPPORTED_PAYLOAD: 'SCAN_UNSUPPORTED_PAYLOAD',
  INVALID: 'SCAN_INVALID',
} as const;
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[keyof typeof SCAN_ERROR_CODES];

export type ScanKind = 'ORDER' | 'ORDER_ITEM' | 'PIECE';
export type ScanMatchedBy = 'CMX_QR' | 'ORDER_NO' | 'ITEM_SRNO' | 'PIECE_CODE' | 'EXTERNAL_TAG';

export interface ScanOrderRef {
  id: string;
  orderNo: string;
  status: string | null;
  branchId: string | null;
  parentOrderNo?: string | null;
}
export interface ScanItemRef {
  id: string;
  srno: string | null;
  name: string | null;
  name2: string | null;
}
export interface ScanPieceRef {
  id: string;
  itemId: string;
  pieceSeq: number;
  pieceCode: string | null;
  externalTag: string | null;
  status: string | null;
  /** The piece was removed by an order change (history row). Only reachable by its code, never by tag. */
  removed: boolean;
}
export interface ScanResult {
  kind: ScanKind;
  matchedBy: ScanMatchedBy;
  /** Normalised value that was looked up. */
  code: string;
  context: ScanContext;
  order: ScanOrderRef;
  item?: ScanItemRef;
  piece?: ScanPieceRef;
}

export type ScanResolveOutcome =
  | { ok: true; result: ScanResult }
  | { ok: false; code: ScanErrorCode; candidates?: ScanResult[] };

/** CMX payload types this service can resolve. Other registered prefixes give SCAN_UNSUPPORTED_PAYLOAD. */
const CMX_TYPES: Record<string, 'ORDER' | 'ITEM' | 'PIECE'> = { ORD: 'ORDER', ITM: 'ITEM', PEC: 'PIECE' };

const ORDER_COLUMNS = 'id, order_no, status, current_status, branch_id, parent_order_id';
const ITEM_COLUMNS = 'id, order_id, order_item_srno, product_name, product_name2';
const PIECE_COLUMNS =
  'id, order_id, order_item_id, piece_seq, piece_code, barcode, piece_status, tag_released_at, deleted_order_change_id';

interface OrderRow {
  id: string;
  order_no: string;
  status: string | null;
  current_status?: string | null;
  branch_id: string | null;
  parent_order_id?: string | null;
}
interface ItemRow {
  id: string;
  order_id: string;
  order_item_srno: string | null;
  product_name: string | null;
  product_name2: string | null;
}
interface PieceRow {
  id: string;
  order_id: string;
  order_item_id: string;
  piece_seq: number;
  piece_code: string | null;
  barcode: string | null;
  piece_status: string | null;
  tag_released_at: string | null;
  deleted_order_change_id: string | null;
}

function lookupError(message: string): Error {
  return new Error(`SCAN_LOOKUP_FAILED: ${message}`);
}

export class ScanResolveService {
  /**
   * Resolve a raw scanned or typed value.
   * @param supabase tenant-scoped client (RLS applies as well)
   * @param tenantId current tenant
   * @param raw value from the scanner or the search box
   * @param context where the scan happened (echoed back)
   */
  static async resolve(
    supabase: SupabaseClient,
    tenantId: string,
    raw: string,
    context: ScanContext = 'any',
  ): Promise<ScanResolveOutcome> {
    if (typeof raw !== 'string' || raw.length > SCAN_RAW_MAX_LENGTH) return { ok: false, code: SCAN_ERROR_CODES.INVALID };
    const value = normalizeScanInput(raw);
    if (value === '') return { ok: false, code: SCAN_ERROR_CODES.INVALID };
    const upper = value.toUpperCase();
    const kind = classifyCode(upper);

    if (kind === 'CMX') {
      const decoded = decodeCmxPayload(upper);
      if (!decoded.ok) return { ok: false, code: SCAN_ERROR_CODES.UNSUPPORTED_PAYLOAD };
      const target = CMX_TYPES[decoded.payload.type];
      if (!target) return { ok: false, code: SCAN_ERROR_CODES.UNSUPPORTED_PAYLOAD };
      const inner = decoded.payload.code;
      // The payload type must agree with the code shape; a mismatch is a bad label, not a lookup.
      if (classifyCode(inner) !== target) return { ok: false, code: SCAN_ERROR_CODES.UNSUPPORTED_PAYLOAD };
      return this.byCode(supabase, tenantId, target, inner, 'CMX_QR', context);
    }
    if (kind === 'ORDER' || kind === 'ITEM' || kind === 'PIECE') {
      const matchedBy: ScanMatchedBy = kind === 'ORDER' ? 'ORDER_NO' : kind === 'ITEM' ? 'ITEM_SRNO' : 'PIECE_CODE';
      return this.byCode(supabase, tenantId, kind, upper, matchedBy, context);
    }
    return this.byExternalTag(supabase, tenantId, upper, context);
  }

  private static async byCode(
    supabase: SupabaseClient,
    tenantId: string,
    kind: 'ORDER' | 'ITEM' | 'PIECE',
    code: string,
    matchedBy: ScanMatchedBy,
    context: ScanContext,
  ): Promise<ScanResolveOutcome> {
    if (kind === 'ORDER') {
      const { data, error } = await supabase
        .from('org_orders_mst')
        .select(ORDER_COLUMNS)
        .eq('tenant_org_id', tenantId)
        .eq('order_no', code)
        .maybeSingle();
      if (error) throw lookupError(error.message);
      if (!data) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
      const order = await this.toOrderRef(supabase, tenantId, data as OrderRow);
      return { ok: true, result: { kind: 'ORDER', matchedBy, code, context, order } };
    }
    if (kind === 'ITEM') {
      const { data, error } = await supabase
        .from('org_order_items_dtl')
        .select(ITEM_COLUMNS)
        .eq('tenant_org_id', tenantId)
        .eq('order_item_srno', code)
        .maybeSingle();
      if (error) throw lookupError(error.message);
      if (!data) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
      const item = data as ItemRow;
      const order = await this.loadOrder(supabase, tenantId, item.order_id);
      if (!order) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
      return { ok: true, result: { kind: 'ORDER_ITEM', matchedBy, code, context, order, item: toItemRef(item) } };
    }
    const { data, error } = await supabase
      .from('org_order_item_pieces_dtl')
      .select(PIECE_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('piece_code', code)
      .maybeSingle();
    if (error) throw lookupError(error.message);
    if (!data) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
    return this.pieceResult(supabase, tenantId, data as PieceRow, matchedBy, code, context);
  }

  private static async byExternalTag(
    supabase: SupabaseClient,
    tenantId: string,
    upper: string,
    context: ScanContext,
  ): Promise<ScanResolveOutcome> {
    const tag = normalizeExternalTag(upper);
    // A value that can never be a tag is simply not found (no format hints to the caller).
    if (!tag || !EXTERNAL_TAG_PATTERN.test(tag)) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
    const { data, error } = await supabase
      .from('org_order_item_pieces_dtl')
      .select(PIECE_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('barcode', tag)
      .is('tag_released_at', null)
      .is('deleted_order_change_id', null)
      .limit(2);
    if (error) throw lookupError(error.message);
    const rows = (data ?? []) as PieceRow[];
    if (rows.length === 0) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
    if (rows.length > 1) {
      // uq_ord_piece_barcode makes this impossible; keep a safe answer if it ever happens.
      return { ok: false, code: SCAN_ERROR_CODES.AMBIGUOUS };
    }
    return this.pieceResult(supabase, tenantId, rows[0], 'EXTERNAL_TAG', tag, context);
  }

  private static async pieceResult(
    supabase: SupabaseClient,
    tenantId: string,
    piece: PieceRow,
    matchedBy: ScanMatchedBy,
    code: string,
    context: ScanContext,
  ): Promise<ScanResolveOutcome> {
    const { data: itemData, error: itemError } = await supabase
      .from('org_order_items_dtl')
      .select(ITEM_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('id', piece.order_item_id)
      .maybeSingle();
    if (itemError) throw lookupError(itemError.message);
    const order = await this.loadOrder(supabase, tenantId, piece.order_id);
    if (!order) return { ok: false, code: SCAN_ERROR_CODES.NOT_FOUND };
    return {
      ok: true,
      result: {
        kind: 'PIECE',
        matchedBy,
        code,
        context,
        order,
        item: itemData ? toItemRef(itemData as ItemRow) : undefined,
        piece: {
          id: piece.id,
          itemId: piece.order_item_id,
          pieceSeq: piece.piece_seq,
          pieceCode: piece.piece_code,
          externalTag: piece.tag_released_at || piece.deleted_order_change_id ? null : piece.barcode,
          status: piece.piece_status,
          removed: piece.deleted_order_change_id != null,
        },
      },
    };
  }

  private static async loadOrder(supabase: SupabaseClient, tenantId: string, orderId: string): Promise<ScanOrderRef | null> {
    const { data, error } = await supabase
      .from('org_orders_mst')
      .select(ORDER_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw lookupError(error.message);
    return data ? this.toOrderRef(supabase, tenantId, data as OrderRow) : null;
  }

  private static async toOrderRef(supabase: SupabaseClient, tenantId: string, row: OrderRow): Promise<ScanOrderRef> {
    let parentOrderNo: string | null = null;
    if (row.parent_order_id) {
      const { data, error } = await supabase
        .from('org_orders_mst')
        .select('order_no')
        .eq('tenant_org_id', tenantId)
        .eq('id', row.parent_order_id)
        .maybeSingle();
      if (error) throw lookupError(error.message);
      parentOrderNo = (data as { order_no?: string } | null)?.order_no ?? null;
    }
    return {
      id: row.id,
      orderNo: row.order_no,
      status: row.current_status ?? row.status,
      branchId: row.branch_id,
      parentOrderNo,
    };
  }
}

function toItemRef(item: ItemRow): ScanItemRef {
  return { id: item.id, srno: item.order_item_srno, name: item.product_name, name2: item.product_name2 };
}

/** HTTP status for a scan error code (plan section 7.1). */
export function scanErrorStatus(code: ScanErrorCode): number {
  switch (code) {
    case SCAN_ERROR_CODES.NOT_FOUND:
      return 404;
    case SCAN_ERROR_CODES.AMBIGUOUS:
      return 409;
    case SCAN_ERROR_CODES.UNSUPPORTED_PAYLOAD:
      return 422;
    default:
      return 400;
  }
}
