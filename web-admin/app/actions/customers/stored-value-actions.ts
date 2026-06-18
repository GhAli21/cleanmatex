/**
 * Server Actions: Customer Stored Value
 *
 * getAllStoredValueSummaries — tenant-wide summary of customers with stored value balances.
 * topUpWallet               — top up a customer's wallet balance.
 * issueAdvance              — issue / top up a customer advance balance.
 * issueCreditNoteAction     — create a new credit note for a customer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  topUpWalletTx,
  issueAdvanceTx,
  issueCreditNote,
} from '@/lib/services/stored-value.service';

/**
 *
 */
export interface StoredValueSummaryRow {
  customerId:         string;
  customerName:       string;
  walletBalance:      number;
  walletCurrency:     string | null;
  advanceBalance:     number;
  advanceCurrency:    string | null;
  creditNoteCount:    number;
  creditNoteTotal:    number;
  creditNoteCurrency: string | null;
}

/** Return all customers that have any stored value (wallet / advance / active credit notes). */
export async function getAllStoredValueSummaries(): Promise<{
  success: true;
  data: StoredValueSummaryRow[];
} | {
  success: false;
  error: string;
}> {
  try {
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    const [wallets, advances, creditNotes] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_customer_wallets_mst.findMany({
          where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
          select: {
            customer_id:  true,
            balance:      true,
            currency_code: true,
          },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_customer_advances_mst.findMany({
          where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
          select: {
            customer_id:  true,
            balance:      true,
            currency_code: true,
          },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_credit_notes_mst.findMany({
          where: { tenant_org_id: tenantId, status: 'ACTIVE', is_active: true, rec_status: 1 },
          select: {
            customer_id:       true,
            remaining_balance: true,
            currency_code:     true,
          },
        })
      ),
    ]);

    // Collect all unique customer IDs that have any balance
    const walletMap    = new Map(wallets.map((w)  => [w.customer_id, w]));
    const advanceMap   = new Map(advances.map((a) => [a.customer_id, a]));
    const customerIds  = new Set([
      ...walletMap.keys(),
      ...advanceMap.keys(),
      ...creditNotes.map((cn) => cn.customer_id),
    ]);

    // Aggregate credit notes per customer
    const cnMap = new Map<string, { count: number; total: number; currency: string | null }>();
    for (const cn of creditNotes) {
      const existing = cnMap.get(cn.customer_id);
      const amount = Number(cn.remaining_balance);
      cnMap.set(cn.customer_id, {
        count:    (existing?.count ?? 0) + 1,
        total:    (existing?.total ?? 0) + amount,
        currency: existing?.currency ?? cn.currency_code,
      });
    }

    if (customerIds.size === 0) {
      return { success: true, data: [] };
    }

    // Fetch customer names
    const customers = await withTenantContext(tenantId, () =>
      prisma.org_customers_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          id:            { in: [...customerIds] },
        },
        select: { id: true, first_name: true, last_name: true },
      })
    );

    const customerNameMap = new Map(
      customers.map((c) => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()])
    );

    const rows: StoredValueSummaryRow[] = [...customerIds].map((cid) => {
      const wallet  = walletMap.get(cid);
      const advance = advanceMap.get(cid);
      const cn      = cnMap.get(cid);
      return {
        customerId:         cid,
        customerName:       customerNameMap.get(cid) ?? cid,
        walletBalance:      wallet  ? Number(wallet.balance)  : 0,
        walletCurrency:     wallet?.currency_code ?? null,
        advanceBalance:     advance ? Number(advance.balance) : 0,
        advanceCurrency:    advance?.currency_code ?? null,
        creditNoteCount:    cn?.count ?? 0,
        creditNoteTotal:    cn?.total ?? 0,
        creditNoteCurrency: cn?.currency ?? null,
      };
    });

    // Only include customers with any positive balance
    const nonZero = rows.filter(
      (r) => r.walletBalance > 0 || r.advanceBalance > 0 || r.creditNoteCount > 0
    );

    return { success: true, data: nonZero };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load stored value summaries',
    };
  }
}

/**
 * Top up a customer's wallet. Creates the wallet if it does not yet exist.
 * @param customerId
 * @param amount
 * @param notes
 */
export async function topUpWallet(
  customerId: string,
  amount: number,
  notes?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    await prisma.$transaction((tx) =>
      topUpWalletTx(tx, {
        tenantId:    auth.tenantId,
        customerId,
        amount,
        notes,
        performedBy: auth.userId,
      })
    );
    revalidatePath('/dashboard/customers/stored-value');
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to top up wallet',
    };
  }
}

/**
 * Issue / top up a customer advance balance.
 * @param customerId
 * @param amount
 * @param notes
 */
export async function issueAdvance(
  customerId: string,
  amount: number,
  notes?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    await prisma.$transaction((tx) =>
      issueAdvanceTx(tx, {
        tenantId:    auth.tenantId,
        customerId,
        amount,
        notes,
        performedBy: auth.userId,
      })
    );
    revalidatePath('/dashboard/customers/stored-value');
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue advance',
    };
  }
}

/**
 * Issue a new credit note for a customer.
 * @param customerId
 * @param amount
 * @param reason
 * @param currencyCode
 */
export async function issueCreditNoteAction(
  customerId: string,
  amount: number,
  reason: string,
  currencyCode: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    await issueCreditNote(auth.tenantId, {
      customerId,
      amount,
      reason,
      currencyCode,
      issuedBy: auth.userId,
    });
    revalidatePath('/dashboard/customers/stored-value');
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue credit note',
    };
  }
}

/**
 * Fetch stored value detail for a single customer.
 * @param customerId
 */
export async function getCustomerStoredValueDetail(customerId: string): Promise<{
  success: true;
  data: {
    wallet:      { walletId: string | null; balance: number; currencyCode: string | null };
    advance:     { advanceId: string | null; balance: number; currencyCode: string | null };
    creditNotes: {
      id: string; credit_note_no: string; original_amount: number;
      remaining_balance: number; currency_code: string;
      status: string; expires_at: Date | null; reason: string;
    }[];
  };
} | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    const tenantId = auth.tenantId;

    const [wallet, advance, creditNotes] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_customer_wallets_mst.findFirst({
          where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_customer_advances_mst.findFirst({
          where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_credit_notes_mst.findMany({
          where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
          orderBy: { issued_at: 'desc' },
        })
      ),
    ]);

    return {
      success: true,
      data: {
        wallet: {
          walletId:     wallet?.id ?? null,
          balance:      wallet ? Number(wallet.balance) : 0,
          currencyCode: wallet?.currency_code ?? null,
        },
        advance: {
          advanceId:    advance?.id ?? null,
          balance:      advance ? Number(advance.balance) : 0,
          currencyCode: advance?.currency_code ?? null,
        },
        creditNotes: creditNotes.map((cn) => ({
          id:                cn.id,
          credit_note_no:    cn.credit_note_no,
          original_amount:   Number(cn.original_amount),
          remaining_balance: Number(cn.remaining_balance),
          currency_code:     cn.currency_code,
          status:            cn.status,
          expires_at:        cn.expires_at ?? null,
          reason:            cn.reason,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load stored value',
    };
  }
}
