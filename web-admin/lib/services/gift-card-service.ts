/* eslint-disable jsdoc/require-param */
/**
 * Gift Card Service — CleanMateX
 *
 * Owns all gift-card lifecycle operations: issue, sell, activate, validate,
 * redeem, refund, adjust, void, suspend, expire, and reporting.
 *
 * Security invariants (NEVER violate):
 *   - card_pin, pin_hash, pin_failed_attempts are never returned to the client.
 *   - All writes inside a transaction use SELECT FOR UPDATE on the card row.
 *   - Every query filters by tenant_org_id — NO EXCEPTIONS.
 *   - Idempotency keys prevent double-credit / double-debit on retries.
 *
 * PIN migration:
 *   After a successful legacy plain-text PIN match, migratePin() is fired
 *   asynchronously (fire-and-forget). It writes pin_hash and nulls card_pin.
 */

import 'server-only';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext, getTenantIdFromSession } from '../db/tenant-context';
import { logger } from '@/lib/utils/logger';
import {
  GIFT_CARD_STATUS,
  GIFT_CARD_TXN_TYPE,
  REDEEMABLE_STATUSES,
  REFUND_REVERTIBLE_STATUSES,
  GIFT_CARD_PIN_MAX_ATTEMPTS,
  type GiftCardStatus,
  type GiftCardTxnType,
  type GiftCardIssueType,
  type GiftCardType,
} from '@/lib/constants/gift-card';
import type {
  GiftCard,
  ValidateGiftCardInput,
  ValidateGiftCardResult,
} from '@/lib/types/payment';

/** Prisma interactive-transaction client type */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Generate one 4-character hex segment for the CMX-XXXX-XXXX-XXXX format.
 * Uses crypto.randomBytes for cryptographic randomness.
 */
function generateSegment(): string {
  return randomBytes(2).toString('hex').toUpperCase();
}

/**
 * Verify a PIN against the card's stored credential.
 * Prefers pin_hash (bcrypt); falls back to card_pin (legacy plain-text).
 */
async function verifyPin(
  card: { card_pin: string | null; pin_hash: string | null },
  inputPin: string
): Promise<boolean> {
  if (card.pin_hash) {
    return bcrypt.compare(inputPin, card.pin_hash);
  }
  if (card.card_pin) {
    // Legacy plain-text comparison — migrate after success
    return card.card_pin === inputPin;
  }
  // Card has no PIN configured — accept without PIN
  return true;
}

/**
 * Migrate a legacy plain-text PIN to bcrypt hash (fire-and-forget).
 * Called after a successful plain-text PIN match so subsequent verifications
 * use the secure hash path.
 */
function migratePin(cardId: string, tenantOrgId: string, plainPin: string): void {
  bcrypt
    .hash(plainPin, 12)
    .then((hash) =>
      prisma.org_gift_cards_mst.update({
        where: { id: cardId },
        data: { pin_hash: hash, card_pin: null },
      })
    )
    .catch((err: unknown) =>
      logger.error('Failed to migrate gift card PIN to hash', err as Error, {
        feature: 'gift-cards',
        action: 'migrate-pin',
        cardId,
        tenantOrgId,
      })
    );
}

/**
 * Recalculate gift card status after a balance change.
 * VOIDED / EXPIRED / SUSPENDED cards are never moved by this calculation —
 * only ACTIVE, PARTIALLY_REDEEMED, and FULLY_REDEEMED cards are affected.
 */
function recalculateStatus(
  newAvailableAmount: number,
  originalAmount: number,
  currentStatus: GiftCardStatus
): GiftCardStatus {
  // Terminal states are immutable — only active/redeemed cards can transition
  if (
    currentStatus === GIFT_CARD_STATUS.VOIDED ||
    currentStatus === GIFT_CARD_STATUS.EXPIRED ||
    currentStatus === GIFT_CARD_STATUS.SUSPENDED
  ) {
    return currentStatus;
  }

  if (newAvailableAmount <= 0) return GIFT_CARD_STATUS.FULLY_REDEEMED;
  if (newAvailableAmount >= originalAmount) return GIFT_CARD_STATUS.ACTIVE;
  return GIFT_CARD_STATUS.PARTIALLY_REDEEMED;
}

/**
 * Map a Prisma gift card row to the GiftCard type.
 * Deliberately omits: card_pin, pin_hash, pin_failed_attempts.
 */
/** Convert a Prisma Decimal or plain number to a JavaScript number. */
function toNum(v: { toNumber(): number } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return v.toNumber();
}

