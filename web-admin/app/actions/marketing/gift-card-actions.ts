/* eslint-disable jsdoc/require-param */
/**
 * Server Actions: Gift Cards
 *
 * CRUD and lifecycle operations for org_gift_cards_mst. All actions resolve
 * tenant from session and filter by tenant_org_id. Permission checks guard
 * every write operation using hasPermissionServer().
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
  createGiftCard,
  generateGiftCardCode,
  sellGiftCard,
  adminActivateGiftCard,
  voidGiftCard,
  suspendGiftCard,
  adminAdjustGiftCard,
  getGiftCardTransactions,
} from '@/lib/services/gift-card-service';
import { fundStoredValue, FUNDING_TYPES } from '@/lib/services/stored-value-funding.service';
import { logger } from '@/lib/utils/logger';
import type {
  GiftCard,
  GiftCardTransaction,
  GiftCardTransactionLogRow,
} from '@/lib/types/payment';
import type { GiftCardStatus, GiftCardTxnType } from '@/lib/constants/gift-card';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const sellGiftCardSchema = z.object({
  card_name:                  z.string().min(1).max(200),
  card_name2:                 z.string().max(200).optional(),
  amount:                     z.number().positive(),
  expiry_date:                z.string().datetime().optional(),
  issued_to_customer_id:      z.string().uuid().optional(),
  purchased_by_customer_id:   z.string().uuid().optional(),
  card_pin:                   z.string().min(4).max(20).optional(),
  currency_code:              z.string().min(1).max(10),
});

const issueGiftCardAdminSchema = z.object({
  card_name:             z.string().min(1).max(200),
  card_name2:            z.string().max(200).optional(),
  amount:                z.number().positive(),
  expiry_date:           z.string().datetime().optional(),
  issued_to_customer_id: z.string().uuid().optional(),
  card_pin:              z.string().min(4).max(20).optional(),
  issue_type:            z.enum(['PROMOTIONAL', 'CORPORATE', 'GOODWILL', 'MIGRATION', 'REPLACEMENT']).optional(),
  currency_code:         z.string().min(1).max(10),
});

// B3 — governed DIRECT_TENDER sale: a real tender leg is required, unlike
// sellGiftCardSchema above (still used by the no-tender path, if any caller
// still needs it directly).
const sellGiftCardWithTenderSchema = z.object({
  card_name:                  z.string().min(1).max(200),
  card_name2:                 z.string().max(200).optional(),
  amount:                     z.number().positive(),
  expiry_date:                z.string().datetime().optional(),
  issued_to_customer_id:      z.string().uuid().optional(),
  purchased_by_customer_id:   z.string().uuid().optional(),
  card_pin:                   z.string().min(4).max(20).optional(),
  currency_code:              z.string().min(1).max(10),
  branch_id:                  z.string().uuid().optional(),
  payment_method_id:          z.string().uuid(),
  cash_tendered:               z.number().positive().optional(),
  cash_drawer_session_id:      z.string().uuid().optional(),
  pos_session_id:              z.string().uuid().optional(),
  idempotency_key:             z.string().min(1),
});

const adjustGiftCardSchema = z.object({
  adjustment_type: z.enum(['credit', 'debit']),
  amount:          z.number().positive(),
  notes:           z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List gift cards for the current tenant with pagination and optional filters.
 */
