/**
 * Label data for printed order labels and piece tags (Human-Friendly Codes P4, plan T4.2).
 * Read only. Every query is scoped by tenant_org_id. Builds plain data; the renderer
 * (src/ui/print/cmx-label-renderer.tsx) draws it, so there is no HTML built from strings here.
 *
 * - Barcode (CODE128) value = the code itself, hyphens kept (ORD-260101-0001, ORD-260101-0001-1-2).
 * - Staff QR = CMX1:ORD:<order no> / CMX1:PEC:<piece code> (plan section 6.4); a customer QR is never printed here.
 * - Settings come from fn_label_printing_resolve (0685) via LabelPrintingConfigService: the order's branch
 *   -> tenant -> system defaults (sys_label_printing_cf / org_label_printing_cf). Labels are available to every
 *   tenant (no label_printing flag); only the receipt barcode is capped by human_codes_scan_labels.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { encodeCmxPayload } from '@/lib/services/scan-resolve/cmx-code-payload';
import { LabelPrintingConfigService } from '@/lib/services/labels/label-printing-config.service';
import { getPublicTrackingPathForOrderId } from '@/lib/services/public-order-tracking.service';
import {
  DEFAULT_LABEL_SETTINGS,
  type LabelDataResult,
  type LabelSettings,
  type OrderLabelData,
  type PieceSelection,
  type PieceTagData,
} from '@/lib/services/labels/label-types';

export * from '@/lib/services/labels/label-types';

/** Effective label settings for the order's tenant and branch. */
type ResolveSettings = (tenantId: string, branchId: string | null) => Promise<LabelSettings>;

interface OrderRow {
  id: string;
  order_no: string;
  branch_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  ready_by: string | null;
  ready_by_at_new: string | null;
}
interface ItemRow {
  id: string;
  order_item_srno: string | null;
  product_name: string | null;
  product_name2: string | null;
}
interface PieceRow {
  id: string;
  order_item_id: string;
  piece_seq: number;
  piece_code: string | null;
  barcode: string | null;
  tag_released_at: string | null;
}

const ORDER_COLUMNS = 'id, order_no, branch_id, customer_id, customer_name, ready_by, ready_by_at_new';
const ITEM_COLUMNS = 'id, order_item_srno, product_name, product_name2';
const PIECE_COLUMNS = 'id, order_item_id, piece_seq, piece_code, barcode, tag_released_at';

