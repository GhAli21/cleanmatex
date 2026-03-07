/**
 * Order Audit Service
 * Comprehensive audit tracking for order edits
 *
 * PRD: Edit Order Feature - Full Audit History
 * Tracks before/after snapshots, generates change summaries
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
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

    // Generate human-readable summary
    const changeSummary = generateChangeSummary(changeSet, orderNo);

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
 * Compares before/after order snapshots and generates structured change set
 */
export function compareOrderSnapshots(before: any, after: any): ChangeSet {
  const fieldChanges: FieldChange[] = [];
  const itemsAdded: ItemChange[] = [];
  const itemsRemoved: ItemChange[] = [];
  const itemsModified: ItemChange[] = [];

  // Compare order-level fields
  const fieldsToTrack = [
    { key: 'customer_id', display: 'Customer' },
    { key: 'customer_name', display: 'Customer Name' },
    { key: 'customer_mobile_number', display: 'Customer Phone' },
    { key: 'customer_email', display: 'Customer Email' },
    { key: 'branch_id', display: 'Branch' },
    { key: 'internal_notes', display: 'Notes' },
    { key: 'ready_by', display: 'Ready By' },
    { key: 'priority', display: 'Priority' },
    { key: 'is_order_quick_drop', display: 'Quick Drop' },
    { key: 'quick_drop_quantity', display: 'Quick Drop Quantity' },
  ];

  for (const field of fieldsToTrack) {
    if (before[field.key] !== after[field.key]) {
      fieldChanges.push({
        field: field.key,
        displayName: field.display,
        oldValue: before[field.key],
        newValue: after[field.key],
      });
    }
  }

  // Compare items
  const beforeItems = before.items || [];
  const afterItems = after.items || [];

  const beforeItemsMap = new Map(
    beforeItems.map((item: any) => [item.product_id, item])
  );
  const afterItemsMap = new Map(
    afterItems.map((item: any) => [item.product_id, item])
  );

  // Find removed items
  for (const [productId, item] of beforeItemsMap) {
    if (!afterItemsMap.has(productId)) {
      itemsRemoved.push({
        productId,
        productName: item.product_name || 'Unknown',
        changeType: 'removed',
        oldQuantity: item.quantity,
        oldPrice: Number(item.price_per_unit),
      });
    }
  }

  // Find added and modified items
  for (const [productId, afterItem] of afterItemsMap) {
    const beforeItem = beforeItemsMap.get(productId);

    if (!beforeItem) {
      // Added item
      itemsAdded.push({
        productId,
        productName: afterItem.product_name || 'Unknown',
        changeType: 'added',
        newQuantity: afterItem.quantity,
        newPrice: Number(afterItem.price_per_unit),
      });
    } else {
      // Check if modified
      const quantityChanged = beforeItem.quantity !== afterItem.quantity;
      const priceChanged =
        Number(beforeItem.price_per_unit) !== Number(afterItem.price_per_unit);

      if (quantityChanged || priceChanged) {
        itemsModified.push({
          productId,
          productName: afterItem.product_name || 'Unknown',
          changeType: 'modified',
          oldQuantity: beforeItem.quantity,
          newQuantity: afterItem.quantity,
          oldPrice: Number(beforeItem.price_per_unit),
          newPrice: Number(afterItem.price_per_unit),
        });
      }
    }
  }

  // Compare pricing
  let pricingChange: PricingChange | null = null;
  if (before.subtotal !== after.subtotal || before.total !== after.total) {
    const oldTotal = Number(before.total) || 0;
    const newTotal = Number(after.total) || 0;
    const difference = newTotal - oldTotal;
    const percentageChange = oldTotal > 0 ? (difference / oldTotal) * 100 : 0;

    pricingChange = {
      oldSubtotal: Number(before.subtotal) || 0,
      newSubtotal: Number(after.subtotal) || 0,
      oldTotal,
      newTotal,
      difference,
      percentageChange,
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
  orderNo: string | null
): string {
  const parts: string[] = [];

  // Field changes
  if (changeSet.fields.length > 0) {
    const fieldNames = changeSet.fields.map((f) => f.displayName || f.field);
    parts.push(`Updated ${fieldNames.join(', ')}`);
  }

  // Item changes
  const { added, removed, modified } = changeSet.items;

  if (added.length > 0) {
    const names = added.map((i) => i.productName).join(', ');
    parts.push(`Added ${added.length} item(s): ${names}`);
  }

  if (removed.length > 0) {
    const names = removed.map((i) => i.productName).join(', ');
    parts.push(`Removed ${removed.length} item(s): ${names}`);
  }

  if (modified.length > 0) {
    const names = modified.map((i) => i.productName).join(', ');
    parts.push(`Modified ${modified.length} item(s): ${names}`);
  }

  // Pricing changes
  if (changeSet.pricing) {
    const { oldTotal, newTotal, difference } = changeSet.pricing;
    const direction = difference > 0 ? 'increased' : 'decreased';
    parts.push(
      `Total ${direction} from ${oldTotal.toFixed(2)} to ${newTotal.toFixed(2)}`
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
