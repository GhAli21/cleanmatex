'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { getOrderEditHistory } from '@/lib/services/order-audit.service';
import type { OrderEditHistoryEntry } from '@features/orders/ui/orders-edit-history-tab-rprt';

export async function getOrderEditHistoryAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderEditHistoryEntry[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const entries = await getOrderEditHistory(orderId, tenantId);

    const serialized: OrderEditHistoryEntry[] = entries.map((e) => ({
      id: e.id,
      orderId: e.orderId,
      orderNo: e.orderNo,
      editNumber: e.editNumber,
      editedBy: e.editedBy,
      editedByName: e.editedByName,
      editedAt: e.editedAt.toISOString(),
      ipAddress: e.ipAddress,
      changeSummary: e.changeSummary,
      changes: e.changes,
      paymentAdjusted: e.paymentAdjusted,
      paymentAdjustmentAmount:
        e.paymentAdjustmentAmount != null ? Number(e.paymentAdjustmentAmount) : null,
      paymentAdjustmentType: e.paymentAdjustmentType,
    }));

    return { success: true, data: serialized };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load edit history' };
  }
}
