/**
 * Read-side facts for Edit preview. Queries filter tenant_org_id directly.
 * This module does not insert, update, or delete commercial rows.
 */

import 'server-only';

import { toMoneyString } from '@/lib/utils/money';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { quoteOrderEdit, readEditOrderRecord, type EditOrderRecord } from '@/lib/services/commercial/commercial-edit.loader';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';
import type { OrderChangeEditPricer } from '@/lib/services/order-change/order-change-edit-pricing';
import { readSettlementFingerprint } from './order-change-settlement-fingerprint';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { OrderChangeCapabilityBinding, OrderChangeReviewProofKey } from '@/lib/services/order-change/order-change-capability.service';
import { resolveOrderChangePolicyBindings, type OrderChangeEditPolicyResolution } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';
import type { OrderChangePreferenceDefinition, OrderChangePreferenceLevel } from '@/lib/services/order-change/order-change-preference-projection';
import type { OrderChangePreviewAuditFacts } from '@/lib/services/order-change/order-change-review-audit';
import type { AggregationCreditRow, AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';

type ChangeOperation = z.infer<typeof orderChangeRequestSchema>['operations'][number];

/** Typed read failure so the route can keep the V3 envelope. */
export class OrderChangePreviewReadError extends Error {
  constructor(
    readonly code: 'CURRENCY_UNRESOLVED',
    readonly status: 422,
  ) {
    super(code);
    this.name = 'OrderChangePreviewReadError';
  }
}

export interface OrderChangePreviewFacts {
  featureEnabled: boolean;
  bindings: readonly OrderChangeCapabilityBinding[];
  /** Retains authority identity when a winning policy has no rule for the current status. */
  policyResolution: OrderChangeEditPolicyResolution;
  /**
   * Prices the projected order on the commercial calculator from the order's
   * own record (P6-01b). It reads the record on first use only, so a
   * header-only edit costs no commercial read.
   */
  priceEdit: OrderChangeEditPricer;
  catalog: readonly OrderChangePreferenceDefinition[];
  currencyDecimalPlaces: number;
  /** Active payment rows, with the cash change handed back on each tender. */
  payments: ReadonlyArray<AggregationPaymentRow & { change_returned_amount: string | null }>;
  credits: readonly AggregationCreditRow[];
  refunds: ReadonlyArray<{ refund_status: string | null; refund_amount: string; reopens_due_amount: string }>;
  /** Overpayment already moved to the customer's wallet or advance (active disposition amounts). */
  appliedDispositions: readonly string[];
  /** Digest of every settlement fact; Review signs it and Apply re-reads it under the order lock. */
  settlementFingerprint: string;
  /** Order tax stored before this review. The speed audit freezes it as the before tax. */
  persistedTaxAmount: string;
  /** Stored commercial rows used to show the same before and after values Apply will record. */
  auditFacts: OrderChangePreviewAuditFacts;
  proofKey: OrderChangeReviewProofKey | null;
}

function decimalText(value: { toString(): string } | number | string | null | undefined): string {
  return value == null ? '0.0000' : String(value);
}

function auditMoney(value: { toString(): string } | number | string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return toMoneyString(decimalText(value));
}

function auditTime(value: Date | string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return value;
}

function auditRow(id: string, values: Record<string, unknown>): [string, Record<string, unknown>] {
  return [id.toLowerCase(), Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))];
}

function parentLevel(operation: Extract<ChangeOperation, { code: 'ADD_PREFERENCE' }>): OrderChangePreferenceLevel {
  if (operation.target.kind === 'ORDER') return 'ORDER';
  if (operation.target.kind === 'PERSISTED_PIECE' || operation.target.kind === 'LOCAL_PIECE') return 'PIECE';
  return 'ITEM';
}

/**
 * Loads the current flag, policy bindings, settlement rows, the Edit pricer and currency places.
 * Preference catalog rows are tenant-filtered. Their level follows the server-derived parent
 * because the organization preference table does not store a separate level.
 */
