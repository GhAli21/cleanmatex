import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getOrderFinancialSummary } from '@/lib/services/order-financial-summary.service';
import { ORDER_CHANGE_CONTEXT_DEFERRED_REASON } from '@/lib/constants/order-change';
import type { OrderChangeContext } from '@/lib/types/order-change';

/** Typed failure so the HTTP route can preserve the V3 error envelope without exposing internals. */
export class OrderChangeContextError extends Error {
  constructor(
    public readonly code: 'ORDER_NOT_FOUND' | 'ORDER_NOT_COMMITTED' | 'EDIT_ACCESS_BLOCKED' | 'WORKFLOW_VERSION_UNAVAILABLE' | 'INVALID_TARGET_HIERARCHY',
    public readonly status: 404 | 403 | 422 | 503,
  ) {
    super(code);
  }
}

/**
 * Normalizes database numeric values for the wire contract without allowing
 * JavaScript floating-point conversion to alter commercial amounts.
 *
 * @param value - Prisma decimal, primitive numeric value, or absent database value.
 * @returns Canonical decimal text, with absent values represented as `0.0000`.
 */
function decimalText(value: { toString(): string } | number | string | null | undefined): string {
  return value == null ? '0.0000' : String(value);
}

/**
 * Preserves nullable timestamps in the JSON contract while using ISO 8601 for
 * cross-client consistency.
 *
 * @param value - Database timestamp, when the relevant order fact exists.
 * @returns ISO 8601 timestamp or `null` when the fact is absent.
 */
function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

/**
 * Loads the authoritative read-only Edit V2 aggregate for one committed order.
 *
 * All Prisma queries scoped to tenantOrgId via withTenantContext.
 *
 * @param input - Authenticated tenant and route order identifiers; the tenant ID enforces row-level isolation.
 * @returns Stable-id commercial context with policy execution intentionally deferred to WP05.
 * @throws {OrderChangeContextError} When the order is unavailable or V2-ineligible.
 * @example
 * await getOrderChangeContext({ tenantId: 'tenant-uuid', orderId: 'order-uuid' });
 */
