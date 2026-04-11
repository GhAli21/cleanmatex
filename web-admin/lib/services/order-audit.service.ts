/**
 * Order Audit Service
 * Comprehensive audit tracking for order edits
 *
 * PRD: Edit Order Feature - Full Audit History
 * Tracks before/after snapshots, generates change summaries
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { logger } from '@/lib/utils/logger';

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  displayName?: string;
}

export interface ItemChange {
  productId: string;
  productName: string;
  changeType: 'added' | 'removed' | 'modified';
  oldQuantity?: number;
  newQuantity?: number;
  oldPrice?: number;
  newPrice?: number;
  oldTotalPrice?: number;
  newTotalPrice?: number;
  oldNotes?: string | null;
  newNotes?: string | null;
  oldHasStain?: boolean | null;
  newHasStain?: boolean | null;
  oldHasDamage?: boolean | null;
  newHasDamage?: boolean | null;
  oldStainNotes?: string | null;
  newStainNotes?: string | null;
  oldDamageNotes?: string | null;
  newDamageNotes?: string | null;
}

export interface PricingChange {
  oldSubtotal: number;
  newSubtotal: number;
  oldTotal: number;
  newTotal: number;
  difference: number;
  percentageChange: number;
}

export interface ChangeSet {
  fields: FieldChange[];
  items: {
    added: ItemChange[];
    removed: ItemChange[];
    modified: ItemChange[];
  };
  pricing: PricingChange | null;
}

export interface OrderEditAuditEntry {
  id: string;
  tenantOrgId: string;
  orderId: string;
  orderNo: string | null;
  editNumber: number;
  editedBy: string;
  editedByName: string | null;
  editedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  snapshotBefore: any;
  snapshotAfter: any;
  changes: ChangeSet;
  changeSummary: string;
  paymentAdjusted: boolean;
  paymentAdjustmentAmount: number | null;
  paymentAdjustmentType: string | null;
}

export interface CreateEditAuditParams {
  tenantId: string;
  orderId: string;
  orderNo: string | null;
  editedBy: string;
  editedByName?: string;
  ipAddress?: string;
  userAgent?: string;
  snapshotBefore: any;
  snapshotAfter: any;
  paymentAdjusted?: boolean;
  paymentAdjustmentAmount?: number;
  paymentAdjustmentType?: 'CHARGE' | 'REFUND';
}

/**
 * Creates a comprehensive audit entry for an order edit
 */
export async function createEditAudit(
  params: CreateEditAuditParams
): Promise<OrderEditAuditEntry> {
  const {
    tenantId,
    orderId,
    orderNo,
    editedBy,
    editedByName,
    ipAddress,
    userAgent,
    snapshotBefore,
    snapshotAfter,
    paymentAdjusted = false,
    paymentAdjustmentAmount,
    paymentAdjustmentType,
  } = params;

  return withTenantContext(tenantId, async () => {
    // Generate change set
    const changeSet = compareOrderSnapshots(snapshotBefore, snapshotAfter);

    const supabase = await createClient();
    const { decimalPlaces } = await createTenantSettingsService(supabase).getCurrencyConfig(
      tenantId,
      undefined,
      editedBy
    );
    const dp =
      Number.isFinite(decimalPlaces) && decimalPlaces >= 0
        ? decimalPlaces
        : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;

    // Generate human-readable summary
    const changeSummary = generateChangeSummary(changeSet, orderNo, dp);

    // Get next edit number for this order
    const lastEdit = await prisma.org_order_edit_history.findFirst({
      where: {
        order_id: orderId,
        tenant_org_id: tenantId,
      },
      orderBy: {
        edit_number: 'desc',
      },
      select: {
        edit_number: true,
      },
    });

    const editNumber = (lastEdit?.edit_number || 0) + 1;

    // Create audit entry
    const auditEntry = await prisma.org_order_edit_history.create({
      data: {
        tenant_org_id: tenantId,
        order_id: orderId,
        order_no: orderNo,
        edit_number: editNumber,
        edited_by: editedBy,
        edited_by_name: editedByName || null,
        edited_at: new Date(),
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        snapshot_before: snapshotBefore,
        snapshot_after: snapshotAfter,
        changes: changeSet as any,
        change_summary: changeSummary,
        payment_adjusted: paymentAdjusted,
        payment_adjustment_amount: paymentAdjustmentAmount || null,
        payment_adjustment_type: paymentAdjustmentType || null,
      },
    });

    logger.info('[createEditAudit] Audit entry created', {
      feature: 'orders',
      action: 'audit_create',
      orderId,
      orderNo,
      editNumber,
      editedBy,
    });

    return mapToAuditEntry(auditEntry);
  });
}

