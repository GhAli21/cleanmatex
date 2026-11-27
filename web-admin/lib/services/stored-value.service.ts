/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  STORED_VALUE_TXN_TYPES,
  CREDIT_NOTE_STATUSES,
} from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';
import { assertCurrencyMatch, requireCurrencyCode } from '@/lib/money/currency-resolution';
import { logger } from '@/lib/utils/logger';
import { STORE_CREDIT_NOTE_NO_NOT_ASSIGNED } from '@/lib/constants/doc-seq';
import { emitNotificationEvent } from '@/lib/notifications/event-emitter';
import { buildCreditNoteIssuedNotificationVariables } from '@/lib/notifications/credit-note-variables';
import {
  getLoyaltyAccount,
  getLoyaltyConfig,
  syncAvailableLoyaltyPoints,
} from '@/lib/services/loyalty.service';
import { recordAdvanceReceiptTaxTx } from '@/lib/services/tax/prepaid-tax.service';
import { operationalCivilToday } from '@/lib/utils/operational-zone.server';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletBalance {
  walletId:     string | null;
  balance:      number;
  currencyCode: string | null;
}

export async function getWalletBalance(
  tenantId: string,
  customerId: string
): Promise<WalletBalance> {
  const wallet = await withTenantContext(tenantId, () =>
    prisma.org_customer_wallets_mst.findFirst({
      where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
    })
  );
  return {
    walletId:     wallet?.id ?? null,
    balance:      toNumber(wallet?.balance),
    currencyCode: wallet?.currency_code ?? null,
  };
}

/**
 * Credit a customer wallet inside an existing Prisma transaction.
 *
 * B01 (§12) contract: `idempotencyKey` enables skip-on-existing — if this key
 * already produced a ledger row, the cached row is returned without crediting
 * the balance again (refund destination key: `refund-${refundId}-wallet`).
 */
export async function topUpWalletTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    amount: number;
    orderId?: string;
    notes?: string;
    performedBy?: string;
    currencyCode?: string;
    idempotencyKey?: string;
    /** B3: BVM voucher backlink for a governed DIRECT_TENDER top-up (see stored-value-funding.service.ts). */
    voucherId?: string;
    voucherLineId?: string;
  }
) {
  const { tenantId, customerId, amount, orderId, notes, performedBy, currencyCode, idempotencyKey, voucherId, voucherLineId } = params;

  if (idempotencyKey) {
    const existing = await tx.org_wallet_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

  let wallet = await tx.org_customer_wallets_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
  });

  // B15: the wallet row's currency governs every ledger write; a new wallet
  // must be created with an explicitly resolved currency (never a default).
  if (wallet?.currency_code) {
    assertCurrencyMatch(wallet.currency_code, currencyCode, `topUpWalletTx wallet ${wallet.id}`);
  }

  if (!wallet) {
    wallet = await tx.org_customer_wallets_mst.create({
      data: {
        tenant_org_id: tenantId,
        customer_id:   customerId,
        balance:       0,
        currency_code: requireCurrencyCode(currencyCode, `topUpWalletTx: new wallet for customer ${customerId}`),
        is_active:     true,
        rec_status:    1,
      },
    });
  }

  const balanceBefore = toNumber(wallet.balance);

  const updated = await tx.org_customer_wallets_mst.update({
    where: { id: wallet.id, tenant_org_id: tenantId },
    data:  { balance: { increment: amount }, updated_at: new Date() },
  });

  const balanceAfter = toNumber(updated.balance);

  return tx.org_wallet_txn_dtl.create({
    data: {
      tenant_org_id:  tenantId,
      wallet_id:      wallet.id,
      customer_id:    customerId,
      txn_type:       STORED_VALUE_TXN_TYPES.TOP_UP,
      amount,
      currency_code:  wallet.currency_code,
      balance_before: balanceBefore,
      balance_after:  balanceAfter,
      order_id:       orderId ?? null,
      notes:          notes ?? null,
      performed_by:   performedBy ?? null,
      idempotency_key: idempotencyKey ?? null,
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      rec_status:     1,
    },
  });
}

