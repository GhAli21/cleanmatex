/**
 * B3 — Stored-Value Funding Capture.
 *
 * Governed DIRECT_TENDER path for gift-card sale, wallet top-up, and
 * customer-advance receipt: every credit to a stored-value balance must be
 * backed by a real tender (payment fact), a BVM RECEIPT voucher, and — for
 * cash — a drawer movement. See docs/features/Order_Fin/Remediation_Work_Packages/B03_Stored_Value_Funding_Capture.md
 * for the full architecture (Revision v2 dropped a funding-header table —
 * the RECEIPT voucher this service creates is the funding aggregate;
 * Revision v3 added the payment-status gate and the invariants this file
 * enforces).
 *
 * Explicitly NOT this file's job (see B03 "Rejected/trimmed"): GL/liability
 * posting (B6), async gateway-callback funding (no gateway integration
 * exists for these 3 entry points today — a leg that would resolve
 * PENDING/PROCESSING/AUTHORIZED is rejected up front, never silently
 * accepted), reversal UI/API (contract only).
 */

import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireCurrencyCode, assertCurrencyMatch } from '@/lib/money/currency-resolution';
import { listEffectivePaymentMethodConfigs } from '@/lib/services/payment-config.service';
import { resolveDefaultStatus } from '@/lib/services/order-settlement-planner.service';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import { emitEventTx } from '@/lib/services/outbox.service';
import { topUpWalletTx, issueAdvanceTx } from '@/lib/services/stored-value.service';
import { generateGiftCardCode, finalizeGiftCardSaleTx } from '@/lib/services/gift-card-service';
import { VOUCHER_TYPE, LINE_TYPE, LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  PAYMENT_NATURE,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  OUTBOX_EVENT_TYPES,
  SV_FUNDING_TENDER_STATUS,
} from '@/lib/constants/order-financial';
import { GIFT_CARD_STATUS } from '@/lib/constants/gift-card';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { hashPayload } from '@/lib/utils/idempotency';
import bcrypt from 'bcryptjs';

/** Prisma interactive-transaction client type, matching every other financial service. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const STORED_VALUE_FUNDING_IDEMPOTENCY_RESOURCE = 'stored_value_funding';

const COMPLETED_STATUSES: readonly string[] = ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED;

export const FUNDING_TYPES = {
  GIFT_CARD_SALE: 'GIFT_CARD_SALE',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_ADVANCE_RECEIPT: 'CUSTOMER_ADVANCE_RECEIPT',
} as const;
export type FundingType = (typeof FUNDING_TYPES)[keyof typeof FUNDING_TYPES];

function resolveFundingLineRole(fundingType: FundingType): string {
  switch (fundingType) {
    case FUNDING_TYPES.GIFT_CARD_SALE:
      return LINE_ROLE.GIFT_CARD_SALE;
    case FUNDING_TYPES.WALLET_TOPUP:
      return LINE_ROLE.WALLET_TOPUP;
    case FUNDING_TYPES.CUSTOMER_ADVANCE_RECEIPT:
      return LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT;
    default:
      throw new Error(`UNKNOWN_FUNDING_TYPE: ${fundingType as string}`);
  }
}

export interface FundingTenderLegInput {
  paymentMethodId: string;
  amount: number;
  cashTendered?: number;
  reference?: string;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: string;
}

export interface GiftCardSaleDetails {
  cardCode?: string;
  cardPin?: string;
  cardName: string;
  cardName2?: string;
  expiryDate?: string;
  issuedToCustomerId?: string;
}

export interface FundStoredValueParams {
  tenantId: string;
  branchId?: string;
  fundingType: FundingType;
  /** Required for WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT; optional for GIFT_CARD_SALE (may be unassigned at purchase). */
  customerId?: string;
  currencyCode: string;
  fundedAmount: number;
  tenderLegs: FundingTenderLegInput[];
  cashDrawerSessionId?: string;
  posSessionId?: string;
  performedBy: string;
  idempotencyKey: string;
  giftCard?: GiftCardSaleDetails;
}

export interface FundStoredValueResult {
  fundingType: FundingType;
  targetType: string;
  targetId: string;
  voucherId: string;
  currencyCode: string;
  fundedAmount: number;
  giftCardId?: string;
  giftCardCode?: string;
}

