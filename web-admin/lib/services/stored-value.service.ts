import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  STORED_VALUE_TXN_TYPES,
  CREDIT_NOTE_STATUSES,
} from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

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

export async function topUpWalletTx(
  tx: PrismaTransactionClient,
  params: { tenantId: string; customerId: string; amount: number; orderId?: string; notes?: string; performedBy?: string; currencyCode?: string }
) {
  const { tenantId, customerId, amount, orderId, notes, performedBy, currencyCode = 'OMR' } = params;

  let wallet = await tx.org_customer_wallets_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
  });

  if (!wallet) {
    wallet = await tx.org_customer_wallets_mst.create({
      data: {
        tenant_org_id: tenantId,
        customer_id:   customerId,
        balance:       0,
        currency_code: currencyCode,
        is_active:     true,
        rec_status:    1,
      },
    });
  }

  const balanceBefore = toNumber(wallet.balance);

  const updated = await tx.org_customer_wallets_mst.update({
    where: { id: wallet.id },
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
      rec_status:     1,
    },
  });
}

export async function redeemWalletTx(
  tx: PrismaTransactionClient,
  params: { tenantId: string; customerId: string; amount: number; orderId: string; idempotencyKey?: string }
) {
  const { tenantId, customerId, amount, orderId, idempotencyKey } = params;

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
    where: { id: wallet[0].id },
    data:  { balance: { decrement: amount }, updated_at: new Date() },
  });

  return tx.org_wallet_txn_dtl.create({
    data: {
      tenant_org_id:   tenantId,
      wallet_id:       wallet[0].id,
      customer_id:     customerId,
      txn_type:        STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:          -amount,
      currency_code:   wallet[0].currency_code,
      balance_before:  balanceBefore,
      balance_after:   balanceAfter,
      order_id:        orderId,
      idempotency_key: idempotencyKey ?? null,
      rec_status:      1,
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
  params: { tenantId: string; customerId: string; amount: number; notes?: string; performedBy?: string; currencyCode?: string }
) {
  const { tenantId, customerId, amount, notes, performedBy, currencyCode = 'OMR' } = params;

  let advance = await tx.org_customer_advances_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
  });

  if (!advance) {
    advance = await tx.org_customer_advances_mst.create({
      data: {
        tenant_org_id: tenantId,
        customer_id:   customerId,
        balance:       0,
        currency_code: currencyCode,
        is_active:     true,
        rec_status:    1,
      },
    });
  }

  const balanceBefore = toNumber(advance.balance);
  const updated = await tx.org_customer_advances_mst.update({
    where: { id: advance.id },
    data:  { balance: { increment: amount }, updated_at: new Date() },
  });
  const balanceAfter = toNumber(updated.balance);

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
      rec_status:     1,
    },
  });
}

export async function redeemAdvanceTx(
  tx: PrismaTransactionClient,
  params: { tenantId: string; customerId: string; amount: number; orderId: string }
) {
  const { tenantId, customerId, amount, orderId } = params;

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
    where: { id: rows[0].id },
    data:  { balance: { decrement: amount }, updated_at: new Date() },
  });

  return tx.org_advance_txn_dtl.create({
    data: {
      tenant_org_id:  tenantId,
      advance_id:     rows[0].id,
      customer_id:    customerId,
      txn_type:       STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:         -amount,
      currency_code:  rows[0].currency_code,
      balance_before: balanceBefore,
      balance_after:  balanceAfter,
      order_id:       orderId,
      rec_status:     1,
    },
  });
}

// ── Credit Note ───────────────────────────────────────────────────────────────

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

  const count = await withTenantContext(tenantId, () =>
    prisma.org_credit_notes_mst.count({ where: { tenant_org_id: tenantId } })
  );
  const creditNoteNo = `CN-${tenantId.slice(0, 8).toUpperCase()}-${String(count + 1).padStart(5, '0')}`;

  return withTenantContext(tenantId, () =>
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
}

export async function redeemCreditNoteTx(
  tx: PrismaTransactionClient,
  params: { tenantId: string; customerId: string; creditNoteId: string; amount: number; orderId: string }
) {
  const { tenantId, creditNoteId, amount, orderId, customerId } = params;

  const rows = await tx.$queryRaw<{ id: string; remaining_balance: number; currency_code: string }[]>`
    SELECT id, remaining_balance::float8, currency_code FROM org_credit_notes_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND id            = ${creditNoteId}::uuid
      AND customer_id   = ${customerId}::uuid
      AND status        = 'ACTIVE'
    FOR UPDATE`;

  if (!rows[0]) throw new Error('Credit note not found or not active');
  if (rows[0].remaining_balance < amount) throw new Error('Insufficient credit note balance');

  const balanceBefore = rows[0].remaining_balance;
  const newBalance    = balanceBefore - amount;

  await tx.org_credit_notes_mst.update({
    where: { id: creditNoteId },
    data: {
      remaining_balance: newBalance,
      status:            newBalance <= 0 ? CREDIT_NOTE_STATUSES.EXHAUSTED : CREDIT_NOTE_STATUSES.ACTIVE,
      updated_at:        new Date(),
    },
  });

  return tx.org_credit_note_txn_dtl.create({
    data: {
      tenant_org_id:  tenantId,
      credit_note_id: creditNoteId,
      customer_id:    customerId,
      txn_type:       STORED_VALUE_TXN_TYPES.REDEMPTION,
      amount:         -amount,
      currency_code:  rows[0].currency_code,
      balance_before: balanceBefore,
      balance_after:  newBalance,
      order_id:       orderId,
      rec_status:     1,
    },
  });
}

export async function getCreditNotes(tenantId: string, customerId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_credit_notes_mst.findMany({
      where: { tenant_org_id: tenantId, customer_id: customerId, status: CREDIT_NOTE_STATUSES.ACTIVE },
      orderBy: { created_at: 'desc' },
    })
  );
}

export async function getStoredValueSummary(tenantId: string, customerId: string) {
  const [wallet, advance, creditNotes] = await Promise.all([
    getWalletBalance(tenantId, customerId),
    getAdvanceBalance(tenantId, customerId),
    getCreditNotes(tenantId, customerId),
  ]);

  const creditNoteTotal = creditNotes.reduce((sum, cn) => sum + toNumber(cn.remaining_balance), 0);

  return { wallet, advance, creditNoteTotal, creditNotes };
}