/**
 * Debit wallet balance inside an existing Prisma transaction.
 *
 * Phase 2 BVM Wiring contract:
 *  - `idempotencyKey` enables skip-on-existing (returns the cached ledger row
 *    without re-debiting the balance).
 *  - `voucherId` / `voucherLineId` are persisted onto the ledger row so the
 *    voucher → ledger backlink is queryable (FK from migration 0329).
 *
 * Uses SELECT … FOR UPDATE inside the caller's tx to prevent concurrent
 * double-debit.
 */
export async function redeemWalletTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    amount: number;
    orderId: string;
    idempotencyKey?: string;
    voucherId?: string;
    voucherLineId?: string;
  }
) {
  const { tenantId, customerId, amount, orderId, idempotencyKey, voucherId, voucherLineId } = params;

  // Phase 2: idempotency-skip. If this key already produced a ledger row,
  // return it instead of double-debiting the balance.
  if (idempotencyKey) {
    const existing = await tx.org_wallet_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

  // SELECT FOR UPDATE
  const wallet = await tx.$queryRaw<{ id: string; balance: number; currency_code: string }[]>`
    SELECT id, balance::float8, currency_code
    FROM org_customer_wallets_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND is_active     = true
    FOR UPDATE`;

  if (!wallet[0]) throw new Error('Wallet not found');
  if (wallet[0].balance < amount) throw new Error('Insufficient wallet balance');

  const balanceBefore = wallet[0].balance;
  const balanceAfter  = balanceBefore - amount;

  await tx.org_customer_wallets_mst.update({
    where: { id: wallet[0].id, tenant_org_id: tenantId },
    data:  { balance: { decrement: amount }, updated_at: new Date() },
  });

  return tx.org_wallet_txn_dtl.create({
    data: {
      tenant_org_id:            tenantId,
      wallet_id:                wallet[0].id,
      customer_id:              customerId,
      txn_type:                 STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:                   -amount,
      currency_code:            wallet[0].currency_code,
      balance_before:           balanceBefore,
      balance_after:            balanceAfter,
      order_id:                 orderId,
      idempotency_key:          idempotencyKey ?? null,
      fin_voucher_id:           voucherId ?? null,
      fin_voucher_trx_line_id:  voucherLineId ?? null,
      rec_status:               1,
    },
  });
}

// ── Advance ───────────────────────────────────────────────────────────────────

export interface AdvanceBalance {
  advanceId:    string | null;
  balance:      number;
  currencyCode: string | null;
}

export async function getAdvanceBalance(
  tenantId: string,
  customerId: string
): Promise<AdvanceBalance> {
  const advance = await withTenantContext(tenantId, () =>
    prisma.org_customer_advances_mst.findFirst({
      where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
    })
  );
  return {
    advanceId:    advance?.id ?? null,
    balance:      toNumber(advance?.balance),
    currencyCode: advance?.currency_code ?? null,
  };
}

export async function issueAdvanceTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    amount: number;
    notes?: string;
    performedBy?: string;
    currencyCode?: string;
    /** B3: idempotency-skip (org_advance_txn_dtl already has the unique constraint) + BVM voucher backlink for a governed DIRECT_TENDER receipt. */
    idempotencyKey?: string;
    voucherId?: string;
    voucherLineId?: string;
    /**
     * T6: the receipt voucher (and line) that took this money. Set only when real money was
     * received; its advance tax is recorded where the kit taxes advances. Restores and
     * goodwill issues leave it unset.
     */
    taxVoucher?: { voucherId: string; voucherLineId: string | null } | null;
  }
) {
  const { tenantId, customerId, amount, notes, performedBy, currencyCode, idempotencyKey, voucherId, voucherLineId, taxVoucher } = params;

  if (idempotencyKey) {
    const existing = await tx.org_advance_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

  let advance = await tx.org_customer_advances_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
  });

  // B15: the advance row's currency governs every ledger write; a new advance
  // must be created with an explicitly resolved currency (never a default).
  if (advance?.currency_code) {
    assertCurrencyMatch(advance.currency_code, currencyCode, `issueAdvanceTx advance ${advance.id}`);
  }

  if (!advance) {
    advance = await tx.org_customer_advances_mst.create({
      data: {
        tenant_org_id: tenantId,
        customer_id:   customerId,
        balance:       0,
        currency_code: requireCurrencyCode(currencyCode, `issueAdvanceTx: new advance for customer ${customerId}`),
        is_active:     true,
        rec_status:    1,
      },
    });
  }

  const balanceBefore = toNumber(advance.balance);
  const updated = await tx.org_customer_advances_mst.update({
    where: { tenant_org_id: tenantId, id: advance.id },
    data:  { balance: { increment: amount }, updated_at: new Date() },
  });
  const balanceAfter = toNumber(updated.balance);

  if (taxVoucher) {
    await recordAdvanceReceiptTaxTx(tx, {
      tenantOrgId: tenantId, customerId, amount, currencyCode: advance.currency_code,
      voucherId: taxVoucher.voucherId, voucherLineId: taxVoucher.voucherLineId, userId: performedBy ?? null,
    });
  }

  return tx.org_advance_txn_dtl.create({
    data: {
      tenant_org_id:  tenantId,
      advance_id:     advance.id,
      customer_id:    customerId,
      txn_type:       STORED_VALUE_TXN_TYPES.ISSUE,
      amount,
      currency_code:  advance.currency_code,
      balance_before: balanceBefore,
      balance_after:  balanceAfter,
      notes:          notes ?? null,
      created_by:     performedBy ?? null,
      idempotency_key:         idempotencyKey ?? null,
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      rec_status:     1,
    },
  });
}