export async function listGiftCards(params: {
  page?: number;
  limit?: number;
  status?: GiftCardStatus;
  search?: string;
  customerId?: string;
}): Promise<
  | { success: true; data: GiftCard[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 25);
    const skip = (page - 1) * limit;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_cards_mst.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
      };

      if (params.status) {
        where.status = params.status;
      }
      if (params.customerId) {
        where.issued_to_customer_id = params.customerId;
      }
      if (params.search?.trim()) {
        where.OR = [
          { gift_card_code: { contains: params.search.trim(), mode: 'insensitive' } },
          { card_name: { contains: params.search.trim(), mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_cards_mst.findMany({
          where,
          include: {
            issued_to_customer: {
              select: { name: true },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.org_gift_cards_mst.count({ where }),
      ]);

      const data: GiftCard[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_code: row.gift_card_code,
        card_name: row.card_name ?? '',
        card_name2: row.card_name2 ?? undefined,
        original_amount: Number(row.original_amount),
        current_balance: Number(row.current_balance),
        available_amount: Number(row.available_amount),
        redeemed_amount: Number(row.redeemed_amount),
        bonus_amount: Number(row.bonus_amount),
        bonus_remaining: Number(row.bonus_remaining),
        issued_date: row.issued_date.toISOString(),
        expiry_date: row.expiry_date?.toISOString(),
        activation_date: row.activation_date?.toISOString(),
        issued_to_customer_id: row.issued_to_customer_id ?? undefined,
        issued_to_customer_name: row.issued_to_customer?.name ?? undefined,
        purchased_by_cust_id: row.purchased_by_cust_id ?? undefined,
        batch_id: row.batch_id ?? undefined,
        status: row.status as GiftCardStatus,
        is_active: row.is_active,
        is_reloadable: row.is_reloadable,
        is_transferable: row.is_transferable,
        max_redemptions: row.max_redemptions ?? undefined,
        redemption_count: row.redemption_count,
        issue_type: row.issue_type as GiftCard['issue_type'],
        gift_card_type: row.gift_card_type as GiftCard['gift_card_type'],
        currency_code: row.currency_code,
        metadata: row.metadata as Record<string, unknown> ?? undefined,
        rec_notes: row.rec_notes ?? undefined,
        created_at: row.created_at.toISOString(),
        created_by: row.created_by ?? undefined,
        updated_at: row.updated_at?.toISOString(),
        updated_by: row.updated_by ?? undefined,
      }));

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCards failed', error as Error, {});
    return { success: false, error: 'Failed to load gift cards' };
  }
}

// ---------------------------------------------------------------------------
// Sell (POS — creates + immediately activates)
// ---------------------------------------------------------------------------

/**
 * Sell a gift card at POS: creates and immediately activates it.
 * Requires gift_cards:sell permission.
 */
export async function sellGiftCardAction(
  input: z.infer<typeof sellGiftCardSchema>
): Promise<{ success: true; data: GiftCard } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canSell = await hasPermissionServer('gift_cards:sell');
    if (!canSell) {
      return { success: false, error: 'Insufficient permissions: gift_cards:sell required' };
    }

    const parsed = sellGiftCardSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const card = await sellGiftCard({
        tenantOrgId: tenantId,
        cardPin: parsed.data.card_pin,
        cardName: parsed.data.card_name,
        cardName2: parsed.data.card_name2,
        amount: parsed.data.amount,
        expiryDate: parsed.data.expiry_date,
        issuedToCustomerId: parsed.data.issued_to_customer_id,
        purchasedByCustomerId: parsed.data.purchased_by_customer_id,
        currencyCode: parsed.data.currency_code,
        createdBy: userId ?? undefined,
      });

      revalidatePath('/dashboard/marketing/gift-cards');
      return { success: true, data: card };
    });
  } catch (error) {
    logger.error('sellGiftCardAction failed', error as Error, {});
    return { success: false, error: 'Failed to sell gift card' };
  }
}

/**
 * B3 — Sell a gift card through the governed DIRECT_TENDER funding service:
 * requires a real tender leg (payment method + amount, cash-drawer session
 * when the method requires one). The card is created unfunded and only
 * activated once the tender is confirmed — see stored-value-funding.service.ts.
 * Behind feature flag `order_fin_sv_funding_capture`.
 */