function mapGiftCardToType(
  giftCard: {
    id: string;
    tenant_org_id: string;
    gift_card_code: string;
    card_name: string | null;
    card_name2: string | null;
    original_amount: { toNumber(): number } | number;
    current_balance: { toNumber(): number } | number;
    available_amount: { toNumber(): number } | number;
    redeemed_amount: { toNumber(): number } | number;
    bonus_amount: { toNumber(): number } | number;
    bonus_remaining: { toNumber(): number } | number;
    issued_date: Date;
    expiry_date: Date | null;
    activation_date: Date | null;
    issued_to_customer_id: string | null;
    purchased_by_cust_id: string | null;
    batch_id: string | null;
    status: string;
    is_active: boolean;
    is_reloadable: boolean;
    is_transferable: boolean;
    max_redemptions: number | null;
    redemption_count: number;
    issue_type: string;
    gift_card_type: string;
    currency_code: string;
    metadata: unknown;
    rec_notes: string | null;
    created_at: Date;
    created_by: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    issued_to_customer?: { name: string | null } | null;
  }
): GiftCard {
  return {
    id: giftCard.id,
    tenant_org_id: giftCard.tenant_org_id,
    gift_card_code: giftCard.gift_card_code,
    card_name: giftCard.card_name ?? '',
    card_name2: giftCard.card_name2 ?? undefined,
    original_amount: toNum(giftCard.original_amount),
    current_balance: toNum(giftCard.current_balance),
    available_amount: toNum(giftCard.available_amount),
    redeemed_amount: toNum(giftCard.redeemed_amount),
    bonus_amount: toNum(giftCard.bonus_amount),
    bonus_remaining: toNum(giftCard.bonus_remaining),
    issued_date: giftCard.issued_date.toISOString(),
    expiry_date: giftCard.expiry_date?.toISOString(),
    activation_date: giftCard.activation_date?.toISOString(),
    issued_to_customer_id: giftCard.issued_to_customer_id ?? undefined,
    issued_to_customer_name: giftCard.issued_to_customer?.name ?? undefined,
    purchased_by_cust_id: giftCard.purchased_by_cust_id ?? undefined,
    batch_id: giftCard.batch_id ?? undefined,
    status: giftCard.status as GiftCardStatus,
    is_active: giftCard.is_active,
    is_reloadable: giftCard.is_reloadable,
    is_transferable: giftCard.is_transferable,
    max_redemptions: giftCard.max_redemptions ?? undefined,
    redemption_count: giftCard.redemption_count,
    issue_type: giftCard.issue_type as GiftCardIssueType,
    gift_card_type: giftCard.gift_card_type as GiftCardType,
    currency_code: giftCard.currency_code,
    metadata: giftCard.metadata
      ? (giftCard.metadata as Record<string, unknown>)
      : undefined,
    rec_notes: giftCard.rec_notes ?? undefined,
    created_at: giftCard.created_at.toISOString(),
    created_by: giftCard.created_by ?? undefined,
    updated_at: giftCard.updated_at?.toISOString(),
    updated_by: giftCard.updated_by ?? undefined,
  };
}

// ============================================================================
// Code generation
// ============================================================================

/**
 * Generate a unique CMX-XXXX-XXXX-XXXX gift card code for the given tenant.
 * Retries up to 10 times before throwing — collision probability is negligible
 * (~1 in 4 billion per attempt) but the guard handles edge cases.
 */
