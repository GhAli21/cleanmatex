/**
 * Server Actions: Cash Up / Reconciliation
 *
 * getCashUpData: expected amounts by method, existing reconciliation, payment methods.
 * submitCashUp: save reconciliation entries for a date.
 * getCashUpHistory: optional list of past reconciliations.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getExpectedAmountsByDate,
  getReconciliationForDate,
  saveReconciliation,
  listReconciliationHistory,
} from '@/lib/services/cashup-service';
import { getAvailablePaymentMethods } from '@/lib/services/payment-service';
import type {
  CashUpDayData,
  CashUpSubmitEntry,
  CashUpSubmitInput,
} from '@/lib/types/payment';
import type { ReconciliationHistoryItem } from '@/lib/services/cashup-service';

/**
 * Get cash-up data for a date: expected amounts by method, existing reconciliation, payment methods.
 */
export async function getCashUpData(date: string): Promise<
  | { success: true; data: CashUpDayData }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const dateObj = parseDate(date);
    if (!dateObj) {
      return { success: false, error: 'Invalid date format (use YYYY-MM-DD)' };
    }

    const [expectedByMethod, reconciliation, paymentMethods] = await Promise.all([
      getExpectedAmountsByDate(auth.tenantId, dateObj),
      getReconciliationForDate(auth.tenantId, dateObj),
      getAvailablePaymentMethods(),
    ]);

    const data: CashUpDayData = {
      date,
      expectedByMethod,
      reconciliation,
      paymentMethods,
    };

    return { success: true, data };
  } catch (error) {
    console.error('[getCashUpData] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load cash-up data',
    };
  }
}

/**
 * Submit cash-up reconciliation for a date.
 */
export async function submitCashUp(
  input: CashUpSubmitInput
): Promise<
  | { success: true; data: { message: string } }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const dateObj = parseDate(input.date);
    if (!dateObj) {
      return { success: false, error: 'Invalid date format (use YYYY-MM-DD)' };
    }

    if (!input.entries?.length) {
      return { success: false, error: 'At least one entry is required' };
    }

    for (const entry of input.entries) {
      if (!entry.payment_method_code?.trim()) {
        return { success: false, error: 'Payment method is required for each entry' };
      }
      const amount = Number(entry.actual_amount);
      if (Number.isNaN(amount) || amount < 0) {
        return { success: false, error: 'Actual amount must be a non-negative number' };
      }
    }

    const reconciledBy = auth.userId ?? auth.user?.email ?? 'unknown';
    await saveReconciliation(
      auth.tenantId,
      dateObj,
      input.entries as CashUpSubmitEntry[],
      reconciledBy
    );

    revalidatePath('/dashboard/billing/cashup');
    return { success: true, data: { message: 'Reconciliation saved' } };
  } catch (error) {
    console.error('[submitCashUp] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save reconciliation',
    };
  }
}

/**
 * Get reconciliation history (optional).
 */
export async function getCashUpHistory(filters?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<
  | { success: true; data: ReconciliationHistoryItem[] }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }

    const startDate = filters?.startDate ? parseDate(filters.startDate) : undefined;
    const endDate = filters?.endDate ? parseDate(filters.endDate) : undefined;

    const items = await listReconciliationHistory(auth.tenantId, {
      startDate,
      endDate,
      limit: filters?.limit ?? 50,
    });

    return { success: true, data: items };
  } catch (error) {
    console.error('[getCashUpHistory] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load history',
    };
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}