/**
 * Retrieves full edit history for an order
 */
export async function getOrderEditHistory(
  orderId: string,
  tenantId: string
): Promise<OrderEditAuditEntry[]> {
  return withTenantContext(tenantId, async () => {
    const entries = await prisma.org_order_edit_history.findMany({
      where: {
        order_id: orderId,
        tenant_org_id: tenantId,
      },
      orderBy: {
        edit_number: 'desc',
      },
    });

    return entries.map(mapToAuditEntry);
  });
}

/**
 * Compares before/after order snapshots and generates structured change set.
 * Snapshots are shaped as { order: {...camelCase fields}, items: [...camelCase] }
 */
export function compareOrderSnapshots(before: any, after: any): ChangeSet {
  const fieldChanges: FieldChange[] = [];
  const itemsAdded: ItemChange[] = [];
  const itemsRemoved: ItemChange[] = [];
  const itemsModified: ItemChange[] = [];

  // Snapshots store order fields under `before.order` in camelCase
  const bo = before?.order ?? before ?? {};
  const ao = after?.order ?? after ?? {};

  const fieldsToTrack: Array<{ key: string; display: string; isDate?: boolean; isBool?: boolean }> = [
    { key: 'customerId',       display: 'Customer' },
    { key: 'customerName',     display: 'Customer Name' },
    { key: 'customerMobile',   display: 'Customer Phone' },
    { key: 'customerEmail',    display: 'Customer Email' },
    { key: 'branchId',         display: 'Branch' },
    { key: 'notes',            display: 'Internal Notes' },
    { key: 'customerNotes',    display: 'Customer Notes' },
    { key: 'paymentNotes',     display: 'Payment Notes' },
    { key: 'readyByAt',        display: 'Ready By', isDate: true },
    { key: 'express',          display: 'Express / Priority', isBool: true },
    { key: 'isQuickDrop',      display: 'Quick Drop', isBool: true },
    { key: 'quickDropQuantity', display: 'Quick Drop Quantity' },
  ];

  for (const field of fieldsToTrack) {
    let oldVal = bo[field.key];
    let newVal = ao[field.key];

    // Normalise dates to ISO string for stable comparison
    if (field.isDate) {
      oldVal = oldVal ? new Date(oldVal).toISOString() : null;
      newVal = newVal ? new Date(newVal).toISOString() : null;
    }

    // Treat null/undefined as equivalent
    const oldNorm = oldVal ?? null;
    const newNorm = newVal ?? null;

    if (oldNorm !== newNorm) {
      fieldChanges.push({
        field: field.key,
        displayName: field.display,
        oldValue: bo[field.key],
        newValue: ao[field.key],
      });
    }
  }

  // Compare pricing fields at the order level
  const pricingFields: Array<{ key: string; display: string }> = [
    { key: 'subtotal',  display: 'Subtotal' },
    { key: 'discount',  display: 'Discount' },
    { key: 'tax',       display: 'Tax' },
  ];
  for (const pf of pricingFields) {
    const oldNum = bo[pf.key] != null ? Number(bo[pf.key]) : null;
    const newNum = ao[pf.key] != null ? Number(ao[pf.key]) : null;
    if (oldNum !== newNum) {
      fieldChanges.push({
        field: pf.key,
        displayName: pf.display,
        oldValue: bo[pf.key],
        newValue: ao[pf.key],
      });
    }
  }

  // Items — snapshots use camelCase keys: productId, productName, quantity, pricePerUnit, totalPrice,
  // notes, hasStain, hasDamage, stainNotes, damageNotes
  const beforeItems: any[] = before?.items ?? [];
  const afterItems: any[]  = after?.items  ?? [];

  const beforeItemsMap = new Map<string, any>(
    beforeItems.map((item: any) => [item.productId, item])
  );
  const afterItemsMap = new Map<string, any>(
    afterItems.map((item: any) => [item.productId, item])
  );

  // Removed items
  for (const [productId, item] of beforeItemsMap) {
    if (!afterItemsMap.has(productId)) {
      itemsRemoved.push({
        productId,
        productName: item.productName || item.product_name || productId.slice(0, 8),
        changeType: 'removed',
        oldQuantity: item.quantity,
        oldPrice: item.pricePerUnit != null ? Number(item.pricePerUnit) : undefined,
        oldTotalPrice: item.totalPrice != null ? Number(item.totalPrice) : undefined,
        oldNotes: item.notes ?? null,
        oldHasStain: item.hasStain ?? null,
        oldHasDamage: item.hasDamage ?? null,
        oldStainNotes: item.stainNotes ?? null,
        oldDamageNotes: item.damageNotes ?? null,
      });
    }
  }

  // Added + modified items
  for (const [productId, afterItem] of afterItemsMap) {
    const beforeItem = beforeItemsMap.get(productId);
    const pName = afterItem.productName || afterItem.product_name || productId.slice(0, 8);

    if (!beforeItem) {
      itemsAdded.push({
        productId,
        productName: pName,
        changeType: 'added',
        newQuantity: afterItem.quantity,
        newPrice: afterItem.pricePerUnit != null ? Number(afterItem.pricePerUnit) : undefined,
        newTotalPrice: afterItem.totalPrice != null ? Number(afterItem.totalPrice) : undefined,
        newNotes: afterItem.notes ?? null,
        newHasStain: afterItem.hasStain ?? null,
        newHasDamage: afterItem.hasDamage ?? null,
        newStainNotes: afterItem.stainNotes ?? null,
        newDamageNotes: afterItem.damageNotes ?? null,
      });
    } else {
      const quantityChanged  = beforeItem.quantity   !== afterItem.quantity;
      const priceChanged     = Number(beforeItem.pricePerUnit)  !== Number(afterItem.pricePerUnit);
      const notesChanged     = (beforeItem.notes     ?? null) !== (afterItem.notes     ?? null);
      const stainChanged     = (beforeItem.hasStain  ?? null) !== (afterItem.hasStain  ?? null);
      const damageChanged    = (beforeItem.hasDamage ?? null) !== (afterItem.hasDamage ?? null);
      const stainNotesChg    = (beforeItem.stainNotes  ?? null) !== (afterItem.stainNotes  ?? null);
      const damageNotesChg   = (beforeItem.damageNotes ?? null) !== (afterItem.damageNotes ?? null);

      if (quantityChanged || priceChanged || notesChanged || stainChanged || damageChanged || stainNotesChg || damageNotesChg) {
        itemsModified.push({
          productId,
          productName: pName,
          changeType: 'modified',
          oldQuantity:    beforeItem.quantity,
          newQuantity:    afterItem.quantity,
          oldPrice:       beforeItem.pricePerUnit  != null ? Number(beforeItem.pricePerUnit)  : undefined,
          newPrice:       afterItem.pricePerUnit   != null ? Number(afterItem.pricePerUnit)   : undefined,
          oldTotalPrice:  beforeItem.totalPrice    != null ? Number(beforeItem.totalPrice)    : undefined,
          newTotalPrice:  afterItem.totalPrice     != null ? Number(afterItem.totalPrice)     : undefined,
          oldNotes:       beforeItem.notes    ?? null,
          newNotes:       afterItem.notes     ?? null,
          oldHasStain:    beforeItem.hasStain  ?? null,
          newHasStain:    afterItem.hasStain   ?? null,
          oldHasDamage:   beforeItem.hasDamage ?? null,
          newHasDamage:   afterItem.hasDamage  ?? null,
          oldStainNotes:  beforeItem.stainNotes  ?? null,
          newStainNotes:  afterItem.stainNotes   ?? null,
          oldDamageNotes: beforeItem.damageNotes ?? null,
          newDamageNotes: afterItem.damageNotes  ?? null,
        });
      }
    }
  }

  // Pricing totals change
  let pricingChange: PricingChange | null = null;
  const oldTotal = Number(bo.total) || 0;
  const newTotal = Number(ao.total) || 0;
  if (oldTotal !== newTotal || Number(bo.subtotal) !== Number(ao.subtotal)) {
    const difference = newTotal - oldTotal;
    pricingChange = {
      oldSubtotal: Number(bo.subtotal) || 0,
      newSubtotal: Number(ao.subtotal) || 0,
      oldTotal,
      newTotal,
      difference,
      percentageChange: oldTotal > 0 ? (difference / oldTotal) * 100 : 0,
    };
  }

  return {
    fields: fieldChanges,
    items: {
      added: itemsAdded,
      removed: itemsRemoved,
      modified: itemsModified,
    },
    pricing: pricingChange,
  };
}

