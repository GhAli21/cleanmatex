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
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { currentTenantCan } from '@/lib/services/feature-flags.service';
import {
  topUpWalletTx,
  issueAdvanceTx,
  issueCreditNote,
} from '@/lib/services/stored-value.service';
import { fundStoredValue, FUNDING_TYPES } from '@/lib/services/stored-value-funding.service';

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
    // B27: this is a back-office adjustment (no payment collected) — was
    // completely ungated before this check.
    const canAdjust = await hasPermissionServer('stored_value:issue_wallet_credit');
    if (!canAdjust) {
      return { success: false, error: 'Insufficient permissions: stored_value:issue_wallet_credit required' };
    }

    const auth = await getAuthContext();
    // B15: resolve the tenant currency for first-wallet creation — the wallet
    // service requires an explicit currency and never defaults.
    const [{ createClient }, { createTenantSettingsService }] = await Promise.all([
      import('@/lib/supabase/server'),
      import('@/lib/services/tenant-settings.service'),
    ]);
    const supabase = await createClient();
    const currencyCode = await createTenantSettingsService(supabase).getTenantCurrency(auth.tenantId);
    await prisma.$transaction((tx) =>
      topUpWalletTx(tx, {
        tenantId:    auth.tenantId,
        customerId,
        amount,
        notes,
        performedBy: auth.userId,
        currencyCode,
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
    // B27: was completely ungated before this check.
    const canIssue = await hasPermissionServer('stored_value:issue_advance');
    if (!canIssue) {
      return { success: false, error: 'Insufficient permissions: stored_value:issue_advance required' };
    }

    const auth = await getAuthContext();
    // B15: resolve the tenant currency for first-advance creation — the
    // service requires an explicit currency and never defaults.
    const [{ createClient }, { createTenantSettingsService }] = await Promise.all([
      import('@/lib/supabase/server'),
      import('@/lib/services/tenant-settings.service'),
    ]);
    const supabase = await createClient();
    const currencyCode = await createTenantSettingsService(supabase).getTenantCurrency(auth.tenantId);
    await prisma.$transaction((tx) =>
      issueAdvanceTx(tx, {
        tenantId:    auth.tenantId,
        customerId,
        amount,
        notes,
        performedBy: auth.userId,
        currencyCode,
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

// B3 — governed DIRECT_TENDER funding payload (tender leg required, unlike
// the no-tender topUpWallet/issueAdvance above).
const withTenderSchema = z.object({
  customerId:            z.string().uuid(),
  amount:                z.number().positive(),
  currencyCode:          z.string().min(1).max(10),
  branchId:              z.string().uuid().optional(),
  paymentMethodId:       z.string().uuid(),
  cashTendered:          z.number().positive().optional(),
  cashDrawerSessionId:   z.string().uuid().optional(),
  posSessionId:          z.string().uuid().optional(),
  idempotencyKey:        z.string().min(1),
});

/**
 * B3 — Top up a customer's wallet through the governed DIRECT_TENDER funding
 * service: requires a real tender leg. Distinct from `topUpWallet` above
 * (the no-tender admin adjustment, gated by `stored_value:issue_wallet_credit`
 * — semantics frozen per B03 Architecture decision §4). Behind feature flag
 * `order_fin_sv_funding_capture`.
 */
export async function topUpWalletWithTenderAction(
  input: z.infer<typeof withTenderSchema>
): Promise<{ success: true; voucherId: string } | { success: false; error: string }> {
  try {
    const flagOn = await currentTenantCan('order_fin_sv_funding_capture');
    if (!flagOn) {
      return { success: false, error: 'FUNDING_CAPTURE_NOT_ENABLED' };
    }

    const canTopUp = await hasPermissionServer('stored_value:top_up_wallet');
    if (!canTopUp) {
      return { success: false, error: 'Insufficient permissions: stored_value:top_up_wallet required' };
    }

    const parsed = withTenderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const data = parsed.data;

    const auth = await getAuthContext();
    const result = await fundStoredValue({
      tenantId: auth.tenantId,
      branchId: data.branchId,
      fundingType: FUNDING_TYPES.WALLET_TOPUP,
      customerId: data.customerId,
      currencyCode: data.currencyCode,
      fundedAmount: data.amount,
      tenderLegs: [
        { paymentMethodId: data.paymentMethodId, amount: data.amount, cashTendered: data.cashTendered },
      ],
      cashDrawerSessionId: data.cashDrawerSessionId,
      posSessionId: data.posSessionId,
      performedBy: auth.userId,
      idempotencyKey: data.idempotencyKey,
    });

    revalidatePath('/dashboard/customers/stored-value');
    revalidatePath(`/dashboard/customers/${data.customerId}`);
    return { success: true, voucherId: result.voucherId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to top up wallet',
    };
  }
}

/**
 * B3 — Issue a customer advance through the governed DIRECT_TENDER funding
 * service: requires a real tender leg. Distinct from `issueAdvance` above
 * (the no-tender admin adjustment). Behind feature flag `order_fin_sv_funding_capture`.
 */
export async function issueAdvanceWithTenderAction(
  input: z.infer<typeof withTenderSchema>
): Promise<{ success: true; voucherId: string } | { success: false; error: string }> {
  try {
    const flagOn = await currentTenantCan('order_fin_sv_funding_capture');
    if (!flagOn) {
      return { success: false, error: 'FUNDING_CAPTURE_NOT_ENABLED' };
    }

    const canIssue = await hasPermissionServer('stored_value:issue_advance');
    if (!canIssue) {
      return { success: false, error: 'Insufficient permissions: stored_value:issue_advance required' };
    }

    const parsed = withTenderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const data = parsed.data;

    const auth = await getAuthContext();
    const result = await fundStoredValue({
      tenantId: auth.tenantId,
      branchId: data.branchId,
      fundingType: FUNDING_TYPES.CUSTOMER_ADVANCE_RECEIPT,
      customerId: data.customerId,
      currencyCode: data.currencyCode,
      fundedAmount: data.amount,
      tenderLegs: [
        { paymentMethodId: data.paymentMethodId, amount: data.amount, cashTendered: data.cashTendered },
      ],
      cashDrawerSessionId: data.cashDrawerSessionId,
      posSessionId: data.posSessionId,
      performedBy: auth.userId,
      idempotencyKey: data.idempotencyKey,
    });

    revalidatePath('/dashboard/customers/stored-value');
    revalidatePath(`/dashboard/customers/${data.customerId}`);
    return { success: true, voucherId: result.voucherId };
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
    // B27: the API route (app/api/v1/customers/[id]/credit-note/issue) already
    // checked stored_value:issue_credit_note, but the UI actually calls this
    // server action, which had no check at all — the same policy now applies
    // to both entry points.
    const canIssue = await hasPermissionServer('stored_value:issue_credit_note');
    if (!canIssue) {
      return { success: false, error: 'Insufficient permissions: stored_value:issue_credit_note required' };
    }

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