export async function loadOrderChangePreviewFacts(input: {
  tenantId: string;
  actorUserId: string;
  context: OrderChangeContext;
  operations: readonly ChangeOperation[];
}): Promise<OrderChangePreviewFacts> {
  return withTenantContext(input.tenantId, async (tenantId) => {
    const flags = await getFeatureFlags(tenantId);
    const preferenceIds = [...new Set(input.operations.flatMap((operation) => operation.code === 'ADD_PREFERENCE' ? [operation.payload.preferenceId] : []))];
    const settlement = await prisma.$transaction(async (tx) => {
      const policyResolution = await resolveOrderChangePolicyBindings(tx, {
        tenantId,
        profileId: input.context.workflow.profileId,
        profileVersionId: input.context.workflow.profileVersionId,
        workflowStatus: input.context.workflow.currentStatus,
      });
      const payments = await tx.org_order_payments_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        // Same fields the snapshot writer reads: the real-payment rule and the change returned need them.
        select: {
          amount: true, payment_status: true, payment_nature_snapshot: true, payment_method_code: true,
          org_payment_method_id: true, gateway_code: true, gateway_reference: true, tendered_amount: true,
          check_no: true, bank_reference: true, change_returned_amount: true,
        },
      });
      const dispositions = await tx.org_fin_overpay_disp_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, is_active: true },
        select: { amount: true },
      });
      const credits = await tx.org_order_credit_apps_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        select: { applied_amount: true, application_status: true },
      });
      const refunds = await tx.org_order_refunds_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        select: { refund_status: true, refund_amount: true, reopens_due_amount: true },
      });
      const storedOrder = await tx.org_orders_mst.findFirst({
        where: { id: input.context.orderId, tenant_org_id: tenantId },
        select: {
          status: true, current_status: true, current_stage: true, priority: true, service_speed: true,
          ready_by: true, total_items: true, internal_notes: true, customer_notes: true, customer_name: true,
          customer_mobile_number: true, customer_email: true, is_default_customer: true, customer_details: true,
          currency_code: true, tax_rate: true, vat_rate: true,
          payment_status: true, payment_type_code: true, subtotal_amount: true, items_base_amount: true,
          total_charges_amount: true, total_discount_amount: true, piece_extra_price_amount: true,
          preference_extra_price_amount: true, service_charge_amount: true, delivery_charge_amount: true,
          express_charge_amount: true, other_charges_amount: true, taxable_amount: true, total_tax_amount: true,
          total_amount: true, total_paid_amount: true, outstanding_amount: true,
        },
      });
      const itemIds = input.operations.flatMap((operation) => (
        (operation.code === 'REMOVE_ITEM' || operation.code === 'CHANGE_ITEM_QUANTITY' || operation.code === 'CHANGE_UNLISTED')
        && operation.target.kind === 'PERSISTED_ITEM' ? [operation.target.id] : []
      ));
      const pieceIds = input.operations.flatMap((operation) => (
        (operation.code === 'REMOVE_PIECE' || operation.code === 'CHANGE_UNLISTED'
          || operation.code === 'CHANGE_SERVICE_SPEED' || operation.code === 'CHANGE_DISCOUNT')
        && operation.target.kind === 'PERSISTED_PIECE' ? [operation.target.id] : []
      ));
      const preferenceIdsForAudit = input.operations.flatMap((operation) => (
        operation.code === 'CHANGE_PREFERENCE' || operation.code === 'REMOVE_PREFERENCE' ? [operation.target.id] : []
      ));
      const productIds = input.operations.flatMap((operation) => operation.code === 'ADD_ITEM' && operation.payload.productId ? [operation.payload.productId] : []);
      const auditItems = itemIds.length === 0 ? [] : await tx.org_order_items_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, id: { in: itemIds }, rec_status: 1 },
        select: {
          id: true, branch_id: true, order_item_srno: true, product_id: true, product_name: true, product_name2: true,
          barcode: true, service_category_code: true, quantity: true, quantity_ready: true, color: true, brand: true,
          override_reason: true, price_per_unit: true, total_price: true, price_override: true, service_pref_charge: true,
          status: true, item_status: true, item_stage: true, item_is_rejected: true, notes: true, stain_notes: true,
          damage_notes: true, packing_pref_code: true, packing_pref_is_override: true, packing_pref_source: true,
          has_stain: true, has_damage: true, rec_status: true,
        },
      });
      const auditPieces = pieceIds.length === 0 ? [] : await tx.org_order_item_pieces_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, id: { in: pieceIds }, rec_status: 1 },
        select: {
          id: true, order_item_id: true, branch_id: true, piece_seq: true, piece_code: true, service_category_code: true,
          product_id: true, barcode: true, color: true, brand: true, notes: true, packing_pref_code: true,
          has_stain: true, has_damage: true, is_rejected: true, is_ready: true, quantity: true, price_per_unit: true,
          total_price: true, service_pref_charge: true, piece_status: true, piece_stage: true, scan_state: true, rec_status: true,
        },
      });
      const auditPreferences = preferenceIdsForAudit.length === 0 ? [] : await tx.org_order_preferences_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, id: { in: preferenceIdsForAudit }, rec_status: 1 },
        select: {
          id: true, branch_id: true, prefs_no: true, prefs_level: true, order_item_id: true, order_item_piece_id: true,
          preference_id: true, preference_code: true, preference_content: true, preference_sys_kind: true,
          preference_category: true, prefs_owner_type: true, prefs_source: true, extra_price: true,
          processing_confirmed: true, confirmed_by: true, confirmed_at: true, notes_followup: true, rec_status: true,
        },
      });
      const auditProducts = productIds.length === 0 ? [] : await tx.org_product_data_mst.findMany({
        where: { tenant_org_id: tenantId, id: { in: productIds }, rec_status: 1 },
        select: { id: true, product_name: true, product_name2: true, service_category_code: true },
      });
      const preferences = preferenceIds.length === 0
        ? []
        : await tx.org_service_preference_cf.findMany({
          where: { tenant_org_id: tenantId, id: { in: preferenceIds }, is_active: true, rec_status: 1 },
          select: { id: true, preference_code: true, extra_price: true, preference_category: true, preference_sys_kind: true },
        });
      const settlementFingerprint = await readSettlementFingerprint(tx, tenantId, input.context.orderId);
      return { policyResolution, payments, dispositions, settlementFingerprint, credits, refunds, preferences, storedOrder, auditItems, auditPieces, auditPreferences, auditProducts };
    });

    const catalog: OrderChangePreferenceDefinition[] = [];
    for (const preferenceId of preferenceIds) {
      const operation = input.operations.find((candidate) => candidate.code === 'ADD_PREFERENCE' && candidate.payload.preferenceId === preferenceId);
      const row = settlement.preferences.find((candidate) => candidate.id === preferenceId);
      if (!operation || operation.code !== 'ADD_PREFERENCE' || !row || row.preference_code !== operation.payload.preferenceCode) continue;
      catalog.push({
        id: row.id,
        code: row.preference_code,
        kind: row.preference_sys_kind,
        category: row.preference_category ?? '',
        level: parentLevel(operation),
        extraPrice: decimalText(row.extra_price),
      });
    }

    const supabase = await createClient();
    const settings = createTenantSettingsService(supabase);
    let currencyDecimalPlaces: number;
    try {
      currencyDecimalPlaces = (await settings.getCurrencyConfig(tenantId, input.context.order.branchId, input.actorUserId)).decimalPlaces;
    } catch {
      throw new OrderChangePreviewReadError('CURRENCY_UNRESOLVED', 422);
    }
    const currencyCode = input.context.order.currencyCode;
    if (!currencyCode) throw new OrderChangePreviewReadError('CURRENCY_UNRESOLVED', 422);
    let record: EditOrderRecord | null = null;
    // All reads scoped to the tenant: the pricer runs later, so it opens its own tenant context.
    const priceEdit: OrderChangeEditPricer = (projection) => withTenantContext(tenantId, async () => {
      record ??= await readEditOrderRecord(prisma, tenantId, input.context.orderId);
      return quoteOrderEdit(prisma as unknown as CommercialDb, tenantId, record, projection, {
        currency: { code: currencyCode, decimalPlaces: currencyDecimalPlaces },
      });
    });

    const secret = process.env.ORDER_CHANGE_REVIEW_PROOF_SECRET;
    const keyId = process.env.ORDER_CHANGE_REVIEW_PROOF_KEY_ID;
    return {
      featureEnabled: flags.order_edit_v2 === true,
      bindings: settlement.policyResolution.bindings,
      policyResolution: settlement.policyResolution,
      priceEdit,
      catalog,
      currencyDecimalPlaces,
      payments: settlement.payments.map((row) => ({
        amount: decimalText(row.amount),
        payment_status: row.payment_status,
        payment_nature_snapshot: row.payment_nature_snapshot,
        payment_method_code: row.payment_method_code,
        org_payment_method_id: row.org_payment_method_id,
        gateway_code: row.gateway_code,
        gateway_reference: row.gateway_reference,
        tendered_amount: row.tendered_amount == null ? null : decimalText(row.tendered_amount),
        check_no: row.check_no,
        bank_reference: row.bank_reference,
        change_returned_amount: row.change_returned_amount == null ? null : decimalText(row.change_returned_amount),
      })),
      appliedDispositions: settlement.dispositions.map((row) => decimalText(row.amount)),
      settlementFingerprint: settlement.settlementFingerprint,
      credits: settlement.credits.map((row) => ({
        applied_amount: decimalText(row.applied_amount),
        application_status: row.application_status,
      })),
      refunds: settlement.refunds.map((row) => ({
        refund_status: row.refund_status,
        refund_amount: decimalText(row.refund_amount),
        reopens_due_amount: decimalText(row.reopens_due_amount),
      })),
      persistedTaxAmount: decimalText(settlement.storedOrder?.total_tax_amount),
      auditFacts: {
        order: settlement.storedOrder ? {
          status: settlement.storedOrder.status,
          current_status: settlement.storedOrder.current_status,
          current_stage: settlement.storedOrder.current_stage,
          priority: settlement.storedOrder.priority,
          service_speed: settlement.storedOrder.service_speed,
          ready_by: auditTime(settlement.storedOrder.ready_by),
          total_items: settlement.storedOrder.total_items,
          internal_notes: settlement.storedOrder.internal_notes,
          customer_notes: settlement.storedOrder.customer_notes,
          customer_name: settlement.storedOrder.customer_name,
          customer_mobile_number: settlement.storedOrder.customer_mobile_number,
          customer_email: settlement.storedOrder.customer_email,
          is_default_customer: settlement.storedOrder.is_default_customer,
          customer_details: settlement.storedOrder.customer_details,
          currency_code: settlement.storedOrder.currency_code,
          tax_rate: auditMoney(settlement.storedOrder.tax_rate),
          vat_rate: auditMoney(settlement.storedOrder.vat_rate),
          payment_status: settlement.storedOrder.payment_status,
          payment_type_code: settlement.storedOrder.payment_type_code,
          subtotal_amount: auditMoney(settlement.storedOrder.subtotal_amount),
          items_base_amount: auditMoney(settlement.storedOrder.items_base_amount),
          total_charges_amount: auditMoney(settlement.storedOrder.total_charges_amount),
          total_discount_amount: auditMoney(settlement.storedOrder.total_discount_amount),
          piece_extra_price_amount: auditMoney(settlement.storedOrder.piece_extra_price_amount),
          preference_extra_price_amount: auditMoney(settlement.storedOrder.preference_extra_price_amount),
          service_charge_amount: auditMoney(settlement.storedOrder.service_charge_amount),
          delivery_charge_amount: auditMoney(settlement.storedOrder.delivery_charge_amount),
          express_charge_amount: auditMoney(settlement.storedOrder.express_charge_amount),
          other_charges_amount: auditMoney(settlement.storedOrder.other_charges_amount),
          taxable_amount: auditMoney(settlement.storedOrder.taxable_amount),
          total_tax_amount: auditMoney(settlement.storedOrder.total_tax_amount),
          total_amount: auditMoney(settlement.storedOrder.total_amount),
          total_paid_amount: auditMoney(settlement.storedOrder.total_paid_amount),
          outstanding_amount: auditMoney(settlement.storedOrder.outstanding_amount),
        } : null,
        items: Object.fromEntries(settlement.auditItems.map((row) => auditRow(row.id, {
          id: row.id,
          branch_id: row.branch_id,
          order_item_srno: row.order_item_srno,
          product_id: row.product_id,
          product_name: row.product_name,
          product_name2: row.product_name2,
          barcode: row.barcode,
          service_category_code: row.service_category_code,
          quantity: row.quantity,
          quantity_ready: row.quantity_ready,
          price_per_unit: auditMoney(row.price_per_unit),
          total_price: auditMoney(row.total_price),
          price_override: auditMoney(row.price_override),
          override_reason: row.override_reason,
          service_pref_charge: auditMoney(row.service_pref_charge),
          status: row.status,
          item_status: row.item_status,
          item_stage: row.item_stage,
          item_is_rejected: row.item_is_rejected,
          notes: row.notes,
          stain_notes: row.stain_notes,
          damage_notes: row.damage_notes,
          packing_pref_code: row.packing_pref_code,
          packing_pref_is_override: row.packing_pref_is_override,
          packing_pref_source: row.packing_pref_source,
          has_stain: row.has_stain,
          has_damage: row.has_damage,
          color: row.color,
          brand: row.brand,
          rec_status: row.rec_status,
        }))),
        pieces: Object.fromEntries(settlement.auditPieces.map((row) => auditRow(row.id, {
          id: row.id,
          order_item_id: row.order_item_id,
          branch_id: row.branch_id,
          piece_seq: row.piece_seq,
          piece_code: row.piece_code,
          service_category_code: row.service_category_code,
          product_id: row.product_id,
          barcode: row.barcode,
          color: row.color,
          brand: row.brand,
          notes: row.notes,
          packing_pref_code: row.packing_pref_code,
          has_stain: row.has_stain,
          has_damage: row.has_damage,
          is_rejected: row.is_rejected,
          is_ready: row.is_ready,
          quantity: row.quantity,
          price_per_unit: auditMoney(row.price_per_unit),
          total_price: auditMoney(row.total_price),
          service_pref_charge: auditMoney(row.service_pref_charge),
          piece_status: row.piece_status,
          piece_stage: row.piece_stage,
          scan_state: row.scan_state,
          rec_status: row.rec_status,
        }))),
        preferences: Object.fromEntries(settlement.auditPreferences.map((row) => auditRow(row.id, {
          id: row.id,
          branch_id: row.branch_id,
          prefs_no: row.prefs_no,
          prefs_level: row.prefs_level,
          order_item_id: row.order_item_id,
          order_item_piece_id: row.order_item_piece_id,
          preference_id: row.preference_id,
          preference_code: row.preference_code,
          preference_content: row.preference_content,
          preference_sys_kind: row.preference_sys_kind,
          preference_category: row.preference_category,
          prefs_owner_type: row.prefs_owner_type,
          prefs_source: row.prefs_source,
          extra_price: auditMoney(row.extra_price),
          processing_confirmed: row.processing_confirmed,
          confirmed_by: row.confirmed_by,
          confirmed_at: auditTime(row.confirmed_at),
          notes_followup: row.notes_followup,
          rec_status: row.rec_status,
        }))),
        products: Object.fromEntries(settlement.auditProducts.map((row) => [row.id.toLowerCase(), {
          product_name: row.product_name,
          product_name2: row.product_name2,
          service_category_code: row.service_category_code,
        }])),
      },
      proofKey: secret && keyId ? { keyId, secret } : null,
    };
  });
}
