/**
 * Server Actions: Gift Cards
 *
 * CRUD and lifecycle operations for org_gift_cards_mst. All actions resolve
 * tenant from session and filter by tenant_org_id.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  createGiftCard,
  generateGiftCardNumber,
  getGiftCardTransactions,
  deactivateGiftCard,
} from '@/lib/services/gift-card-service';
import { logger } from '@/lib/utils/logger';
import type { GiftCard, GiftCardStatus, GiftCardTransaction } from '@/lib/types/payment';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const issueGiftCardSchema = z.object({
  card_name: z.string().min(1).max(200),
  card_name2: z.string().max(200).optional(),
  amount: z.number().positive(),
  expiry_date: z.string().datetime().optional(),
  issued_to_customer_id: z.string().uuid().optional(),
  card_pin: z.string().min(4).max(10).optional(),
});

const adjustGiftCardSchema = z.object({
  adjustment_type: z.enum(['credit', 'debit']),
  amount: z.number().positive(),
  notes: z.string().min(1).max(500),
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
          { card_number: { contains: params.search.trim(), mode: 'insensitive' } },
          { card_name: { contains: params.search.trim(), mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.org_gift_cards_mst.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.org_gift_cards_mst.count({ where }),
      ]);

      const data: GiftCard[] = rows.map((row) => ({
        id: row.id,
        tenant_org_id: row.tenant_org_id,
        card_number: row.card_number,
        card_pin: row.card_pin ?? undefined,
        card_name: row.card_name,
        card_name2: row.card_name2 ?? undefined,
        original_amount: Number(row.original_amount),
        current_balance: Number(row.current_balance),
        issued_date: row.issued_date.toISOString(),
        expiry_date: row.expiry_date?.toISOString(),
        issued_to_customer_id: row.issued_to_customer_id ?? undefined,
        status: row.status as GiftCardStatus,
        is_active: row.is_active,
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
// Issue
// ---------------------------------------------------------------------------

/**
 * Issue (create) a new gift card with an auto-generated card number.
 */
export async function issueGiftCard(
  input: z.infer<typeof issueGiftCardSchema>
): Promise<{ success: true; data: GiftCard } | { success: false; error: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    const parsed = issueGiftCardSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const cardNumber = await generateGiftCardNumber(tenantId);
      const card = await createGiftCard({
        tenantOrgId: tenantId,
        cardNumber,
        cardPin: parsed.data.card_pin,
        cardName: parsed.data.card_name,
        cardName2: parsed.data.card_name2,
        amount: parsed.data.amount,
        expiryDate: parsed.data.expiry_date,
        issuedToCustomerId: parsed.data.issued_to_customer_id,
        createdBy: userId ?? undefined,
      });

      revalidatePath('/dashboard/marketing/gift-cards');
      return { success: true, data: card };
    });
  } catch (error) {
    logger.error('issueGiftCard failed', error as Error, {});
    return { success: false, error: 'Failed to issue gift card' };
  }
}

// ---------------------------------------------------------------------------
// Adjust balance
// ---------------------------------------------------------------------------

/**
 * Manually adjust the balance of a gift card (credit or debit).
 * Records a transaction for audit purposes.
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

    const parsed = adjustGiftCardSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    return withTenantContext(tenantId, async () => {
      const card = await prisma.org_gift_cards_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!card) {
        return { success: false, error: 'Gift card not found' };
      }

      const balanceBefore = Number(card.current_balance);
      const originalAmount = Number(card.original_amount);
      let balanceAfter: number;

      if (parsed.data.adjustment_type === 'credit') {
        // Cap credit at original amount to prevent over-funding.
        balanceAfter = Math.min(balanceBefore + parsed.data.amount, originalAmount);
      } else {
        if (parsed.data.amount > balanceBefore) {
          return { success: false, error: 'Debit amount exceeds current balance' };
        }
        balanceAfter = balanceBefore - parsed.data.amount;
      }

      const actualAmount = Math.abs(balanceAfter - balanceBefore);
      const newStatus: GiftCardStatus = balanceAfter <= 0 ? 'used' : 'active';

      await prisma.$transaction(async (tx) => {
        await tx.org_gift_card_transactions.create({
          data: {
            tenant_org_id: tenantId,
            gift_card_id: id,
            transaction_type: 'adjustment',
            amount: actualAmount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            transaction_date: new Date(),
            processed_by: userId ?? undefined,
            notes: parsed.data.notes,
          },
        });

        await tx.org_gift_cards_mst.update({
          where: { id },
          data: {
            current_balance: balanceAfter,
            status: newStatus,
            updated_at: new Date(),
            updated_by: userId ?? undefined,
          },
        });
      });

      revalidatePath('/dashboard/marketing/gift-cards');
      return { success: true };
    });
  } catch (error) {
    logger.error('adjustGiftCard failed', error as Error, { id });
    return { success: false, error: 'Failed to adjust gift card' };
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/**
 * Cancel a gift card. Sets status to cancelled and is_active to false.
 */
export async function cancelGiftCard(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return { success: false, error: 'Not authenticated or no tenant context' };
    }
    const { tenantId, userId } = auth;

    return withTenantContext(tenantId, async () => {
      // Verify ownership before cancelling.
      const card = await prisma.org_gift_cards_mst.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
        select: { id: true },
      });
      if (!card) {
        return { success: false, error: 'Gift card not found' };
      }

      const result = await deactivateGiftCard(id, reason, userId ?? undefined);
      if (result.success) {
        revalidatePath('/dashboard/marketing/gift-cards');
      }
      return result;
    });
  } catch (error) {
    logger.error('cancelGiftCard failed', error as Error, { id });
    return { success: false, error: 'Failed to cancel gift card' };
  }
}

// ---------------------------------------------------------------------------
// Transactions
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

      const data = await getGiftCardTransactions(giftCardId);
      return { success: true, data };
    });
  } catch (error) {
    logger.error('getGiftCardTransactionsAction failed', error as Error, { giftCardId });
    return { success: false, error: 'Failed to load transactions' };
  }
}
