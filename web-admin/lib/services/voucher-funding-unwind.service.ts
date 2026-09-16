import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { LINE_ROLE, normalizeVoucherLineRole } from '@/lib/constants/voucher';
import {
  CREDIT_NOTE_STATUSES,
  STORED_VALUE_TXN_TYPES,
  SV_FUNDING_TENDER_STATUS,
} from '@/lib/constants/order-financial';
import { GIFT_CARD_STATUS, GIFT_CARD_TXN_TYPE } from '@/lib/constants/gift-card';

/** Prisma interactive-transaction client shared with voucher reverse. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const MONEY_EPSILON = 0.001;

const FUNDING_ROLES = new Set<string>([
  LINE_ROLE.WALLET_TOPUP,
  LINE_ROLE.GIFT_CARD_SALE,
  LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
  LINE_ROLE.CUSTOMER_CREDIT_ISSUE,
]);

/**
 * True when reversing this original line must claw back a stored-value credit
 * that B3 funding (or a customer-credit issue) wrote.
 */
export function isStoredValueFundingRole(lineRole: string): boolean {
  return FUNDING_ROLES.has(normalizeVoucherLineRole(lineRole));
}

/**
 * Claw back wallet / gift-card / advance / issued credit-note funding for one
 * original voucher line. The clawback ledger row is keyed to the reversal
 * line so it does not collide with the unique original-line backlink.
 */
export async function unwindStoredValueFundingLine(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    originalLineRole: string;
    reversalVoucherId: string;
    reversalLineId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const role = normalizeVoucherLineRole(params.originalLineRole);
  switch (role) {
    case LINE_ROLE.WALLET_TOPUP:
      await unwindWalletTopUp(tx, params);
      break;
    case LINE_ROLE.GIFT_CARD_SALE:
      await unwindGiftCardSale(tx, params);
      break;
    case LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT:
      await unwindAdvanceReceipt(tx, params);
      break;
    case LINE_ROLE.CUSTOMER_CREDIT_ISSUE:
      await unwindCustomerCreditIssue(tx, params);
      break;
    default:
      return;
  }

  await tx.org_sv_funding_tenders_dtl.updateMany({
    where: {
      tenant_org_id: params.tenantOrgId,
      fin_voucher_trx_line_id: params.originalLineId,
      status: SV_FUNDING_TENDER_STATUS.COMPLETED,
    },
    data: {
      status: SV_FUNDING_TENDER_STATUS.REVERSED,
      updated_at: new Date(),
      updated_by: params.userId,
    },
  });
}

async function unwindWalletTopUp(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reversalLineId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const idempotencyKey = `voucher_unwind:${params.reversalVoucherId}:${params.originalLineId}`;
  const existing = await tx.org_wallet_txn_dtl.findFirst({
    where: { tenant_org_id: params.tenantOrgId, idempotency_key: idempotencyKey },
    select: { id: true },
  });
  if (existing) return;

  const original = await tx.org_wallet_txn_dtl.findFirst({
    where: {
      tenant_org_id: params.tenantOrgId,
      fin_voucher_trx_line_id: params.originalLineId,
    },
    select: {
      wallet_id: true,
      customer_id: true,
      amount: true,
      currency_code: true,
      order_id: true,
    },
  });
  if (!original) {
    throw new Error('VOUCHER_UNWIND_WALLET_TXN_NOT_FOUND');
  }

  const amount = Number(original.amount ?? 0);
  const rows = await tx.$queryRaw<{ id: string; balance: number; currency_code: string }[]>`
    SELECT id, balance::float8, currency_code
    FROM org_customer_wallets_mst
    WHERE tenant_org_id = ${params.tenantOrgId}::uuid
      AND id = ${original.wallet_id}::uuid
      AND is_active = true
    FOR UPDATE`;
  if (!rows[0]) throw new Error('VOUCHER_UNWIND_WALLET_NOT_FOUND');
  if (rows[0].balance + MONEY_EPSILON < amount) {
    throw new Error('VOUCHER_UNWIND_WALLET_INSUFFICIENT');
  }

  const balanceBefore = rows[0].balance;
  const balanceAfter = balanceBefore - amount;
  await tx.org_customer_wallets_mst.update({
    where: { id: rows[0].id },
    data: { balance: { decrement: amount }, updated_at: new Date() },
  });
  await tx.org_wallet_txn_dtl.create({
    data: {
      tenant_org_id: params.tenantOrgId,
      wallet_id: rows[0].id,
      customer_id: original.customer_id,
      txn_type: STORED_VALUE_TXN_TYPES.REFUND,
      amount: -amount,
      currency_code: rows[0].currency_code,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      order_id: original.order_id,
      notes: `Voucher reverse: ${params.reason}`.slice(0, 500),
      performed_by: params.userId,
      idempotency_key: idempotencyKey,
      fin_voucher_id: params.reversalVoucherId,
      fin_voucher_trx_line_id: params.reversalLineId,
      rec_status: 1,
    },
  });
}