/**
 * Debit customer-advance balance inside an existing Prisma transaction.
 *
 * Phase 2 BVM Wiring contract:
 *  - `idempotencyKey` enables skip-on-existing.
 *  - `voucherId` / `voucherLineId` persist the voucher → ledger backlink
 *    (FK from migration 0329).
 */
export async function redeemAdvanceTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    amount: number;
    orderId: string;
    idempotencyKey?: string;
    voucherId?: string;
    voucherLineId?: string;
  }
) {
  const { tenantId, customerId, amount, orderId, idempotencyKey, voucherId, voucherLineId } = params;

  if (idempotencyKey) {
    const existing = await tx.org_advance_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

  const rows = await tx.$queryRaw<{ id: string; balance: number; currency_code: string }[]>`
    SELECT id, balance::float8, currency_code
    FROM org_customer_advances_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND is_active     = true
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Advance account not found');
  if (rows[0].balance < amount) throw new Error('Insufficient advance balance');

  const balanceBefore = rows[0].balance;
  const balanceAfter  = balanceBefore - amount;

  await tx.org_customer_advances_mst.update({
    where: { id: rows[0].id, tenant_org_id: tenantId },
    data:  { balance: { decrement: amount }, updated_at: new Date() },
  });

  return tx.org_advance_txn_dtl.create({
    data: {
      tenant_org_id:           tenantId,
      advance_id:              rows[0].id,
      customer_id:             customerId,
      txn_type:                STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:                  -amount,
      currency_code:           rows[0].currency_code,
      balance_before:          balanceBefore,
      balance_after:           balanceAfter,
      order_id:                orderId,
      idempotency_key:         idempotencyKey ?? null,
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      rec_status:              1,
    },
  });
}

// ── Credit Note ───────────────────────────────────────────────────────────────


/**
 * Fire-and-forget credit_note.issued notification (FOLLOWUPS #11 / A-74).
 * Never throws. Skips when the note has no number or no recipient (issuedBy).
 * Idempotent at the hub via sourceEntityId = credit note id.
 */
async function emitCreditNoteIssuedNotification(params: {
  tenantId: string;
  creditNote: { id: string; credit_note_no: string | null; customer_id: string; related_order_id?: string | null };
  amount: number;
  currencyCode: string;
  issuedBy?: string | null;
}): Promise<void> {
  const { tenantId, creditNote, amount, currencyCode, issuedBy } = params;
  const no = (creditNote.credit_note_no ?? '').trim();
  if (!no) return;
  const recipientUserIds = issuedBy && issuedBy.trim() ? [issuedBy.trim()] : [];
  if (recipientUserIds.length === 0) {
    logger.warn('credit_note.issued skipped — no issuedBy recipient', {
      feature: 'stored-value',
      tenantId,
      creditNoteId: creditNote.id,
    });
    return;
  }
  let variables: Record<string, string>;
  try {
    variables = buildCreditNoteIssuedNotificationVariables({
      creditNoteNo: no,
      amount,
      currencyCode,
    });
  } catch (err) {
    logger.warn('credit_note.issued variables build failed', {
      feature: 'stored-value',
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  await emitNotificationEvent({
    code: 'credit_note.issued',
    tenantOrgId: tenantId,
    recipientUserIds,
    sourceEntityType: 'credit_note',
    sourceEntityId: creditNote.id,
    variables,
    actionUrl: creditNote.related_order_id
      ? `/dashboard/orders/${creditNote.related_order_id}`
      : undefined,
    actionLabel: 'View',
    actionLabel2: 'عرض',
  });
}
/**
 * credit_note_no to send on INSERT (FOLLOWUPS #6 / A-50): always '' so
 * trg_fin_cn_no_assign assigns SCN-YYYY-NNNNNN (migration 0687). LEGACY removed.
 * @returns empty string for the INSERT
 */
export async function creditNoteNoForInsert(): Promise<string> {
  return '';
}

/**
 * Stops the issue (and rolls its transaction back) when the DB returned no number,
 * so a credit note is never issued without one (no-silent-money-mutation).
 * @param creditNoteNo credit_note_no returned by the INSERT
 * @returns the number
 */
export function assertCreditNoteNoAssigned(creditNoteNo: string | null | undefined): string {
  if (!creditNoteNo || creditNoteNo.trim() === '') {
    throw new Error(
      `${STORE_CREDIT_NOTE_NO_NOT_ASSIGNED}: the database did not assign a credit note number (is migration 0687_fin_store_credit_note_scn applied?)`
    );
  }
  return creditNoteNo;
}

export async function issueCreditNoteTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    amount: number;
    reason: string;
    orderId?: string;
    expiresAt?: Date;
    issuedBy?: string;
    currencyCode: string;
    idempotencyKey?: string;
  }
) {
  const {
    tenantId,
    customerId,
    amount,
    reason,
    orderId,
    expiresAt,
    issuedBy,
    currencyCode,
    idempotencyKey,
  } = params;

  if (idempotencyKey) {
    const existingTxn = await tx.org_credit_note_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existingTxn) {
      const existingNote = await tx.org_credit_notes_mst.findFirst({
        where: { id: existingTxn.credit_note_id, tenant_org_id: tenantId },
      });
      if (existingNote) return existingNote;
    }
  }

  const creditNoteNo = await creditNoteNoForInsert();

  const creditNote = await tx.org_credit_notes_mst.create({
    data: {
      tenant_org_id: tenantId,
      customer_id: customerId,
      credit_note_no: creditNoteNo,
      original_amount: amount,
      remaining_balance: amount,
      currency_code: currencyCode,
      status: CREDIT_NOTE_STATUSES.ACTIVE,
      reason,
      related_order_id: orderId ?? null,
      expires_at: expiresAt ?? null,
      issued_by: issuedBy ?? null,
      is_active: true,
      rec_status: 1,
    },
  });
  assertCreditNoteNoAssigned(creditNote.credit_note_no);

  if (idempotencyKey) {
    await tx.org_credit_note_txn_dtl.create({
      data: {
        tenant_org_id: tenantId,
        credit_note_id: creditNote.id,
        customer_id: customerId,
        txn_type: STORED_VALUE_TXN_TYPES.ISSUE,
        amount,
        currency_code: currencyCode,
        balance_before: 0,
        balance_after: amount,
        order_id: orderId ?? null,
        idempotency_key: idempotencyKey,
        rec_status: 1,
      },
    });
  }

  // Fire-and-forget; emitNotificationEvent never throws to the business path.
  await emitCreditNoteIssuedNotification({
    tenantId,
    creditNote,
    amount,
    currencyCode,
    issuedBy,
  });
  return creditNote;
}

export async function issueCreditNote(
  tenantId: string,
  params: {
    customerId:   string;
    amount:       number;
    reason:       string;
    orderId?:     string;
    expiresAt?:   Date;
    issuedBy?:    string;
    currencyCode: string;
  }
) {
  const { customerId, amount, reason, orderId, expiresAt, issuedBy, currencyCode } = params;

  const creditNoteNo = await creditNoteNoForInsert();

  const creditNote = await withTenantContext(tenantId, () =>
    prisma.org_credit_notes_mst.create({
      data: {
        tenant_org_id:    tenantId,
        customer_id:      customerId,
        credit_note_no:   creditNoteNo,
        original_amount:  amount,
        remaining_balance: amount,
        currency_code:    currencyCode,
        status:           CREDIT_NOTE_STATUSES.ACTIVE,
        reason,
        related_order_id: orderId ?? null,
        expires_at:       expiresAt ?? null,
        issued_by:        issuedBy ?? null,
        is_active:        true,
        rec_status:       1,
      },
    })
  );
  assertCreditNoteNoAssigned(creditNote.credit_note_no);
  await emitCreditNoteIssuedNotification({
    tenantId,
    creditNote,
    amount,
    currencyCode,
    issuedBy,
  });
  return creditNote;
}

/**
 * Debit credit-note balance inside an existing Prisma transaction.
 *
 * Phase 2 BVM Wiring contract:
 *  - `idempotencyKey` enables skip-on-existing.
 *  - `voucherId` / `voucherLineId` persist the voucher → ledger backlink.
 */
export async function redeemCreditNoteTx(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    customerId: string;
    creditNoteId: string;
    amount: number;
    orderId: string;
    idempotencyKey?: string;
    voucherId?: string;
    voucherLineId?: string;
  }
) {
  const { tenantId, creditNoteId, amount, orderId, customerId, idempotencyKey, voucherId, voucherLineId } = params;

  if (idempotencyKey) {
    const existing = await tx.org_credit_note_txn_dtl.findFirst({
      where: { tenant_org_id: tenantId, idempotency_key: idempotencyKey },
    });
    if (existing) return existing;
  }

  const rows = await tx.$queryRaw<{ id: string; remaining_balance: number; currency_code: string; is_expired: boolean }[]>`
    SELECT id, remaining_balance::float8, currency_code,
           (expires_at IS NOT NULL AND expires_at < (now() AT TIME ZONE public.fn_ops_zone(${tenantId}::uuid, 'ledger', NULL))::date) AS is_expired
    FROM org_credit_notes_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id            = ${creditNoteId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND status        = 'ACTIVE'
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Credit note not found or not active');
  // Past its date: not spendable, even before the daily expiry marks it (same rule as fn_fin_credit_note_expire_one).
  if (rows[0].is_expired) throw new Error('Credit note has expired');
  if (rows[0].remaining_balance < amount) throw new Error('Insufficient credit note balance');

  const balanceBefore = rows[0].remaining_balance;
  const newBalance    = balanceBefore - amount;

  await tx.org_credit_notes_mst.update({
    where: { id: creditNoteId, tenant_org_id: tenantId },
    data: {
      remaining_balance: newBalance,
      status:            newBalance <= 0 ? CREDIT_NOTE_STATUSES.EXHAUSTED : CREDIT_NOTE_STATUSES.ACTIVE,
      updated_at:        new Date(),
    },
  });

  return tx.org_credit_note_txn_dtl.create({
    data: {
      tenant_org_id:           tenantId,
      credit_note_id:          creditNoteId,
      customer_id:             customerId,
      txn_type:                STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:                  -amount,
      currency_code:           rows[0].currency_code,
      balance_before:          balanceBefore,
      balance_after:           newBalance,
      order_id:                orderId,
      idempotency_key:         idempotencyKey ?? null,
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      rec_status:              1,
    },
  });
}

function civilDateValue(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export async function getCreditNotes(tenantId: string, customerId: string) {
  const today = await operationalCivilToday(tenantId, 'ledger', null);
  return withTenantContext(tenantId, () =>
    prisma.org_credit_notes_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId,
        status: CREDIT_NOTE_STATUSES.ACTIVE,
        // A missing zone does not hide the note. Expiry uses the organization civil day.
        ...(today
          ? { OR: [{ expires_at: null }, { expires_at: { gte: civilDateValue(today) } }] }
          : {}),
      },
      orderBy: { created_at: 'desc' },
    })
  );
}