export async function getOrderChangeContext(input: { tenantId: string; orderId: string }): Promise<OrderChangeContext> {
  // All Prisma queries scoped to tenant via RLS context and explicit tenant predicates.
  return withTenantContext(input.tenantId, async (tenantId) => {
    const order = await prisma.org_orders_mst.findFirst({
      where: { id: input.orderId, tenant_org_id: tenantId },
      select: {
        id: true, order_no: true, committed_at: true, edit_state_version: true, state_version: true,
        edit_access_status: true, edit_block_reason_code: true, edit_block_reason_text: true, edit_block_until: true,
        current_status: true, wf_profile_id: true, wf_profile_version_id: true,
        customer_id: true, customer_name: true, customer_mobile_number: true, customer_email: true,
        branch_id: true, currency_code: true, priority: true, service_speed: true, ready_by: true,
        internal_notes: true, customer_notes: true,
      },
    });

    if (!order) throw new OrderChangeContextError('ORDER_NOT_FOUND', 404);
    if (!order.committed_at || order.edit_state_version < 1) throw new OrderChangeContextError('ORDER_NOT_COMMITTED', 422);
    if (order.edit_access_status !== 'OPEN') throw new OrderChangeContextError('EDIT_ACCESS_BLOCKED', 403);
    if (!Number.isInteger(order.state_version) || order.state_version < 1) {
      throw new OrderChangeContextError('WORKFLOW_VERSION_UNAVAILABLE', 503);
    }

    // Governed commercial rows must be explicitly active; legacy NULL must never become editable context.
    const items = await prisma.org_order_items_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: input.orderId, rec_status: 1 },
      orderBy: [{ rec_order: 'asc' }, { created_at: 'asc' }],
      select: {
        id: true, order_id: true, product_id: true, product_name: true, product_name2: true,
        service_category_code: true, quantity: true, price_per_unit: true, total_price: true,
        price_override: true, service_pref_charge: true, packing_pref_code: true,
      },
    });
    const itemIds = new Set(items.map((item) => item.id));

    // Keep pieces aligned with explicitly active item identities before exposing stable targets.
    const pieces = await prisma.org_order_item_pieces_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: input.orderId, rec_status: 1, order_item_id: { in: [...itemIds] } },
      orderBy: [{ order_item_id: 'asc' }, { piece_seq: 'asc' }],
      select: { id: true, order_id: true, order_item_id: true, piece_seq: true, piece_status: true, piece_stage: true, scan_state: true },
    });
    if (pieces.some((piece) => !itemIds.has(piece.order_item_id))) {
      throw new OrderChangeContextError('INVALID_TARGET_HIERARCHY', 422);
    }
    const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));

    // Preferences are governed commercial facts, so NULL status cannot inherit legacy active semantics.
    const preferences = await prisma.org_order_preferences_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: input.orderId, rec_status: 1 },
      orderBy: [{ prefs_level: 'asc' }, { prefs_no: 'asc' }],
      select: {
        id: true, order_id: true, prefs_level: true, order_item_id: true, order_item_piece_id: true,
        preference_id: true, preference_code: true, preference_sys_kind: true, preference_category: true,
        preference_content: true, extra_price: true, processing_confirmed: true,
      },
    });
    // Reject orphaned hierarchy records so a later Change command cannot target an ambiguous commercial fact.
    for (const preference of preferences) {
      const level = preference.prefs_level;
      const piece = preference.order_item_piece_id ? pieceById.get(preference.order_item_piece_id) : undefined;
      const valid = (level === 'ORDER' && !preference.order_item_id && !preference.order_item_piece_id)
        || (level === 'ITEM' && !!preference.order_item_id && !preference.order_item_piece_id && itemIds.has(preference.order_item_id))
        || (level === 'PIECE' && !!preference.order_item_id && !!preference.order_item_piece_id
          && itemIds.has(preference.order_item_id) && piece?.order_item_id === preference.order_item_id);
      if (!valid) throw new OrderChangeContextError('INVALID_TARGET_HIERARCHY', 422);
    }

    const financial = await getOrderFinancialSummary(tenantId, input.orderId);
    return {
      orderId: order.id,
      orderNo: order.order_no,
      committedAt: order.committed_at.toISOString(),
      editStateVersion: order.edit_state_version,
      wfStateVersion: order.state_version,
      workflow: { currentStatus: order.current_status, profileId: order.wf_profile_id, profileVersionId: order.wf_profile_version_id },
      editAccess: { status: order.edit_access_status, reasonCode: order.edit_block_reason_code, reasonText: order.edit_block_reason_text, blockedUntil: toIso(order.edit_block_until) },
      permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
      configuration: { featureEnabled: false, newItemPricePolicy: null, existingDiscountPolicy: null, reasonPolicy: null, deferredReason: ORDER_CHANGE_CONTEXT_DEFERRED_REASON },
      order: {
        customer: { id: order.customer_id },
        customerSnapshot: { name: order.customer_name, mobile: order.customer_mobile_number, email: order.customer_email },
        branchId: order.branch_id, currencyCode: order.currency_code, priority: order.priority, serviceSpeed: order.service_speed,
        readyBy: toIso(order.ready_by), notes: order.internal_notes, customerNotes: order.customer_notes,
      },
      items: items.map((item) => ({
        id: item.id, orderId: item.order_id, productId: item.product_id, productName: item.product_name, productName2: item.product_name2,
        serviceCategoryCode: item.service_category_code, quantity: item.quantity, pricePerUnit: decimalText(item.price_per_unit), totalPrice: decimalText(item.total_price),
        priceOverride: item.price_override == null ? null : decimalText(item.price_override), preferenceCharge: decimalText(item.service_pref_charge), packingPreferenceCode: item.packing_pref_code, active: true,
      })),
      pieces: pieces.map((piece) => ({ id: piece.id, orderId: piece.order_id, orderItemId: piece.order_item_id, pieceSeq: piece.piece_seq, pieceStatus: piece.piece_status, pieceStage: piece.piece_stage, scanState: piece.scan_state, active: true })),
      preferences: preferences.map((preference) => ({
        id: preference.id, orderId: preference.order_id, level: preference.prefs_level, orderItemId: preference.order_item_id, orderItemPieceId: preference.order_item_piece_id,
        preferenceId: preference.preference_id, preferenceCode: preference.preference_code, preferenceKind: preference.preference_sys_kind, preferenceCategory: preference.preference_category,
        preferenceContent: preference.preference_content, extraPrice: decimalText(preference.extra_price), processingConfirmed: preference.processing_confirmed ?? false, active: true,
      })),
      financial: {
        totalAmount: decimalText(financial.snapshot.totalAmount), netCollectedAmount: decimalText(financial.snapshot.netCollectedAmount),
        outstandingAmount: decimalText(financial.snapshot.outstandingAmount), overpaidAmount: decimalText(financial.snapshot.overpaidAmount),
      },
      capabilitySummary: { status: 'DEFERRED', reasonCode: ORDER_CHANGE_CONTEXT_DEFERRED_REASON },
    };
  });
}