async function unwindGiftCardSale(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reversalLineId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const original = await tx.org_gift_card_txn_dtl.findFirst({
    where: {
      tenant_org_id: params.tenantOrgId,
      fin_voucher_trx_line_id: params.originalLineId,
    },
    select: { gift_card_id: true, amount: true },
  });
  if (!original) {
    throw new Error('VOUCHER_UNWIND_GIFT_CARD_TXN_NOT_FOUND');
  }

  const card = await tx.org_gift_cards_mst.findFirst({
    where: { id: original.gift_card_id, tenant_org_id: params.tenantOrgId },
    select: {
      id: true,
      status: true,
      available_amount: true,
      original_amount: true,
    },
  });
  if (!card) throw new Error('VOUCHER_UNWIND_GIFT_CARD_NOT_FOUND');
  if (card.status === GIFT_CARD_STATUS.VOIDED) return;

  const idempotencyKey = `voucher_unwind:${params.reversalVoucherId}:${params.originalLineId}`;
  const existingVoid = await tx.org_gift_card_txn_dtl.findFirst({
    where: { tenant_org_id: params.tenantOrgId, idempotency_key: idempotencyKey },
    select: { id: true },
  });
  if (existingVoid) return;

  const available = Number(card.available_amount ?? 0);
  const originalAmount = Number(card.original_amount ?? original.amount ?? 0);
  if (available + MONEY_EPSILON < originalAmount) {
    throw new Error('VOUCHER_UNWIND_GIFT_CARD_ALREADY_USED');
  }

  await tx.org_gift_cards_mst.update({
    where: { id: card.id },
    data: {
      status: GIFT_CARD_STATUS.VOIDED,
      is_active: false,
      rec_notes: `Voided by voucher reverse: ${params.reason}`.slice(0, 500),
      updated_at: new Date(),
      updated_by: params.userId,
    },
  });
  await tx.org_gift_card_txn_dtl.create({
    data: {
      tenant_org_id: params.tenantOrgId,
      gift_card_id: card.id,
      transaction_type: GIFT_CARD_TXN_TYPE.VOID,
      amount: available,
      balance_before: available,
      balance_after: 0,
      transaction_date: new Date(),
      processed_by: params.userId,
      notes: `Voucher reverse: ${params.reason}`.slice(0, 500),
      idempotency_key: idempotencyKey,
      fin_voucher_id: params.reversalVoucherId,
      fin_voucher_trx_line_id: params.reversalLineId,
    },
  });
}

async function unwindAdvanceReceipt(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reversalLineId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const idempotencyKey = `voucher_unwind:${params.reversalVoucherId}:${params.originalLineId}`;
  const existing = await tx.org_advance_txn_dtl.findFirst({
    where: { tenant_org_id: params.tenantOrgId, idempotency_key: idempotencyKey },
    select: { id: true },
  });
  if (existing) return;

  const original = await tx.org_advance_txn_dtl.findFirst({
    where: {
      tenant_org_id: params.tenantOrgId,
      fin_voucher_trx_line_id: params.originalLineId,
    },
    select: {
      advance_id: true,
      customer_id: true,
      amount: true,
      order_id: true,
    },
  });
  if (!original) {
    throw new Error('VOUCHER_UNWIND_ADVANCE_TXN_NOT_FOUND');
  }

  const amount = Number(original.amount ?? 0);
  const rows = await tx.$queryRaw<{ id: string; balance: number; currency_code: string }[]>`
    SELECT id, balance::float8, currency_code
    FROM org_customer_advances_mst
    WHERE tenant_org_id = ${params.tenantOrgId}::uuid
      AND id = ${original.advance_id}::uuid
      AND is_active = true
    FOR UPDATE`;
  if (!rows[0]) throw new Error('VOUCHER_UNWIND_ADVANCE_NOT_FOUND');
  if (rows[0].balance + MONEY_EPSILON < amount) {
    throw new Error('VOUCHER_UNWIND_ADVANCE_INSUFFICIENT');
  }

  const balanceBefore = rows[0].balance;
  const balanceAfter = balanceBefore - amount;
  await tx.org_customer_advances_mst.update({
    where: { id: rows[0].id },
    data: { balance: { decrement: amount }, updated_at: new Date() },
  });
  await tx.org_advance_txn_dtl.create({
    data: {
      tenant_org_id: params.tenantOrgId,
      advance_id: rows[0].id,
      customer_id: original.customer_id,
      txn_type: STORED_VALUE_TXN_TYPES.REFUND,
      amount: -amount,
      currency_code: rows[0].currency_code,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      order_id: original.order_id,
      idempotency_key: idempotencyKey,
      fin_voucher_id: params.reversalVoucherId,
      fin_voucher_trx_line_id: params.reversalLineId,
      rec_status: 1,
    },
  });
}

async function unwindCustomerCreditIssue(
  tx: PrismaTransactionClient,
  params: {
    tenantOrgId: string;
    originalLineId: string;
    reversalVoucherId: string;
    reversalLineId: string;
    reason: string;
    userId: string;
  },
): Promise<void> {
  const original = await tx.org_credit_note_txn_dtl.findFirst({
    where: {
      tenant_org_id: params.tenantOrgId,
      fin_voucher_trx_line_id: params.originalLineId,
    },
    select: { credit_note_id: true, amount: true },
  });
  if (!original) {
    throw new Error('VOUCHER_UNWIND_CREDIT_NOTE_TXN_NOT_FOUND');
  }

  const note = await tx.org_credit_notes_mst.findFirst({
    where: { id: original.credit_note_id, tenant_org_id: params.tenantOrgId },
    select: {
      id: true,
      status: true,
      remaining_balance: true,
      original_amount: true,
    },
  });
  if (!note) throw new Error('VOUCHER_UNWIND_CREDIT_NOTE_NOT_FOUND');
  if (
    note.status === CREDIT_NOTE_STATUSES.CANCELLED
    || note.status === CREDIT_NOTE_STATUSES.EXPIRED
  ) {
    return;
  }

  const remaining = Number(note.remaining_balance ?? 0);
  const issued = Number(note.original_amount ?? original.amount ?? 0);
  if (remaining + MONEY_EPSILON < issued) {
    throw new Error('VOUCHER_UNWIND_CREDIT_NOTE_ALREADY_USED');
  }

  await tx.org_credit_notes_mst.update({
    where: { id: note.id },
    data: {
      status: CREDIT_NOTE_STATUSES.CANCELLED,
      remaining_balance: 0,
      updated_at: new Date(),
      updated_by: params.userId,
    },
  });
}