/**
 * Fund a gift-card sale, wallet top-up, or customer-advance receipt with a
 * real tender. Opens its own transaction (mirrors collectPaymentTx) covering
 * target resolution, the BVM voucher + lines, and posting/wiring — the
 * wiring handlers registered for these 3 line roles (stored-value-funding-wiring.handler.ts,
 * stored-value-cash-drawer-wiring.handler.ts) create the tender-leg rows and
 * credit the ledger exactly once, within the same transaction.
 */
export async function fundStoredValue(params: FundStoredValueParams): Promise<FundStoredValueResult> {
  const {
    tenantId,
    branchId,
    fundingType,
    customerId,
    currencyCode,
    fundedAmount,
    tenderLegs,
    cashDrawerSessionId,
    posSessionId,
    performedBy,
    idempotencyKey,
    giftCard,
  } = params;

  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const resolvedCurrency = requireCurrencyCode(currencyCode, `fundStoredValue:${fundingType}`);
  if (!Number.isFinite(fundedAmount) || fundedAmount <= 0) {
    throw new Error('FUNDED_AMOUNT_MUST_BE_POSITIVE');
  }
  if (!tenderLegs.length) throw new Error('AT_LEAST_ONE_TENDER_LEG_REQUIRED');

  const totalTendered = tenderLegs.reduce((sum, leg) => sum + leg.amount, 0);
  if (Math.abs(totalTendered - fundedAmount) > SETTLEMENT_MONEY_EPSILON) {
    throw new Error('TENDER_TOTAL_MISMATCH');
  }

  // Frozen voucher-aggregate invariant (B03 Revision v3): one funding voucher
  // always has exactly one role/target/customer/currency.
  const requiresCustomer = fundingType !== FUNDING_TYPES.GIFT_CARD_SALE;
  if (requiresCustomer && !customerId) throw new Error('CUSTOMER_ID_REQUIRED');
  if (fundingType === FUNDING_TYPES.GIFT_CARD_SALE && !giftCard) {
    throw new Error('GIFT_CARD_DETAILS_REQUIRED');
  }

  // Resolve the gift-card code/PIN hash BEFORE opening the transaction —
  // mirrors sellGiftCard's own top-of-function pattern.
  let giftCardCode: string | undefined;
  let giftCardPinHash: string | undefined;
  if (fundingType === FUNDING_TYPES.GIFT_CARD_SALE) {
    giftCardCode = giftCard!.cardCode ?? (await generateGiftCardCode(tenantId));
    if (giftCard!.cardPin) {
      giftCardPinHash = await bcrypt.hash(giftCard!.cardPin, 12);
    }
  }

  const requestHash = hashPayload({
    tenantId,
    branchId,
    fundingType,
    customerId,
    currencyCode: resolvedCurrency,
    fundedAmount,
    tenderLegs,
    cashDrawerSessionId,
    posSessionId,
    giftCard,
  });

  return prisma.$transaction(async (tx) => {
    // 0. Idempotency check-first (D010 — mirrors collectPaymentTx exactly).
    const existingIdempotency = await tx.org_idempotency_keys.findFirst({
      where: {
        tenant_org_id: tenantId,
        key: idempotencyKey,
        resource_type: STORED_VALUE_FUNDING_IDEMPOTENCY_RESOURCE,
      },
      select: { response_cache: true },
    });
    if (existingIdempotency?.response_cache) {
      const cache = existingIdempotency.response_cache as {
        payload_hash?: string;
        result?: FundStoredValueResult;
      };
      if (cache.payload_hash && cache.payload_hash !== requestHash) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      if (cache.result) return cache.result;
    }

    // 1. D9-aware method resolution + payment-status gate (Revision v3): a
    //    method that would resolve outside COMPLETED/CAPTURED/SETTLED is
    //    rejected outright — no async completion path ships in this package.
    const effectiveConfigs = await listEffectivePaymentMethodConfigs({
      tenantId,
      branchId: branchId ?? undefined,
      methodIds: tenderLegs.map((leg) => leg.paymentMethodId),
    });
    const configById = new Map(effectiveConfigs.map((c) => [c.id, c]));

    const resolvedLegs = tenderLegs.map((leg, legIndex) => {
      const method = configById.get(leg.paymentMethodId);
      if (!method || !method.is_enabled || method.is_platform_disabled) {
        throw new Error('PAYMENT_METHOD_NOT_AVAILABLE');
      }
      if (method.payment_nature !== PAYMENT_NATURE.REAL_PAYMENT) {
        throw new Error('INVALID_PAYMENT_NATURE_FOR_FUNDING');
      }

      const resolvedStatus =
        method.default_creation_status || resolveDefaultStatus(method.payment_method_code, method.gateway_code);
      if (!COMPLETED_STATUSES.includes(resolvedStatus)) {
        throw new Error('FUNDING_METHOD_NOT_IMMEDIATELY_SETTLEABLE');
      }

      const isCash = method.payment_method_code.toUpperCase() === PAYMENT_METHODS.CASH;
      if (isCash) {
        const cashTendered = leg.cashTendered ?? leg.amount;
        if (cashTendered < leg.amount) throw new Error('CASH_TENDERED_LESS_THAN_AMOUNT');
        if (cashTendered - leg.amount > SETTLEMENT_MONEY_EPSILON && !method.supports_change_return) {
          throw new Error('CASH_CHANGE_NOT_ALLOWED');
        }
        if (method.requires_cash_drawer && !cashDrawerSessionId) {
          throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        }
      } else if (leg.cashTendered != null) {
        throw new Error('CASH_TENDERED_ONLY_FOR_CASH');
      }

      return { legIndex, method, leg, resolvedStatus };
    });

    // 2. Resolve the funding target. GIFT_CARD_SALE creates the (unfunded)
    //    card now so the voucher line has a real target_id before any money
    //    is confirmed (Revision v3). WALLET_TOPUP / CUSTOMER_ADVANCE_RECEIPT
    //    find-or-create the wallet/advance row up front for the currency
    //    check — same find-or-create shape topUpWalletTx/issueAdvanceTx use,
    //    so their own call at finalize time is a no-op find.
    let targetType: string;
    let targetId: string;
    let createdGiftCardId: string | undefined;

    if (fundingType === FUNDING_TYPES.GIFT_CARD_SALE) {
      const now = new Date();
      const card = await tx.org_gift_cards_mst.create({
        data: {
          tenant_org_id: tenantId,
          gift_card_code: giftCardCode!,
          pin_hash: giftCardPinHash,
          card_name: giftCard!.cardName,
          card_name2: giftCard!.cardName2,
          original_amount: 0,
          current_balance: 0,
          available_amount: 0,
          redeemed_amount: 0,
          bonus_amount: 0,
          bonus_remaining: 0,
          issued_date: now,
          expiry_date: giftCard!.expiryDate ? new Date(giftCard!.expiryDate) : undefined,
          issued_to_customer_id: giftCard!.issuedToCustomerId,
          purchased_by_cust_id: customerId,
          issue_type: 'SOLD',
          gift_card_type: 'FIXED_VALUE',
          currency_code: resolvedCurrency,
          // Unfunded until tender confirms — see finalizeGiftCardSaleTx.
          status: GIFT_CARD_STATUS.GENERATED,
          is_active: true,
          created_at: now,
          created_by: performedBy,
        },
        select: { id: true },
      });
      targetType = TARGET_TYPE.GIFT_CARD;
      targetId = card.id;
      createdGiftCardId = card.id;
    } else if (fundingType === FUNDING_TYPES.WALLET_TOPUP) {
      let wallet = await tx.org_customer_wallets_mst.findFirst({
        where: { tenant_org_id: tenantId, customer_id: customerId!, is_active: true },
      });
      if (wallet?.currency_code) {
        assertCurrencyMatch(wallet.currency_code, resolvedCurrency, `fundStoredValue wallet ${wallet.id}`);
      }
      if (!wallet) {
        wallet = await tx.org_customer_wallets_mst.create({
          data: {
            tenant_org_id: tenantId,
            customer_id: customerId!,
            balance: 0,
            currency_code: resolvedCurrency,
            is_active: true,
            rec_status: 1,
          },
        });
      }
      targetType = TARGET_TYPE.WALLET;
      targetId = wallet.id;
    } else {
      let advance = await tx.org_customer_advances_mst.findFirst({
        where: { tenant_org_id: tenantId, customer_id: customerId!, is_active: true },
      });
      if (advance?.currency_code) {
        assertCurrencyMatch(advance.currency_code, resolvedCurrency, `fundStoredValue advance ${advance.id}`);
      }
      if (!advance) {
        advance = await tx.org_customer_advances_mst.create({
          data: {
            tenant_org_id: tenantId,
            customer_id: customerId!,
            balance: 0,
            currency_code: resolvedCurrency,
            is_active: true,
            rec_status: 1,
          },
        });
      }
      // Frozen convention (LINE_ROLE_REQUIREMENTS): CUSTOMER_ADVANCE_RECEIPT
      // targets CUSTOMER, not the advance row itself.
      targetType = TARGET_TYPE.CUSTOMER;
      targetId = customerId!;
    }

    // 3. BVM voucher — the funding aggregate (Revision v2, no header table).
    const voucher = await createBizVoucher(
      tenantId,
      {
        voucher_type: VOUCHER_TYPE.RECEIPT,
        direction: 'IN',
        party_type: 'CUSTOMER',
        customer_id: customerId ?? undefined,
        source_module: 'STORED_VALUE',
        source_ref_type: fundingType,
        source_ref_id: targetId,
        currency_code: resolvedCurrency,
        total_amount: fundedAmount,
        branch_id: branchId ?? undefined,
        idempotency_key: `${idempotencyKey}_vch`,
      },
      performedBy,
      tx,
    );

    const lineRole = resolveFundingLineRole(fundingType);

    for (const resolved of resolvedLegs) {
      await addVoucherLine(
        tenantId,
        voucher.id,
        {
          line_type: LINE_TYPE.RECEIPT,
          line_role: lineRole as never,
          direction: 'IN',
          target_type: targetType as never,
          target_id: targetId,
          customer_id: customerId ?? undefined,
          branch_id: branchId ?? undefined,
          payment_method_code: resolved.method.payment_method_code,
          payment_status: resolved.resolvedStatus,
          org_payment_method_id: resolved.method.id,
          amount: resolved.leg.amount,
          currency_code: resolvedCurrency,
          cash_drawer_session_id: resolved.method.requires_cash_drawer
            ? (cashDrawerSessionId ?? undefined)
            : undefined,
          tendered_amount: resolved.leg.cashTendered,
          gateway_code: resolved.method.gateway_code ?? undefined,
          gateway_reference: resolved.leg.reference,
          check_number: resolved.leg.checkNumber,
          check_bank: resolved.leg.checkBank,
          check_date: resolved.leg.checkDate,
          pos_session_id: posSessionId,
          idempotency_key: `${idempotencyKey}_leg_${resolved.legIndex}`,
        },
        performedBy,
        undefined,
        tx,
      );
    }

    // 4. Post + wire — dispatches to stored-value-funding-wiring.handler.ts /
    //    stored-value-cash-drawer-wiring.handler.ts, which create the tender
    //    rows, credit the ledger exactly once via finalizeStoredValueFundingIfReady,
    //    and create drawer movements for cash legs.
    await postAndWireBizVoucher(tenantId, voucher.id, performedBy, `${idempotencyKey}_vch_post`, tx);

    const result: FundStoredValueResult = {
      fundingType,
      targetType,
      targetId,
      voucherId: voucher.id,
      currencyCode: resolvedCurrency,
      fundedAmount,
      giftCardId: createdGiftCardId,
      giftCardCode: fundingType === FUNDING_TYPES.GIFT_CARD_SALE ? giftCardCode : undefined,
    };

    const now = new Date();
    await tx.org_idempotency_keys.upsert({
      where: {
        tenant_org_id_key_resource_type: {
          tenant_org_id: tenantId,
          key: idempotencyKey,
          resource_type: STORED_VALUE_FUNDING_IDEMPOTENCY_RESOURCE,
        },
      },
      create: {
        tenant_org_id: tenantId,
        key: idempotencyKey,
        resource_type: STORED_VALUE_FUNDING_IDEMPOTENCY_RESOURCE,
        resource_id: voucher.id,
        response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
        created_at: now,
        expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        resource_id: voucher.id,
        response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  });
}

/**
 * Idempotent finalizer, called by stored-value-funding-wiring.handler.ts
 * after every tender-leg row it creates. Sums confirmed tender legs for this
 * voucher; a partial sum can never prematurely equal the voucher's
 * total_amount because every leg amount is positive and the voucher total
 * was set at creation to the exact sum of all intended legs (Revision v3 —
 * "finalization timing" note in B03). Credits the ledger exactly once via
 * each ledger primitive's own idempotency-skip (deterministic key
 * `${voucherId}_sv_credit`), then emits STORED_VALUE_FUNDING_COMPLETED.
 */
export async function finalizeStoredValueFundingIfReady(
  tx: PrismaTransactionClient,
  tenantOrgId: string,
  voucherId: string,
  userId: string,
  triggeringLineId: string,
): Promise<void> {
  const voucher = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: voucherId, tenant_org_id: tenantOrgId },
    select: { total_amount: true, customer_id: true, branch_id: true },
  });
  if (!voucher) throw new Error(`STORED_VALUE_FUNDING_VOUCHER_NOT_FOUND: ${voucherId}`);

  const tenders = await tx.org_sv_funding_tenders_dtl.findMany({
    where: { tenant_org_id: tenantOrgId, fin_voucher_id: voucherId, status: SV_FUNDING_TENDER_STATUS.COMPLETED },
    select: { amount: true, currency_code: true, funding_type: true, target_type: true, target_id: true },
  });
  if (tenders.length === 0) return;

  const confirmedTotal = tenders.reduce((sum, t) => sum + Number(t.amount), 0);
  const fundedAmount = Number(voucher.total_amount);
  if (Math.abs(confirmedTotal - fundedAmount) > SETTLEMENT_MONEY_EPSILON) {
    // Not every tender leg is wired yet — safe no-op, see this function's doc comment.
    return;
  }

  // Frozen invariant (Revision v3): every leg of one funding voucher shares
  // one currency.
  const currencies = new Set(tenders.map((t) => t.currency_code));
  if (currencies.size > 1) {
    throw new Error('STORED_VALUE_FUNDING_CURRENCY_MISMATCH_ACROSS_LEGS');
  }
  const currencyCode = tenders[0]!.currency_code;
  const fundingType = tenders[0]!.funding_type as FundingType;
  const targetType = tenders[0]!.target_type;
  const targetId = tenders[0]!.target_id;

  const creditIdempotencyKey = `${voucherId}_sv_credit`;

  if (fundingType === FUNDING_TYPES.GIFT_CARD_SALE) {
    await finalizeGiftCardSaleTx(tx, {
      tenantOrgId,
      giftCardId: targetId,
      amount: fundedAmount,
      performedBy: userId,
      branchId: voucher.branch_id ?? undefined,
      idempotencyKey: creditIdempotencyKey,
      voucherId,
      voucherLineId: triggeringLineId,
    });
  } else if (fundingType === FUNDING_TYPES.WALLET_TOPUP) {
    if (!voucher.customer_id) throw new Error('STORED_VALUE_FUNDING_MISSING_CUSTOMER');
    await topUpWalletTx(tx, {
      tenantId: tenantOrgId,
      customerId: voucher.customer_id,
      amount: fundedAmount,
      currencyCode,
      performedBy: userId,
      idempotencyKey: creditIdempotencyKey,
      voucherId,
      voucherLineId: triggeringLineId,
    });
  } else if (fundingType === FUNDING_TYPES.CUSTOMER_ADVANCE_RECEIPT) {
    if (!voucher.customer_id) throw new Error('STORED_VALUE_FUNDING_MISSING_CUSTOMER');
    await issueAdvanceTx(tx, {
      tenantId: tenantOrgId,
      customerId: voucher.customer_id,
      amount: fundedAmount,
      currencyCode,
      performedBy: userId,
      idempotencyKey: creditIdempotencyKey,
      voucherId,
      voucherLineId: triggeringLineId,
    });
  } else {
    throw new Error(`STORED_VALUE_FUNDING_UNKNOWN_TYPE: ${fundingType as string}`);
  }

  await emitEventTx(
    tx,
    tenantOrgId,
    OUTBOX_EVENT_TYPES.STORED_VALUE_FUNDING_COMPLETED,
    'stored_value_funding',
    voucherId,
    {
      tenantOrgId,
      branchId: voucher.branch_id ?? null,
      voucherId,
      fundingType,
      targetType,
      targetId,
      customerId: voucher.customer_id ?? null,
      currencyCode,
      fundedAmount,
      tenderLegs: tenders.map((t) => ({ amount: Number(t.amount) })),
      completedAt: new Date().toISOString(),
    },
  );
}