export async function sellGiftCardWithTenderAction(
  input: z.infer<typeof sellGiftCardWithTenderSchema>
): Promise<
  | { success: true; data: { giftCardId: string; giftCardCode: string; voucherId: string } }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const flagOn = await currentTenantCan('order_fin_sv_funding_capture');
    if (!flagOn) {
      return { success: false, error: 'FUNDING_CAPTURE_NOT_ENABLED' };
    }

    const canSell = await hasPermissionServer('gift_cards:sell');
    if (!canSell) {
      return { success: false, error: 'Insufficient permissions: gift_cards:sell required' };
    }

    const parsed = sellGiftCardWithTenderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const data = parsed.data;

    const result = await fundStoredValue({
      tenantId,
      branchId: data.branch_id,
      fundingType: FUNDING_TYPES.GIFT_CARD_SALE,
      customerId: data.purchased_by_customer_id,
      currencyCode: data.currency_code,
      fundedAmount: data.amount,
      tenderLegs: [
        {
          paymentMethodId: data.payment_method_id,
          amount: data.amount,
          cashTendered: data.cash_tendered,
        },
      ],
      cashDrawerSessionId: data.cash_drawer_session_id,
      posSessionId: data.pos_session_id,
      performedBy: userId,
      idempotencyKey: data.idempotency_key,
      giftCard: {
        cardName: data.card_name,
        cardName2: data.card_name2,
        cardPin: data.card_pin,
        expiryDate: data.expiry_date,
        issuedToCustomerId: data.issued_to_customer_id,
      },
    });

    revalidatePath('/dashboard/marketing/gift-cards');
    return {
      success: true,
      data: {
        giftCardId: result.giftCardId!,
        giftCardCode: result.giftCardCode!,
        voucherId: result.voucherId,
      },
    };
  } catch (error) {
    logger.error('sellGiftCardWithTenderAction failed', error as Error, {});
    return { success: false, error: error instanceof Error ? error.message : 'Failed to sell gift card' };
  }
}

// ---------------------------------------------------------------------------
// Issue (admin — creates in GENERATED status, requires manual activation)
// ---------------------------------------------------------------------------

/**
 * Issue a promotional/corporate/goodwill gift card in GENERATED status.
 * Requires gift_cards:issue permission.
 */
export async function issueGiftCardAdmin(
  input: z.infer<typeof issueGiftCardAdminSchema>
): Promise<{ success: true; data: GiftCard } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canIssue = await hasPermissionServer('gift_cards:issue');
    if (!canIssue) {
      return { success: false, error: 'Insufficient permissions: gift_cards:issue required' };
    }

    const parsed = issueGiftCardAdminSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const cardCode = await generateGiftCardCode(tenantId);
      const card = await createGiftCard({
        tenantOrgId: tenantId,
        cardCode,
        cardPin: parsed.data.card_pin,
        cardName: parsed.data.card_name,
        cardName2: parsed.data.card_name2,
        amount: parsed.data.amount,
        expiryDate: parsed.data.expiry_date,
        issuedToCustomerId: parsed.data.issued_to_customer_id,
        issueType: parsed.data.issue_type ?? 'PROMOTIONAL',
        currencyCode: parsed.data.currency_code,
        createdBy: userId ?? undefined,
      });

      revalidatePath('/dashboard/marketing/gift-cards');
      return { success: true, data: card };
    });
  } catch (error) {
    logger.error('issueGiftCardAdmin failed', error as Error, {});
    return { success: false, error: 'Failed to issue gift card' };
  }
}

/**
 * @deprecated Use sellGiftCardAction or issueGiftCardAdmin.
 * Retained for backward compatibility — calls issueGiftCardAdmin internally.
 */
export async function issueGiftCard(
  input: z.infer<typeof issueGiftCardAdminSchema>
): Promise<{ success: true; data: GiftCard } | { success: false; error: string }> {
  return issueGiftCardAdmin(input);
}

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------

/**
 * Manually activate a gift card (GENERATED → ACTIVE).
 * Requires gift_cards:activate permission.
 */
export async function activateGiftCardAction(
  id: string
): Promise<{ success: boolean; error?: string; data?: GiftCard }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canActivate = await hasPermissionServer('gift_cards:activate');
    if (!canActivate) {
      return { success: false, error: 'Insufficient permissions: gift_cards:activate required' };
    }

    return withTenantContext(tenantId, async () => {
      const card = await adminActivateGiftCard(id, tenantId, userId ?? 'system');
      revalidatePath('/dashboard/marketing/gift-cards');
      return { success: true, data: card };
    });
  } catch (error) {
    logger.error('activateGiftCardAction failed', error as Error, { id });
    return { success: false, error: 'Failed to activate gift card' };
  }
}