/**
 * Generates human-readable change summary
 */
export function generateChangeSummary(
  changeSet: ChangeSet,
  orderNo: string | null,
  decimalPlaces: number = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
): string {
  const parts: string[] = [];

  if (changeSet.fields.length > 0) {
    const fieldNames = changeSet.fields.map((f) => f.displayName || f.field);
    parts.push(`Updated: ${fieldNames.join(', ')}`);
  }

  const { added, removed, modified } = changeSet.items;
  if (added.length > 0) {
    parts.push(`Added ${added.length} item(s): ${added.map((i) => i.productName).join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`Removed ${removed.length} item(s): ${removed.map((i) => i.productName).join(', ')}`);
  }
  if (modified.length > 0) {
    parts.push(`Modified ${modified.length} item(s): ${modified.map((i) => i.productName).join(', ')}`);
  }

  if (changeSet.pricing) {
    const { oldTotal, newTotal, difference } = changeSet.pricing;
    const direction = difference > 0 ? 'increased' : 'decreased';
    parts.push(
      `Total ${direction} from ${oldTotal.toFixed(decimalPlaces)} to ${newTotal.toFixed(decimalPlaces)}`
    );
  }

  if (parts.length === 0) {
    return `Order ${orderNo || ''} edited (no significant changes detected)`;
  }

  return parts.join('; ');
}

/**
 * Maps Prisma model to OrderEditAuditEntry interface
 */
function mapToAuditEntry(entry: any): OrderEditAuditEntry {
  return {
    id: entry.id,
    tenantOrgId: entry.tenant_org_id,
    orderId: entry.order_id,
    orderNo: entry.order_no,
    editNumber: entry.edit_number,
    editedBy: entry.edited_by,
    editedByName: entry.edited_by_name,
    editedAt: entry.edited_at,
    ipAddress: entry.ip_address,
    userAgent: entry.user_agent,
    snapshotBefore: entry.snapshot_before,
    snapshotAfter: entry.snapshot_after,
    changes: entry.changes,
    changeSummary: entry.change_summary,
    paymentAdjusted: entry.payment_adjusted,
    paymentAdjustmentAmount: entry.payment_adjustment_amount
      ? Number(entry.payment_adjustment_amount)
      : null,
    paymentAdjustmentType: entry.payment_adjustment_type,
  };
}