export async function getStoredValueSummary(tenantId: string, customerId: string) {
  const [wallet, advance, creditNotes, loyaltyAccount, loyaltyConfig] = await Promise.all([
    getWalletBalance(tenantId, customerId),
    getAdvanceBalance(tenantId, customerId),
    getCreditNotes(tenantId, customerId),
    getLoyaltyAccount(tenantId, customerId),
    getLoyaltyConfig(tenantId),
  ]);

  const creditNoteTotal = creditNotes.reduce((sum, cn) => sum + toNumber(cn.remaining_balance), 0);
  const redeemRate = toNumber(loyaltyConfig?.redeem_rate_per_point);
  const spendable = loyaltyAccount
    ? await syncAvailableLoyaltyPoints(
        tenantId,
        loyaltyAccount.id,
        Number(loyaltyAccount.points_balance),
      )
    : { spendablePoints: 0, expiredUnappliedPoints: 0, expiredNow: 0 };

  return {
    wallet,
    advance,
    creditNoteTotal,
    creditNotes,
    loyalty: {
      pointsBalance: spendable.spendablePoints,
      availableValue: spendable.spendablePoints * redeemRate,
      expiredUnappliedPoints: spendable.expiredUnappliedPoints,
      redeemRatePerPoint: redeemRate,
    },
  };
}