// ---------------------------------------------------------------------------
// Adjust balance
// ---------------------------------------------------------------------------

/**
 * Manually adjust the balance of a gift card (credit or debit).
 * Requires gift_cards:adjust permission.
 */
export async function adjustGiftCard(
  id: string,
  input: z.infer<typeof adjustGiftCardSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canAdjust = await hasPermissionServer('gift_cards:adjust');
    if (!canAdjust) {
      return { success: false, error: 'Insufficient permissions: gift_cards:adjust required' };
    }

    const parsed = adjustGiftCardSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const result = await adminAdjustGiftCard(id, {
      tenantOrgId: tenantId,
      adjustmentType: parsed.data.adjustment_type,
      amount: parsed.data.amount,
      reason: parsed.data.notes,
      actorId: userId ?? 'system',
    });

    if (result.success) {
      revalidatePath('/dashboard/marketing/gift-cards');
    }
    return result;
  } catch (error) {
    logger.error('adjustGiftCard failed', error as Error, { id });
    return { success: false, error: 'Failed to adjust gift card' };
  }
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

/**
 * Void a gift card (terminal state — cannot be reversed).
 * Requires gift_cards:void permission.
 */
export async function voidGiftCardAction(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canVoid = await hasPermissionServer('gift_cards:void');
    if (!canVoid) {
      return { success: false, error: 'Insufficient permissions: gift_cards:void required' };
    }

    return withTenantContext(tenantId, async () => {
      const result = await voidGiftCard(id, tenantId, userId ?? 'system', reason);
      if (result.success) {
        revalidatePath('/dashboard/marketing/gift-cards');
      }
      return result;
    });
  } catch (error) {
    logger.error('voidGiftCardAction failed', error as Error, { id });
    return { success: false, error: 'Failed to void gift card' };
  }
}

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

/**
 * Suspend a gift card (prevents redemptions but keeps balance intact).
 * Requires gift_cards:void permission (suspend shares the same guard tier).
 */
export async function suspendGiftCardAction(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const canSuspend = await hasPermissionServer('gift_cards:void');
    if (!canSuspend) {
      return { success: false, error: 'Insufficient permissions: gift_cards:void required' };
    }

    return withTenantContext(tenantId, async () => {
      const result = await suspendGiftCard(id, tenantId, userId ?? 'system', reason);
      if (result.success) {
        revalidatePath('/dashboard/marketing/gift-cards');
      }
      return result;
    });
  } catch (error) {
    logger.error('suspendGiftCardAction failed', error as Error, { id });
    return { success: false, error: 'Failed to suspend gift card' };
  }
}

// ---------------------------------------------------------------------------
// Cancel (legacy alias — calls voidGiftCardAction)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use voidGiftCardAction — kept for backward compatibility.
 */
export async function cancelGiftCard(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return voidGiftCardAction(id, reason);
}

// ---------------------------------------------------------------------------
// Transaction log (tenant-wide)
// ---------------------------------------------------------------------------

/**
 * List all gift card transactions for the current tenant with pagination.
 */