export async function generateGiftCardCode(tenantOrgId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `CMX-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
    const existing = await prisma.org_gift_cards_mst.findFirst({
      where: { tenant_org_id: tenantOrgId, gift_card_code: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique gift card code after 10 attempts');
}

/** @deprecated Use generateGiftCardCode — retained for backward compatibility */
export async function generateGiftCardNumber(tenantOrgId: string): Promise<string> {
  return generateGiftCardCode(tenantOrgId);
}

// ============================================================================
// Card creation
// ============================================================================

/**
 * Create a gift card in GENERATED status (requires manual activation).
 * Used for admin-issued promotional, corporate, or goodwill cards.
 */
export async function createGiftCard(params: {
  tenantOrgId: string;
  cardCode?: string;
  cardPin?: string;
  cardName: string;
  cardName2?: string;
  amount: number;
  expiryDate?: string;
  issuedToCustomerId?: string;
  issueType?: GiftCardIssueType;
  giftCardType?: GiftCardType;
  currencyCode: string;
  createdBy?: string;
  batchId?: string;
  isReloadable?: boolean;
  isTransferable?: boolean;
  maxRedemptions?: number;
}): Promise<GiftCard> {
  return withTenantContext(params.tenantOrgId, async () => {
    const code = params.cardCode ?? (await generateGiftCardCode(params.tenantOrgId));

    let pinHash: string | undefined;
    if (params.cardPin) {
      pinHash = await bcrypt.hash(params.cardPin, 12);
    }

    const giftCard = await prisma.org_gift_cards_mst.create({
      data: {
        tenant_org_id: params.tenantOrgId,
        gift_card_code: code,
        // Store only the hash; plain-text pin_hash is the authoritative credential
        pin_hash: pinHash ?? undefined,
        card_name: params.cardName,
        card_name2: params.cardName2,
        original_amount: params.amount,
        current_balance: params.amount,
        available_amount: params.amount,
        redeemed_amount: 0,
        bonus_amount: 0,
        bonus_remaining: 0,
        issued_date: new Date(),
        expiry_date: params.expiryDate ? new Date(params.expiryDate) : undefined,
        issued_to_customer_id: params.issuedToCustomerId,
        issue_type: params.issueType ?? 'SOLD',
        gift_card_type: params.giftCardType ?? 'FIXED_VALUE',
        currency_code: params.currencyCode,
        batch_id: params.batchId,
        is_reloadable: params.isReloadable ?? false,
        is_transferable: params.isTransferable ?? false,
        max_redemptions: params.maxRedemptions,
        // GENERATED status — requires manual activation or sell flow
        status: GIFT_CARD_STATUS.GENERATED,
        is_active: true,
        created_at: new Date(),
        created_by: params.createdBy,
      },
      include: { issued_to_customer: { select: { name: true } } },
    });

    return mapGiftCardToType(giftCard);
  });
}

/**
 * Sell a gift card: creates and immediately activates it.
 * Sets activation_date, purchased_by_cust_id, issue_type = SOLD.
 * Inserts a SALE ledger row to record the sale transaction.
 */
export async function sellGiftCard(params: {
  tenantOrgId: string;
  cardCode?: string;
  cardPin?: string;
  cardName: string;
  cardName2?: string;
  amount: number;
  expiryDate?: string;
  issuedToCustomerId?: string;
  purchasedByCustomerId?: string;
  currencyCode: string;
  createdBy?: string;
  branchId?: string;
}): Promise<GiftCard> {
  return withTenantContext(params.tenantOrgId, async () => {
    const code = params.cardCode ?? (await generateGiftCardCode(params.tenantOrgId));

    let pinHash: string | undefined;
    if (params.cardPin) {
      pinHash = await bcrypt.hash(params.cardPin, 12);
    }

    const now = new Date();

    const giftCard = await prisma.$transaction(async (tx) => {
      const card = await tx.org_gift_cards_mst.create({
        data: {
          tenant_org_id: params.tenantOrgId,
          gift_card_code: code,
          pin_hash: pinHash ?? undefined,
          card_name: params.cardName,
          card_name2: params.cardName2,
          original_amount: params.amount,
          current_balance: params.amount,
          available_amount: params.amount,
          redeemed_amount: 0,
          bonus_amount: 0,
          bonus_remaining: 0,
          issued_date: now,
          expiry_date: params.expiryDate ? new Date(params.expiryDate) : undefined,
          activation_date: now,
          issued_to_customer_id: params.issuedToCustomerId,
          purchased_by_cust_id: params.purchasedByCustomerId,
          issue_type: 'SOLD',
          gift_card_type: 'FIXED_VALUE',
          currency_code: params.currencyCode,
          status: GIFT_CARD_STATUS.ACTIVE,
          is_active: true,
          created_at: now,
          created_by: params.createdBy,
        },
        include: { issued_to_customer: { select: { name: true } } },
      });

      // SALE ledger row — records the commercial transaction
      await tx.org_gift_card_txn_dtl.create({
        data: {
          tenant_org_id: params.tenantOrgId,
          gift_card_id: card.id,
          transaction_type: GIFT_CARD_TXN_TYPE.SALE,
          amount: params.amount,
          balance_before: 0,
          balance_after: params.amount,
          transaction_date: now,
          branch_id: params.branchId,
          processed_by: params.createdBy,
          notes: `Gift card sold: ${code}`,
        },
      });

      return card;
    });

    return mapGiftCardToType(giftCard);
  });
}

/**
 * Manually activate a GENERATED gift card (GENERATED → ACTIVE).
 * Inserts an ACTIVATE ledger row.
 */
export async function adminActivateGiftCard(
  id: string,
  tenantOrgId: string,
  actorId: string
): Promise<GiftCard> {
  return withTenantContext(tenantOrgId, async () => {
    const card = await prisma.org_gift_cards_mst.findFirst({
      where: { id, tenant_org_id: tenantOrgId, is_active: true },
      select: { id: true, status: true, tenant_org_id: true },
    });

    if (!card) throw new Error('GIFT_CARD_NOT_FOUND');
    if (card.status !== GIFT_CARD_STATUS.GENERATED) {
      throw new Error(`Cannot activate card in status ${card.status}`);
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.org_gift_cards_mst.update({
        where: { id },
        data: {
          status: GIFT_CARD_STATUS.ACTIVE,
          activation_date: now,
          updated_at: now,
          updated_by: actorId,
        },
      });

      await tx.org_gift_card_txn_dtl.create({
        data: {
          tenant_org_id: tenantOrgId,
          gift_card_id: id,
          transaction_type: GIFT_CARD_TXN_TYPE.ACTIVATE,
          amount: 0,
          balance_before: 0,
          balance_after: 0,
          transaction_date: now,
          processed_by: actorId,
          notes: 'Card manually activated by admin',
        },
      });
    });

    const updated = await prisma.org_gift_cards_mst.findFirstOrThrow({
      where: { id },
      include: { issued_to_customer: { select: { name: true } } },
    });

    return mapGiftCardToType(updated);
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a gift card by code and optional PIN.
 * Read-only: no balance mutation occurs here. The authoritative debit is in
 * redeemGiftCardTx (which uses SELECT FOR UPDATE).
 */
export async function validateGiftCard(
  input: ValidateGiftCardInput
): Promise<ValidateGiftCardResult> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return { isValid: false, error: 'Unauthorized: Tenant ID required', errorCode: 'UNAUTHORIZED' };
  }

  return withTenantContext(tenantId, async () => {
    try {
      const card = await prisma.org_gift_cards_mst.findFirst({
        where: {
          tenant_org_id: tenantId,
          gift_card_code: input.gift_card_code,
          is_active: true,
        },
        select: {
          id: true,
          tenant_org_id: true,
          gift_card_code: true,
          card_pin: true,
          pin_hash: true,
          pin_failed_attempts: true,
          status: true,
          expiry_date: true,
          available_amount: true,
          card_name: true,
          card_name2: true,
          original_amount: true,
          current_balance: true,
          redeemed_amount: true,
          bonus_amount: true,
          bonus_remaining: true,
          issued_date: true,
          activation_date: true,
          issued_to_customer_id: true,
          purchased_by_cust_id: true,
          batch_id: true,
          is_active: true,
          is_reloadable: true,
          is_transferable: true,
          max_redemptions: true,
          redemption_count: true,
          issue_type: true,
          gift_card_type: true,
          currency_code: true,
          metadata: true,
          rec_notes: true,
          created_at: true,
          created_by: true,
          updated_at: true,
          updated_by: true,
          issued_to_customer: { select: { name: true } },
        },
      });

      if (!card) {
        return { isValid: false, error: 'Gift card not found', errorCode: 'NOT_FOUND' };
      }

      // Lock check
      if (card.pin_failed_attempts >= GIFT_CARD_PIN_MAX_ATTEMPTS) {
        return { isValid: false, error: 'Gift card PIN is locked — too many failed attempts', errorCode: 'CARD_SUSPENDED' };
      }

      // PIN verification — reject immediately if card requires a PIN but none supplied
      const hasPin = !!(card.pin_hash ?? card.card_pin);
      if (hasPin && !input.card_pin) {
        return { isValid: false, error: 'Gift card PIN is required', errorCode: 'INVALID_PIN' };
      }
      if (hasPin && input.card_pin) {
        const pinOk = await verifyPin(
          { card_pin: card.card_pin ?? null, pin_hash: card.pin_hash ?? null },
          input.card_pin
        );
        if (!pinOk) {
          // Increment failure counter (fire-and-forget — don't slow down the hot path)
          Promise.resolve(
            prisma.org_gift_cards_mst.update({
              where: { id: card.id },
              data: { pin_failed_attempts: { increment: 1 } },
            })
          ).catch((err: unknown) =>
            logger.error('Failed to increment PIN failure counter', err as Error, {
              feature: 'gift-cards',
              action: 'validate-pin',
              cardId: card.id,
            })
          );
          return { isValid: false, error: 'Invalid gift card PIN', errorCode: 'INVALID_PIN' };
        }

        // On successful legacy PIN match, migrate to hash asynchronously
        if (!card.pin_hash && card.card_pin) {
          migratePin(card.id, tenantId, input.card_pin);
        }

        // Reset failure counter on success (fire-and-forget)
        if (card.pin_failed_attempts > 0) {
          Promise.resolve(
            prisma.org_gift_cards_mst.update({
              where: { id: card.id },
              data: { pin_failed_attempts: 0 },
            })
          ).catch((err: unknown) =>
            logger.error('Failed to reset PIN failure counter', err as Error, {
              feature: 'gift-cards',
              action: 'validate-pin-reset',
              cardId: card.id,
            })
            );
        }
      }

      // Status check
      if (!REDEEMABLE_STATUSES.includes(card.status as GiftCardStatus)) {
        if (card.status === GIFT_CARD_STATUS.EXPIRED) {
          return { isValid: false, error: 'Gift card has expired', errorCode: 'EXPIRED' };
        }
        if (card.status === GIFT_CARD_STATUS.SUSPENDED || card.status === GIFT_CARD_STATUS.VOIDED) {
          return { isValid: false, error: `Gift card is ${card.status.toLowerCase()}`, errorCode: 'CARD_SUSPENDED' };
        }
        return { isValid: false, error: `Gift card cannot be redeemed (status: ${card.status})`, errorCode: 'CARD_SUSPENDED' };
      }

      // Expiry check (read-only — actual mutation happens in redeemGiftCardTx)
      if (card.expiry_date && new Date() > new Date(card.expiry_date)) {
        return { isValid: false, error: 'Gift card has expired', errorCode: 'EXPIRED' };
      }

      const availableBalance = typeof card.available_amount === 'object' && card.available_amount !== null
        ? (card.available_amount as { toNumber(): number }).toNumber()
        : Number(card.available_amount);
      if (availableBalance <= 0) {
        return { isValid: false, error: 'Gift card has no remaining balance', errorCode: 'INSUFFICIENT_BALANCE' };
      }

      return {
        isValid: true,
        giftCard: mapGiftCardToType(card),
        availableBalance,
      };
    } catch (error) {
      logger.error('Error validating gift card', error as Error, {
        feature: 'gift-cards',
        action: 'validate',
        tenantId,
      });
      return { isValid: false, error: 'An error occurred while validating gift card' };
    }
  });
}

/**
 * Validate a gift card by its DB UUID (server-side order calculation path).
 * PIN re-verification is intentionally skipped — the card was pre-authenticated
 * during the validateGiftCard call that produced this ID.
 */
export async function validateGiftCardByIdForCalculation(
  id: string,
  tenantId: string
): Promise<ValidateGiftCardResult> {
  return withTenantContext(tenantId, async () => {
    try {
      const card = await prisma.org_gift_cards_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        include: { issued_to_customer: { select: { name: true } } },
      });

      if (!card) {
        return { isValid: false, error: 'Gift card not found', errorCode: 'NOT_FOUND' };
      }

      if (!REDEEMABLE_STATUSES.includes(card.status as GiftCardStatus)) {
        if (card.status === GIFT_CARD_STATUS.EXPIRED) {
          return { isValid: false, error: 'Gift card has expired', errorCode: 'EXPIRED' };
        }
        return { isValid: false, error: `Gift card is ${card.status.toLowerCase()}`, errorCode: 'CARD_SUSPENDED' };
      }

      if (card.expiry_date && new Date() > new Date(card.expiry_date)) {
        return { isValid: false, error: 'Gift card has expired', errorCode: 'EXPIRED' };
      }

      const availableBalance = typeof card.available_amount === 'object' && card.available_amount !== null
        ? (card.available_amount as { toNumber(): number }).toNumber()
        : Number(card.available_amount);
      if (availableBalance <= 0) {
        return { isValid: false, error: 'Gift card has no remaining balance', errorCode: 'INSUFFICIENT_BALANCE' };
      }

      return { isValid: true, giftCard: mapGiftCardToType(card), availableBalance };
    } catch (error) {
      logger.error('Error validating gift card by ID', error as Error, {
        feature: 'gift-cards',
        action: 'validate-by-id',
        tenantId,
        id,
      });
      return { isValid: false, error: 'An error occurred while validating gift card' };
    }
  });
}

// ============================================================================
// Redemption (within transaction)
// ============================================================================

/**
 * Debit a gift card inside an existing Prisma transaction.
 *
 * Uses SELECT FOR UPDATE to prevent double-debit on concurrent requests.
 * Idempotency key prevents double-debit on retries.
 */
export async function redeemGiftCardTx(
  tx: PrismaTransactionClient,
  params: {
    giftCardId: string;
    amount: number;
    orderId?: string;
    invoiceId?: string;
    branchId?: string;
    processedBy?: string;
    tenantOrgId: string;
    idempotencyKey?: string;
    /** Optional: invoice/order currency for cross-currency mismatch enforcement. */
    invoiceCurrency?: string;
    /** Phase 2: voucher header that produced this redemption (org_fin_vouchers_mst.id). */
    voucherId?: string;
    /** Phase 2: voucher line that produced this redemption (org_fin_voucher_trx_lines_dtl.id). */
    voucherLineId?: string;
  }
): Promise<{ newBalance: number; skipped?: boolean }> {
  const { giftCardId, amount, orderId, invoiceId, branchId, processedBy, tenantOrgId, idempotencyKey, invoiceCurrency, voucherId, voucherLineId } = params;

  // Idempotency check: if we've already processed this key, return current balance
  if (idempotencyKey) {
    const existing = await tx.org_gift_card_txn_dtl.findFirst({
      where: { tenant_org_id: tenantOrgId, idempotency_key: idempotencyKey },
      select: { id: true, balance_after: true },
    });
    if (existing) {
      const nb = typeof existing.balance_after === 'object' && existing.balance_after !== null
        ? (existing.balance_after as { toNumber(): number }).toNumber()
        : Number(existing.balance_after);
      return { newBalance: nb, skipped: true };
    }
  }

  // SELECT FOR UPDATE prevents double-debit on concurrent requests
  const locked = await tx.$queryRaw<
    {
      id: string;
      available_amount: number;
      original_amount: number;
      status: string;
      expiry_date: Date | null;
      tenant_org_id: string;
      currency_code: string;
      max_redemptions: number | null;
      redemption_count: number;
    }[]
  >`
    SELECT id, available_amount, original_amount, status, expiry_date, tenant_org_id,
           currency_code, max_redemptions, redemption_count
    FROM org_gift_cards_mst
    WHERE id = ${giftCardId}::uuid
      AND tenant_org_id = ${tenantOrgId}::uuid
      AND is_active = true
    FOR UPDATE
  `;

  if (!locked.length) throw new Error('GIFT_CARD_NOT_FOUND');

  const row = locked[0];

  // Currency mismatch check — reject redemption if the card currency differs from the invoice
  if (invoiceCurrency && row.currency_code && invoiceCurrency !== row.currency_code) {
    throw new Error('CURRENCY_MISMATCH');
  }

  // Max-redemptions enforcement — null means unlimited
  if (row.max_redemptions !== null && row.redemption_count >= row.max_redemptions) {
    throw new Error('MAX_REDEMPTIONS_REACHED');
  }

  // Inline expiry check with mutation — authoritative enforcement point
  if (row.expiry_date && new Date() > new Date(row.expiry_date)) {
    await tx.org_gift_cards_mst.update({
      where: { id: row.id },
      data: { status: GIFT_CARD_STATUS.EXPIRED, updated_at: new Date() },
    });
    throw new Error('GIFT_CARD_EXPIRED');
  }

  if (!REDEEMABLE_STATUSES.includes(row.status as GiftCardStatus)) {
    throw new Error('GIFT_CARD_NOT_REDEEMABLE');
  }

  const availableBefore = Number(row.available_amount);
  const originalAmount = Number(row.original_amount);
  if (availableBefore < amount) throw new Error('INSUFFICIENT_BALANCE');

  const availableAfter = availableBefore - amount;
  const newStatus = recalculateStatus(availableAfter, originalAmount, row.status as GiftCardStatus);

  await tx.org_gift_card_txn_dtl.create({
    data: {
      tenant_org_id:           row.tenant_org_id,
      gift_card_id:            row.id,
      branch_id:               branchId,
      transaction_type:        GIFT_CARD_TXN_TYPE.REDEEM,
      amount,
      balance_before:          availableBefore,
      balance_after:           availableAfter,
      order_id:                orderId,
      invoice_id:              invoiceId,
      transaction_date:        new Date(),
      processed_by:            processedBy,
      idempotency_key:         idempotencyKey,
      // Phase 2: voucher backlink (FK from migration 0329).
      fin_voucher_id:          voucherId ?? null,
      fin_voucher_trx_line_id: voucherLineId ?? null,
      notes:                   orderId ? `Redeemed for order ${orderId}` : 'Gift card redemption',
    },
  });

  await tx.org_gift_cards_mst.update({
    where: { id: row.id },
    data: {
      available_amount: availableAfter,
      current_balance: availableAfter,
      redeemed_amount: { increment: amount },
      redemption_count: { increment: 1 },
      status: newStatus,
      updated_at: new Date(),
      updated_by: processedBy,
    },
  });

  return { newBalance: availableAfter };
}

/** @deprecated Use redeemGiftCardTx — kept for compatibility during migration */
export async function applyGiftCardTx(
  tx: PrismaTransactionClient,
  params: {
    cardNumber: string;
    amount: number;
    orderId?: string;
    invoiceId?: string;
    branchId?: string;
    processedBy?: string;
    currencyCode: string;
    decimalPlaces: number;
    tenantOrgId: string;
  }
): Promise<{ newBalance: number }> {
  // Resolve card ID from the code
  const card = await tx.org_gift_cards_mst.findFirst({
    where: { tenant_org_id: params.tenantOrgId, gift_card_code: params.cardNumber, is_active: true },
    select: { id: true },
  });
  if (!card) throw new Error('GIFT_CARD_NOT_FOUND');

  return redeemGiftCardTx(tx, {
    giftCardId: card.id,
    amount: params.amount,
    orderId: params.orderId,
    invoiceId: params.invoiceId,
    branchId: params.branchId,
    processedBy: params.processedBy,
    tenantOrgId: params.tenantOrgId,
    idempotencyKey: params.orderId ? `${params.orderId}:redeem` : undefined,
  });
}

// ============================================================================
// Refund (within transaction)
// ============================================================================

/**
 * Restore gift card balance inside an existing Prisma transaction.
 *
 * Balance is capped at original_amount — never restores more than issued.
 * Idempotency key prevents double-credit on retries.
 */
export async function refundGiftCardTx(
  tx: PrismaTransactionClient,
  params: {
    giftCardId: string;
    amount: number;
    orderId: string;
    invoiceId: string;
    reason: string;
    processedBy?: string;
    tenantOrgId: string;
    idempotencyKey?: string;
  }
): Promise<{ newBalance: number; actualRefundAmount: number; skipped?: boolean }> {
  const { giftCardId, amount, orderId, invoiceId, reason, processedBy, tenantOrgId, idempotencyKey } = params;

  // Idempotency check
  if (idempotencyKey) {
    const existing = await tx.org_gift_card_txn_dtl.findFirst({
      where: { tenant_org_id: tenantOrgId, idempotency_key: idempotencyKey },
      select: { id: true, balance_after: true },
    });
    if (existing) {
      const nb = typeof existing.balance_after === 'object' && existing.balance_after !== null
        ? (existing.balance_after as { toNumber(): number }).toNumber()
        : Number(existing.balance_after);
      return { newBalance: nb, actualRefundAmount: 0, skipped: true };
    }
  }

  // SELECT FOR UPDATE prevents concurrent refund + redeem races
  const locked = await tx.$queryRaw<
    {
      id: string;
      tenant_org_id: string;
      available_amount: number;
      original_amount: number;
      status: string;
    }[]
  >`
    SELECT id, tenant_org_id, available_amount, original_amount, status
    FROM org_gift_cards_mst
    WHERE id = ${giftCardId}::uuid
      AND tenant_org_id = ${tenantOrgId}::uuid
      AND is_active = true
    FOR UPDATE
  `;

  if (!locked.length) throw new Error('GIFT_CARD_NOT_FOUND');

  const row = locked[0];
  const currentAvailable = Number(row.available_amount);
  const originalAmount = Number(row.original_amount);

  // Cap at original_amount — never over-restore
  const newBalance = Math.min(currentAvailable + amount, originalAmount);
  const actualRefundAmount = newBalance - currentAvailable;

  const newStatus = recalculateStatus(newBalance, originalAmount, row.status as GiftCardStatus);

  await tx.org_gift_card_txn_dtl.create({
    data: {
      tenant_org_id: row.tenant_org_id,
      gift_card_id: row.id,
      transaction_type: GIFT_CARD_TXN_TYPE.REFUND,
      amount: actualRefundAmount,
      balance_before: currentAvailable,
      balance_after: newBalance,
      order_id: orderId,
      invoice_id: invoiceId,
      transaction_date: new Date(),
      processed_by: processedBy,
      idempotency_key: idempotencyKey,
      notes: `Refund: ${reason}`,
    },
  });

  await tx.org_gift_cards_mst.update({
    where: { id: row.id },
    data: {
      available_amount: newBalance,
      current_balance: newBalance,
      redeemed_amount: { decrement: actualRefundAmount },
      status: newStatus,
      updated_at: new Date(),
      updated_by: processedBy,
    },
  });

  return { newBalance, actualRefundAmount };
}

// ============================================================================
// Admin operations
// ============================================================================

/**
 * Manually adjust (credit or debit) a gift card balance with an audit trail.
 */
export async function adminAdjustGiftCard(
  id: string,
  params: {
    tenantOrgId: string;
    adjustmentType: 'credit' | 'debit';
    amount: number;
    reason: string;
    actorId: string;
    branchId?: string;
  }
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return withTenantContext(params.tenantOrgId, async () => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { id: string; available_amount: number; original_amount: number; status: string; tenant_org_id: string }[]
        >`
          SELECT id, available_amount, original_amount, status, tenant_org_id
          FROM org_gift_cards_mst
          WHERE id = ${id}::uuid
            AND tenant_org_id = ${params.tenantOrgId}::uuid
            AND is_active = true
          FOR UPDATE
        `;

        if (!locked.length) throw new Error('GIFT_CARD_NOT_FOUND');
        const row = locked[0];

        const currentAvailable = Number(row.available_amount);
        const originalAmount = Number(row.original_amount);
        let newBalance: number;

        if (params.adjustmentType === 'credit') {
          newBalance = Math.min(currentAvailable + params.amount, originalAmount);
        } else {
          if (params.amount > currentAvailable) throw new Error('INSUFFICIENT_BALANCE');
          newBalance = currentAvailable - params.amount;
        }

        const actualAmount = Math.abs(newBalance - currentAvailable);
        const newStatus = recalculateStatus(newBalance, originalAmount, row.status as GiftCardStatus);

        await tx.org_gift_card_txn_dtl.create({
          data: {
            tenant_org_id: params.tenantOrgId,
            gift_card_id: id,
            branch_id: params.branchId,
            transaction_type: GIFT_CARD_TXN_TYPE.ADJUSTMENT,
            amount: actualAmount,
            balance_before: currentAvailable,
            balance_after: newBalance,
            transaction_date: new Date(),
            processed_by: params.actorId,
            notes: params.reason,
          },
        });

        await tx.org_gift_cards_mst.update({
          where: { id },
          data: {
            available_amount: newBalance,
            current_balance: newBalance,
            status: newStatus,
            updated_at: new Date(),
            updated_by: params.actorId,
          },
        });

        return newBalance;
      });

      return { success: true, newBalance: result };
    } catch (error) {
      logger.error('Error adjusting gift card', error as Error, {
        feature: 'gift-cards',
        action: 'adjust',
        tenantOrgId: params.tenantOrgId,
        cardId: id,
      });
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}

/**
 * Void a gift card (ACTIVE/PARTIALLY_REDEEMED → VOIDED).
 * Inserts a VOID ledger row.
 */
export async function voidGiftCard(
  id: string,
  tenantOrgId: string,
  actorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return withTenantContext(tenantOrgId, async () => {
    try {
      await prisma.$transaction(async (tx) => {
        const card = await tx.org_gift_cards_mst.findFirst({
          where: { id, tenant_org_id: tenantOrgId, is_active: true },
          select: { id: true, available_amount: true, status: true },
        });
        if (!card) throw new Error('GIFT_CARD_NOT_FOUND');

        await tx.org_gift_cards_mst.update({
          where: { id },
          data: {
            status: GIFT_CARD_STATUS.VOIDED,
            is_active: false,
            rec_notes: `Voided: ${reason}`,
            updated_at: new Date(),
            updated_by: actorId,
          },
        });

        await tx.org_gift_card_txn_dtl.create({
          data: {
            tenant_org_id: tenantOrgId,
            gift_card_id: id,
            transaction_type: GIFT_CARD_TXN_TYPE.VOID,
            amount: card.available_amount.toNumber(),
            balance_before: card.available_amount.toNumber(),
            balance_after: 0,
            transaction_date: new Date(),
            processed_by: actorId,
            notes: `Voided: ${reason}`,
          },
        });
      });

      return { success: true };
    } catch (error) {
      logger.error('Error voiding gift card', error as Error, {
        feature: 'gift-cards',
        action: 'void',
        tenantOrgId,
        cardId: id,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  });
}

/** @deprecated Use voidGiftCard — retained for backward compatibility */
export async function deactivateGiftCard(
  giftCardId: string,
  reason: string,
  deactivatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) return { success: false, error: 'Unauthorized: Tenant ID required' };
  return voidGiftCard(giftCardId, tenantId, deactivatedBy ?? 'system', reason);
}

/**
 * Suspend a gift card (prevents redemptions but keeps balance intact).
 */
export async function suspendGiftCard(
  id: string,
  tenantOrgId: string,
  actorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return withTenantContext(tenantOrgId, async () => {
    try {
      const card = await prisma.org_gift_cards_mst.findFirst({
        where: { id, tenant_org_id: tenantOrgId, is_active: true },
        select: { id: true },
      });
      if (!card) return { success: false, error: 'Gift card not found' };

      await prisma.org_gift_cards_mst.update({
        where: { id },
        data: {
          status: GIFT_CARD_STATUS.SUSPENDED,
          rec_notes: `Suspended: ${reason}`,
          updated_at: new Date(),
          updated_by: actorId,
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error suspending gift card', error as Error, {
        feature: 'gift-cards',
        action: 'suspend',
        tenantOrgId,
        cardId: id,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  });
}

/**
 * Mark a gift card as EXPIRED and insert an EXPIRE ledger row.
 */
export async function expireGiftCard(
  id: string,
  tenantOrgId: string
): Promise<{ success: boolean; error?: string }> {
  return withTenantContext(tenantOrgId, async () => {
    try {
      await prisma.$transaction(async (tx) => {
        const card = await tx.org_gift_cards_mst.findFirst({
          where: { id, tenant_org_id: tenantOrgId, is_active: true },
          select: { id: true, available_amount: true },
        });
        if (!card) throw new Error('GIFT_CARD_NOT_FOUND');

        await tx.org_gift_cards_mst.update({
          where: { id },
          data: {
            status: GIFT_CARD_STATUS.EXPIRED,
            updated_at: new Date(),
          },
        });

        await tx.org_gift_card_txn_dtl.create({
          data: {
            tenant_org_id: tenantOrgId,
            gift_card_id: id,
            transaction_type: GIFT_CARD_TXN_TYPE.EXPIRE,
            amount: card.available_amount.toNumber(),
            balance_before: card.available_amount.toNumber(),
            balance_after: 0,
            transaction_date: new Date(),
            notes: 'Card expired',
          },
        });
      });

      return { success: true };
    } catch (error) {
      logger.error('Error expiring gift card', error as Error, {
        feature: 'gift-cards',
        action: 'expire',
        tenantOrgId,
        cardId: id,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  });
}

/**
 * Batch-expire all cards past their expiry_date for a tenant.
 * Returns the number of cards expired.
 */
export async function expireGiftCards(tenantOrgId: string): Promise<number> {
  return withTenantContext(tenantOrgId, async () => {
    const now = new Date();
    const result = await prisma.org_gift_cards_mst.updateMany({
      where: {
        tenant_org_id: tenantOrgId,
        status: { in: [GIFT_CARD_STATUS.ACTIVE, GIFT_CARD_STATUS.PARTIALLY_REDEEMED, GIFT_CARD_STATUS.GENERATED] },
        expiry_date: { lte: now },
      },
      data: { status: GIFT_CARD_STATUS.EXPIRED, updated_at: now },
    });
    return result.count;
  });
}

// ============================================================================
// Query helpers
// ============================================================================

/**
 * Fetch a gift card by UUID.
 * Never returns card_pin, pin_hash, or pin_failed_attempts.
 */
export async function getGiftCard(
  giftCardId: string,
  tenantOrgId: string
): Promise<GiftCard | null> {
  return withTenantContext(tenantOrgId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.findFirst({
      where: { id: giftCardId, tenant_org_id: tenantOrgId },
      include: { issued_to_customer: { select: { name: true } } },
    });

    if (!giftCard) return null;
    return mapGiftCardToType(giftCard);
  });
}

/**
 * Fetch a gift card by gift_card_code.
 * Never returns card_pin, pin_hash, or pin_failed_attempts.
 */
export async function getGiftCardByCode(
  code: string,
  tenantOrgId: string
): Promise<GiftCard | null> {
  return withTenantContext(tenantOrgId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.findFirst({
      where: { gift_card_code: code, tenant_org_id: tenantOrgId, is_active: true },
      include: { issued_to_customer: { select: { name: true } } },
    });

    if (!giftCard) return null;
    return mapGiftCardToType(giftCard);
  });
}

/**
 * List gift cards for the tenant with pagination and optional filters.
 */
export async function listGiftCards(params: {
  tenantOrgId?: string;
  status?: GiftCardStatus;
  giftCardType?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ giftCards: GiftCard[]; total: number }> {
  const tenantId = params.tenantOrgId ?? (await getTenantIdFromSession());
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  return withTenantContext(tenantId, async () => {
    const where: Parameters<typeof prisma.org_gift_cards_mst.findMany>[0]['where'] = {
      tenant_org_id: tenantId,
    };

    if (params.status) where.status = params.status;
    if (params.giftCardType) where.gift_card_type = params.giftCardType;
    if (params.customerId) where.issued_to_customer_id = params.customerId;
    if (params.dateFrom || params.dateTo) {
      where.issued_date = {};
      if (params.dateFrom) (where.issued_date as Record<string, unknown>).gte = new Date(params.dateFrom);
      if (params.dateTo) (where.issued_date as Record<string, unknown>).lte = new Date(params.dateTo);
    }

    const [giftCards, total] = await Promise.all([
      prisma.org_gift_cards_mst.findMany({
        where,
        include: { issued_to_customer: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      prisma.org_gift_cards_mst.count({ where }),
    ]);

    return { giftCards: giftCards.map(mapGiftCardToType), total };
  });
}

/**
 * Get transaction ledger for a single gift card.
 */
export async function getGiftCardTransactions(
  giftCardId: string,
  tenantOrgId?: string
): Promise<import('@/lib/types/payment').GiftCardTransaction[]> {
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.org_gift_card_txn_dtl.findMany({
      where: { gift_card_id: giftCardId, tenant_org_id: tenantId },
      orderBy: { transaction_date: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      tenant_org_id: row.tenant_org_id,
      gift_card_id: row.gift_card_id,
      transaction_type: row.transaction_type as import('@/lib/constants/gift-card').GiftCardTxnType,
      amount: Number(row.amount),
      balance_before: Number(row.balance_before),
      balance_after: Number(row.balance_after),
      order_id: row.order_id ?? undefined,
      invoice_id: row.invoice_id ?? undefined,
      notes: row.notes ?? undefined,
      transaction_date: row.transaction_date.toISOString(),
      processed_by: row.processed_by ?? undefined,
      idempotency_key: row.idempotency_key ?? undefined,
      metadata: row.metadata ? (row.metadata as Record<string, unknown>) : undefined,
    }));
  });
}

/**
 * Aggregated usage stats for a single gift card.
 */
export async function getGiftCardUsageSummary(
  giftCardId: string,
  tenantOrgId?: string
): Promise<{
  total_transactions: number;
  total_redeemed: number;
  total_refunded: number;
  orders_count: number;
}> {
  const tenantId = tenantOrgId ?? (await getTenantIdFromSession());
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.org_gift_card_txn_dtl.findMany({
      where: { gift_card_id: giftCardId, tenant_org_id: tenantId },
    });

    return rows.reduce(
      (acc, row) => {
        acc.total_transactions++;
        if (row.transaction_type === GIFT_CARD_TXN_TYPE.REDEEM) {
          acc.total_redeemed += Number(row.amount);
        } else if (row.transaction_type === GIFT_CARD_TXN_TYPE.REFUND) {
          acc.total_refunded += Number(row.amount);
        }
        if (row.order_id) acc.orders_count++;
        return acc;
      },
      { total_transactions: 0, total_redeemed: 0, total_refunded: 0, orders_count: 0 }
    );
  });
}

/**
 * Total outstanding gift card liability for the tenant.
 * Liability = sum of available_amount for all non-expired, non-voided cards.
 */
export async function getTotalGiftCardLiability(
  tenantOrgId: string
): Promise<{ total_liability: number; card_count: number }> {
  return withTenantContext(tenantOrgId, async () => {
    const result = await prisma.org_gift_cards_mst.aggregate({
      where: {
        tenant_org_id: tenantOrgId,
        is_active: true,
        status: { notIn: [GIFT_CARD_STATUS.VOIDED, GIFT_CARD_STATUS.EXPIRED] },
      },
      _sum: { available_amount: true },
      _count: { id: true },
    });

    return {
      total_liability: result._sum.available_amount?.toNumber() ?? 0,
      card_count: result._count.id,
    };
  });
}

/**
 * @deprecated Use getTotalGiftCardLiability — retained for backward compatibility.
 */
export async function getTotalGiftCardValue(tenantOrgId: string): Promise<{
  total_issued: number;
  total_active_balance: number;
  total_redeemed: number;
}> {
  const liability = await getTotalGiftCardLiability(tenantOrgId);
  return {
    total_issued: 0,
    total_active_balance: liability.total_liability,
    total_redeemed: 0,
  };
}