/** "Ahmed Al Balushi" -> "Ahmed A."; one word stays as is; blank -> null. */
export function shortCustomerName(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0]}.`;
}

/** Line serial suffix for sorting: ORD-260101-0001-12 -> 12. */
function lineNo(srno: string | null): number {
  const m = /-(\d+)$/.exec(srno ?? '');
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

export function buildOrderLabelData(
  order: OrderRow,
  extras: { branchName: string | null; branchName2: string | null; customerName: string | null; itemCount: number; pieceCount: number },
  settings: LabelSettings,
): OrderLabelData {
  return {
    orderId: order.id,
    orderNo: order.order_no,
    staffQr: encodeCmxPayload('ORD', order.order_no),
    barcodeValue: order.order_no,
    branchName: extras.branchName,
    branchName2: extras.branchName2,
    readyBy: order.ready_by_at_new ?? order.ready_by ?? null,
    itemCount: extras.itemCount,
    pieceCount: extras.pieceCount,
    customerShort: settings.showCustomerName ? shortCustomerName(extras.customerName) : null,
  };
}

/**
 * Piece tags, sorted by line then piece.
 * @param linePieces every live piece of the order (for "piece 2 of 3"); defaults to `pieces`.
 */
export function buildPieceTagData(
  orderNo: string,
  items: ItemRow[],
  pieces: PieceRow[],
  linePieces: PieceRow[] = pieces,
): PieceTagData[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const totals = new Map<string, number>();
  for (const p of linePieces) totals.set(p.order_item_id, (totals.get(p.order_item_id) ?? 0) + 1);
  const out: PieceTagData[] = [];
  for (const p of pieces) {
    const item = itemById.get(p.order_item_id);
    if (!item) continue;
    // P3 builds piece_code in a trigger; the fallback only covers a row the backfill has not reached yet.
    const code = (p.piece_code ?? '').trim() || (item.order_item_srno ? `${item.order_item_srno}-${p.piece_seq}` : '');
    if (!code) continue;
    out.push({
      pieceId: p.id,
      pieceCode: code,
      barcodeValue: code,
      staffQr: encodeCmxPayload('PEC', code),
      orderNo,
      itemSrno: item.order_item_srno,
      itemName: item.product_name,
      itemName2: item.product_name2,
      pieceSeq: p.piece_seq,
      pieceTotal: totals.get(p.order_item_id) ?? 1,
      externalTag: p.tag_released_at ? null : p.barcode?.trim() || null,
    });
  }
  return out.sort(
    (a, b) => lineNo(a.itemSrno) - lineNo(b.itemSrno) || (a.itemSrno ?? '').localeCompare(b.itemSrno ?? '') || a.pieceSeq - b.pieceSeq,
  );
}

export const LabelDataService = {
  /**
   * Label data for one order of the tenant, or null when the order does not exist for this tenant.
   * @param resolveSettings override for tests; defaults to fn_label_printing_resolve via LabelPrintingConfigService.
   */
  async getLabelData(
    supabase: SupabaseClient,
    params: { tenantId: string; orderId: string; userId?: string | null; pieces?: PieceSelection; includePublicTracking?: boolean },
    resolveSettings?: ResolveSettings,
  ): Promise<LabelDataResult | null> {
    const { tenantId, orderId, pieces: selection = 'none', includePublicTracking = false } = params;

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select(ORDER_COLUMNS)
      .eq('tenant_org_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error(`label data: order lookup failed: ${orderError.message}`);
    if (!order) return null;
    const o = order as unknown as OrderRow;

    const resolver: ResolveSettings =
      resolveSettings ?? ((t, b) => LabelPrintingConfigService.resolveLabelSettings(supabase, t, b));

    const [itemsRes, piecesRes, branchRes, customerRes, resolvedSettings] = await Promise.all([
      supabase
        .from('org_order_items_dtl')
        .select(ITEM_COLUMNS)
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .is('deleted_order_change_id', null),
      supabase
        .from('org_order_item_pieces_dtl')
        .select(PIECE_COLUMNS)
        .eq('tenant_org_id', tenantId)
        .eq('order_id', orderId)
        .is('deleted_order_change_id', null)
        .order('piece_seq', { ascending: true }),
      o.branch_id
        ? supabase
            .from('org_branches_mst')
            .select('name, name2, branch_name')
            .eq('tenant_org_id', tenantId)
            .eq('id', o.branch_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      !o.customer_name && o.customer_id
        ? supabase
            .from('org_customers_mst')
            .select('display_name, name, first_name, last_name')
            .eq('tenant_org_id', tenantId)
            .eq('id', o.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolver(tenantId, o.branch_id),
    ]);
    if (itemsRes.error) throw new Error(`label data: lines lookup failed: ${itemsRes.error.message}`);
    if (piecesRes.error) throw new Error(`label data: pieces lookup failed: ${piecesRes.error.message}`);

    const items = (itemsRes.data ?? []) as unknown as ItemRow[];
    const itemIds = new Set(items.map((i) => i.id));
    const allPieces = ((piecesRes.data ?? []) as unknown as PieceRow[]).filter((p) => itemIds.has(p.order_item_id));
    const settings = resolvedSettings ?? DEFAULT_LABEL_SETTINGS;

    const branch = branchRes.data as { name?: string | null; name2?: string | null; branch_name?: string | null } | null;
    const cust = customerRes.data as
      | { display_name?: string | null; name?: string | null; first_name?: string | null; last_name?: string | null }
      | null;
    const customerName =
      o.customer_name ||
      cust?.display_name ||
      cust?.name ||
      [cust?.first_name, cust?.last_name].filter(Boolean).join(' ') ||
      null;

    const orderLabel = buildOrderLabelData(
      o,
      {
        branchName: branch?.name || branch?.branch_name || null,
        branchName2: branch?.name2 || null,
        customerName,
        itemCount: items.length,
        pieceCount: allPieces.length,
      },
      settings,
    );

    let tags: PieceTagData[] = [];
    if (selection !== 'none') {
      const wanted = selection === 'all' ? null : new Set(selection);
      const chosen = wanted ? allPieces.filter((p) => wanted.has(p.id)) : allPieces;
      tags = buildPieceTagData(o.order_no, items, chosen, allPieces);
    }

    const publicTrackingPath = includePublicTracking
      ? await getPublicTrackingPathForOrderId({ tenantId, orderId })
      : null;

    return { order: orderLabel, pieces: tags, settings, publicTrackingPath };
  },
};