export async function listGiftCardTransactionsAction(params: {
  page?: number;
  pageSize?: number;
  cardCode?: string;
  transactionType?: GiftCardTxnType;
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  | { success: true; data: GiftCardTransactionLogRow[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);
    const skip = (page - 1) * pageSize;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_card_txn_dtl.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
      };

      if (params.transactionType) {
        where.transaction_type = params.transactionType;
      }

      if (params.dateFrom || params.dateTo) {
        where.transaction_date = {};
        if (params.dateFrom) {
          (where.transaction_date as Record<string, unknown>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          (where.transaction_date as Record<string, unknown>).lte = to;
        }
      }

      if (params.cardCode?.trim()) {
        where.org_gift_cards_mst = {
          gift_card_code: { contains: params.cardCode.trim(), mode: 'insensitive' },
        };
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_card_txn_dtl.findMany({
          where,
          include: {
            org_gift_cards_mst: { select: { gift_card_code: true, card_name: true } },
          },
          orderBy: { transaction_date: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_gift_card_txn_dtl.count({ where }),
      ]);

      const data: GiftCardTransactionLogRow[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_id: row.gift_card_id,
        gift_card_code: row.org_gift_cards_mst.gift_card_code,
        card_name: row.org_gift_cards_mst.card_name ?? '',
        transaction_type: row.transaction_type as GiftCardTxnType,
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

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCardTransactionsAction failed', error as Error, {});
    return { success: false, error: 'Failed to load transaction log' };
  }
}

// ---------------------------------------------------------------------------
// Per-card transaction history
// ---------------------------------------------------------------------------

/**
 * Get transaction history for a gift card. Verifies ownership.
 */
export async function getGiftCardTransactionsAction(
  giftCardId: string
): Promise<
  | { success: true; data: GiftCardTransaction[] }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    return withTenantContext(tenantId, async () => {
      const owner = await prisma.org_gift_cards_mst.findFirst({
        where: { id: giftCardId, tenant_org_id: tenantId },
        select: { id: true },
      });
      if (!owner) {
        return { success: false, error: 'Gift card not found' };
      }

      const data = await getGiftCardTransactions(giftCardId, tenantId);
      return { success: true, data };
    });
  } catch (error) {
    logger.error('getGiftCardTransactionsAction failed', error as Error, { giftCardId });
    return { success: false, error: 'Failed to load transactions' };
  }
}

// ---------------------------------------------------------------------------
// Reports — Liability Summary
// ---------------------------------------------------------------------------

/**
 * Aggregate liability KPIs for the current tenant's gift card portfolio.
 * - totalOutstanding: sum of available_amount for ACTIVE, PARTIALLY_REDEEMED, GENERATED cards.
 * - totalActiveCards: count of ACTIVE and PARTIALLY_REDEEMED cards.
 * - totalRedeemedMtd: sum of transaction amount for REDEEM txns this calendar month.
 * - totalIssuedMtd: sum of original_amount for cards created this calendar month.
 * - totalExpiredBalance: sum of available_amount for EXPIRED cards (breakage).
 */
export async function getGiftCardLiabilitySummaryAction(): Promise<
  | {
      success: true;
      data: {
        totalOutstanding: number;
        totalActiveCards: number;
        totalRedeemedMtd: number;
        totalIssuedMtd: number;
        totalExpiredBalance: number;
      };
    }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return withTenantContext(tenantId, async () => {
      const [outstandingResult, activeCount, redeemedMtdResult, issuedMtdResult, expiredResult] =
        await Promise.all([
          // Total outstanding liability (ACTIVE + PARTIALLY_REDEEMED + GENERATED)
          prisma.org_gift_cards_mst.aggregate({
            where: {
              tenant_org_id: tenantId,
              status: { in: ['ACTIVE', 'PARTIALLY_REDEEMED', 'GENERATED'] },
            },
            _sum: { available_amount: true },
          }),
          // Total active cards (ACTIVE + PARTIALLY_REDEEMED)
          prisma.org_gift_cards_mst.count({
            where: {
              tenant_org_id: tenantId,
              status: { in: ['ACTIVE', 'PARTIALLY_REDEEMED'] },
            },
          }),
          // Total redeemed MTD
          prisma.org_gift_card_txn_dtl.aggregate({
            where: {
              tenant_org_id: tenantId,
              transaction_type: 'REDEEM',
              transaction_date: { gte: mtdStart },
            },
            _sum: { amount: true },
          }),
          // Total issued MTD (by original_amount of cards created this month)
          prisma.org_gift_cards_mst.aggregate({
            where: {
              tenant_org_id: tenantId,
              created_at: { gte: mtdStart },
            },
            _sum: { original_amount: true },
          }),
          // Total expired balance (breakage)
          prisma.org_gift_cards_mst.aggregate({
            where: {
              tenant_org_id: tenantId,
              status: 'EXPIRED',
            },
            _sum: { available_amount: true },
          }),
        ]);

      return {
        success: true,
        data: {
          totalOutstanding: Number(outstandingResult._sum.available_amount ?? 0),
          totalActiveCards: activeCount,
          totalRedeemedMtd: Number(redeemedMtdResult._sum.amount ?? 0),
          totalIssuedMtd: Number(issuedMtdResult._sum.original_amount ?? 0),
          totalExpiredBalance: Number(expiredResult._sum.available_amount ?? 0),
        },
      };
    });
  } catch (error) {
    logger.error('getGiftCardLiabilitySummaryAction failed', error as Error, {});
    return { success: false, error: 'Failed to load liability summary' };
  }
}