/**
 * Expire one credit note through `fn_fin_credit_note_expire_one` (migration 0823), the single
 * copy of credit note expiry: row lock, EXPIRED + zero balance, one EXPIRY ledger row keyed
 * `cn-expiry-${id}` when a balance remained. Idempotent. No GL dispatch (gift-card expiry owns
 * D008/D012). `onlyIfDue` (the daily expiry): a note not yet past its date is left alone
 * (error CREDIT_NOTE_NOT_DUE). Without a ledger zone the daily expiry leaves the note alone
 * (error CREDIT_NOTE_ZONE_MISSING, migration 0846).
 */
export async function expireCreditNote(
  id: string,
  tenantOrgId: string,
  opts: { onlyIfDue?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = await prisma.$queryRaw<{ outcome: string }[]>`
      SELECT public.fn_fin_credit_note_expire_one(
        ${tenantOrgId}::uuid, ${id}::uuid, ${opts.onlyIfDue === true}, 'system/credit-note-expiry'
      ) AS outcome`;
    const outcome = rows[0]?.outcome;
    if (outcome === 'EXPIRED' || outcome === 'ALREADY_EXPIRED') return { success: true };
    return { success: false, error: `CREDIT_NOTE_${outcome ?? 'UNKNOWN'}` };
  } catch (error) {
    logger.error('Error expiring credit note', error as Error, {
      feature: 'stored-value',
      action: 'expire-credit-note',
      tenantOrgId,
      creditNoteId: id,
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Batch-expire ACTIVE credit notes whose expiry date is before the organization
 * civil day. A missing zone expires nothing. One note's failure never blocks the rest.
 */
export async function expireCreditNotes(
  tenantOrgId: string,
): Promise<{ expiredCount: number; failedCount: number }> {
  const today = await operationalCivilToday(tenantOrgId, 'ledger', null);
  if (!today) return { expiredCount: 0, failedCount: 0 };
  return withTenantContext(tenantOrgId, async () => {
    const eligible = await prisma.org_credit_notes_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        status: CREDIT_NOTE_STATUSES.ACTIVE,
        expires_at: { lt: civilDateValue(today) },
      },
      select: { id: true },
    });

    let expiredCount = 0;
    let failedCount = 0;
    for (const note of eligible) {
      const result = await expireCreditNote(note.id, tenantOrgId);
      if (result.success) {
        expiredCount++;
      } else {
        failedCount++;
      }
    }
    return { expiredCount, failedCount };
  });
}