// ---------------------------------------------------------------------------
// Reports — Liability List
// ---------------------------------------------------------------------------

/**
 * Paginated list of gift cards with remaining balance for the liability report.
 * Supports filtering by status, issue type, and date range on issued_date.
 */
export async function listGiftCardLiabilityAction(params: {
  page: number;
  pageSize: number;
  status?: string;
  issueType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  | { success: true; data: GiftCard[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, params.pageSize);
    const skip = (page - 1) * pageSize;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_cards_mst.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
      };

      if (params.status) {
        where.status = params.status;
      }
      if (params.issueType) {
        where.issue_type = params.issueType;
      }
      if (params.dateFrom || params.dateTo) {
        where.issued_date = {};
        if (params.dateFrom) {
          (where.issued_date as Record<string, unknown>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          (where.issued_date as Record<string, unknown>).lte = to;
        }
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_cards_mst.findMany({
          where,
          include: {
            issued_to_customer: { select: { name: true } },
          },
          orderBy: { available_amount: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_gift_cards_mst.count({ where }),
      ]);

      const data: GiftCard[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_code: row.gift_card_code,
        card_name: row.card_name ?? '',
        card_name2: row.card_name2 ?? undefined,
        original_amount: Number(row.original_amount),
        current_balance: Number(row.current_balance),
        available_amount: Number(row.available_amount),
        redeemed_amount: Number(row.redeemed_amount),
        bonus_amount: Number(row.bonus_amount),
        bonus_remaining: Number(row.bonus_remaining),
        issued_date: row.issued_date.toISOString(),
        expiry_date: row.expiry_date?.toISOString(),
        activation_date: row.activation_date?.toISOString(),
        issued_to_customer_id: row.issued_to_customer_id ?? undefined,
        issued_to_customer_name: row.issued_to_customer?.name ?? undefined,
        purchased_by_cust_id: row.purchased_by_cust_id ?? undefined,
        batch_id: row.batch_id ?? undefined,
        status: row.status as GiftCardStatus,
        is_active: row.is_active,
        is_reloadable: row.is_reloadable,
        is_transferable: row.is_transferable,
        max_redemptions: row.max_redemptions ?? undefined,
        redemption_count: row.redemption_count,
        issue_type: row.issue_type as GiftCard['issue_type'],
        gift_card_type: row.gift_card_type as GiftCard['gift_card_type'],
        currency_code: row.currency_code,
        metadata: row.metadata as Record<string, unknown> ?? undefined,
        rec_notes: row.rec_notes ?? undefined,
        created_at: row.created_at.toISOString(),
        created_by: row.created_by ?? undefined,
        updated_at: row.updated_at?.toISOString(),
        updated_by: row.updated_by ?? undefined,
      }));

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCardLiabilityAction failed', error as Error, {});
    return { success: false, error: 'Failed to load liability report' };
  }
}

// ---------------------------------------------------------------------------
// Reports — Redemptions
// ---------------------------------------------------------------------------

/**
 * Paginated list of REDEEM transactions for the redemptions report.
 * Optionally scoped to a specific card and date range.
 */
export async function listGiftCardRedemptionsAction(params: {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  cardId?: string;
}): Promise<
  | { success: true; data: GiftCardTransactionLogRow[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, params.pageSize);
    const skip = (page - 1) * pageSize;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_card_txn_dtl.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
        transaction_type: 'REDEEM',
      };

      if (params.cardId) {
        where.gift_card_id = params.cardId;
      }
      if (params.dateFrom || params.dateTo) {
        where.transaction_date = {};
        if (params.dateFrom) {
          (where.transaction_date as Record<string, unknown>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          (where.transaction_date as Record<string, unknown>).lte = to;
        }
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_card_txn_dtl.findMany({
          where,
          include: {
            org_gift_cards_mst: { select: { gift_card_code: true, card_name: true } },
          },
          orderBy: { transaction_date: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_gift_card_txn_dtl.count({ where }),
      ]);

      const data: GiftCardTransactionLogRow[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_id: row.gift_card_id,
        gift_card_code: row.org_gift_cards_mst.gift_card_code,
        card_name: row.org_gift_cards_mst.card_name ?? '',
        transaction_type: row.transaction_type as GiftCardTxnType,
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

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCardRedemptionsAction failed', error as Error, {});
    return { success: false, error: 'Failed to load redemptions report' };
  }
}

// ---------------------------------------------------------------------------
// Reports — Refunds / Reversals
// ---------------------------------------------------------------------------

/**
 * Paginated list of REFUND transactions for the refunds/reversals report.
 */
export async function listGiftCardRefundsAction(params: {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  | { success: true; data: GiftCardTransactionLogRow[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, params.pageSize);
    const skip = (page - 1) * pageSize;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_card_txn_dtl.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
        transaction_type: 'REFUND',
      };

      if (params.dateFrom || params.dateTo) {
        where.transaction_date = {};
        if (params.dateFrom) {
          (where.transaction_date as Record<string, unknown>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          (where.transaction_date as Record<string, unknown>).lte = to;
        }
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_card_txn_dtl.findMany({
          where,
          include: {
            org_gift_cards_mst: { select: { gift_card_code: true, card_name: true } },
          },
          orderBy: { transaction_date: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_gift_card_txn_dtl.count({ where }),
      ]);

      const data: GiftCardTransactionLogRow[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_id: row.gift_card_id,
        gift_card_code: row.org_gift_cards_mst.gift_card_code,
        card_name: row.org_gift_cards_mst.card_name ?? '',
        transaction_type: row.transaction_type as GiftCardTxnType,
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

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCardRefundsAction failed', error as Error, {});
    return { success: false, error: 'Failed to load refunds report' };
  }
}

// ---------------------------------------------------------------------------
// Reports — Adjustments / Audit
// ---------------------------------------------------------------------------

/**
 * Paginated list of ADJUSTMENT transactions for the adjustments/audit report.
 */
export async function listGiftCardAdjustmentsAction(params: {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  | { success: true; data: GiftCardTransactionLogRow[]; total: number }
  | { success: false; error: string }
> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId } = auth;

    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, params.pageSize);
    const skip = (page - 1) * pageSize;

    return withTenantContext(tenantId, async () => {
      const where: Parameters<typeof prisma.org_gift_card_txn_dtl.findMany>[0]['where'] = {
        tenant_org_id: tenantId,
        transaction_type: 'ADJUSTMENT',
      };

      if (params.dateFrom || params.dateTo) {
        where.transaction_date = {};
        if (params.dateFrom) {
          (where.transaction_date as Record<string, unknown>).gte = new Date(params.dateFrom);
        }
        if (params.dateTo) {
          const to = new Date(params.dateTo);
          to.setHours(23, 59, 59, 999);
          (where.transaction_date as Record<string, unknown>).lte = to;
        }
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_card_txn_dtl.findMany({
          where,
          include: {
            org_gift_cards_mst: { select: { gift_card_code: true, card_name: true } },
          },
          orderBy: { transaction_date: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_gift_card_txn_dtl.count({ where }),
      ]);

      const data: GiftCardTransactionLogRow[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        gift_card_id: row.gift_card_id,
        gift_card_code: row.org_gift_cards_mst.gift_card_code,
        card_name: row.org_gift_cards_mst.card_name ?? '',
        transaction_type: row.transaction_type as GiftCardTxnType,
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

      return { success: true, data, total };
    });
  } catch (error) {
    logger.error('listGiftCardAdjustmentsAction failed', error as Error, {});
    return { success: false, error: 'Failed to load adjustments report' };
  }
}
