/**
 * Gift Card Service for CleanMateX
 *
 * Handles all gift card operations including:
 * - Gift card validation
 * - Balance checking and management
 * - Gift card redemption
 * - Transaction tracking
 * - Gift card lifecycle management
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext, getTenantIdFromSession } from '../db/tenant-context';
import type {
  GiftCard,
  GiftCardStatus,
  GiftCardTransaction,
  GiftCardTransactionType,
  ValidateGiftCardInput,
  ValidateGiftCardResult,
  ApplyGiftCardInput,
} from '../types/payment';

// ============================================================================
// Gift Card Validation
// ============================================================================

/**
 * Validate gift card for payment
 */
export async function validateGiftCard(
  input: ValidateGiftCardInput
): Promise<ValidateGiftCardResult> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      isValid: false,
      error: 'Unauthorized: Tenant ID required',
      errorCode: 'UNAUTHORIZED',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      // Find gift card - middleware adds tenant_org_id automatically
      const giftCard = await prisma.org_gift_cards_mst.findFirst({
        where: {
          card_number: input.card_number,
          is_active: true,
        },
      });

    if (!giftCard) {
      return {
        isValid: false,
        error: 'Gift card not found',
        errorCode: 'NOT_FOUND',
      };
    }

    // Check PIN if provided
    if (giftCard.card_pin && input.card_pin) {
      if (giftCard.card_pin !== input.card_pin) {
        return {
          isValid: false,
          error: 'Invalid gift card PIN',
          errorCode: 'INVALID_PIN',
        };
      }
    }

    // Check status
    if (giftCard.status !== 'active') {
      if (giftCard.status === 'expired') {
        return {
          isValid: false,
          error: 'Gift card has expired',
          errorCode: 'EXPIRED',
        };
      }
      if (giftCard.status === 'suspended') {
        return {
          isValid: false,
          error: 'Gift card is suspended',
          errorCode: 'CARD_SUSPENDED',
        };
      }
      return {
        isValid: false,
        error: `Gift card is ${giftCard.status}`,
        errorCode: 'CARD_SUSPENDED',
      };
    }

    // Check expiry date
    if (giftCard.expiry_date) {
      const now = new Date();
      const expiryDate = new Date(giftCard.expiry_date);
      if (now > expiryDate) {
        // Mark as expired
        await prisma.org_gift_cards_mst.update({
          where: { id: giftCard.id },
          data: {
            status: 'expired',
            updated_at: new Date(),
          },
        });

        return {
          isValid: false,
          error: 'Gift card has expired',
          errorCode: 'EXPIRED',
        };
      }
    }

    // Check balance
    const currentBalance = Number(giftCard.current_balance);
    if (currentBalance <= 0) {
      // Mark as used
      await prisma.org_gift_cards_mst.update({
        where: { id: giftCard.id },
        data: {
          status: 'used',
          updated_at: new Date(),
        },
      });

      return {
        isValid: false,
        error: 'Gift card has no remaining balance',
        errorCode: 'INSUFFICIENT_BALANCE',
      };
    }

      return {
        isValid: true,
        giftCard: mapGiftCardToType(giftCard),
        availableBalance: currentBalance,
      };
    } catch (error) {
      console.error('Error validating gift card:', error);
      return {
        isValid: false,
        error: 'An error occurred while validating gift card',
      };
    }
  });
}

/**
 * Check gift card balance
 */
export async function getGiftCardBalance(
  cardNumber: string
): Promise<{ balance: number; status: GiftCardStatus } | null> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.findFirst({
      where: {
        card_number: cardNumber,
        is_active: true,
      },
    });

    if (!giftCard) {
      return null;
    }

    return {
      balance: Number(giftCard.current_balance),
      status: giftCard.status as GiftCardStatus,
    };
  });
}

// ============================================================================
// Gift Card Application
// ============================================================================

/**
 * Apply gift card to order payment
 */
export async function applyGiftCard(
  input: ApplyGiftCardInput
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      newBalance: 0,
      error: 'Unauthorized: Tenant ID required',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
      // Get gift card
      const giftCard = await tx.org_gift_cards_mst.findFirst({
        where: {
          card_number: input.card_number,
          is_active: true,
        },
      });

      if (!giftCard) {
        throw new Error('Gift card not found');
      }

      const currentBalance = Number(giftCard.current_balance);

      // Validate amount
      if (input.amount > currentBalance) {
        throw new Error(
          `Insufficient balance. Available: OMR ${currentBalance.toFixed(3)}`
        );
      }

      if (input.amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - input.amount;

      // Derive branch_id from order when available
      let branchId: string | undefined;
      if (input.order_id) {
        const order = await tx.org_orders_mst.findUnique({
          where: { id: input.order_id },
          select: { branch_id: true },
        });
        branchId = order?.branch_id ?? undefined;
      }

      // Record transaction
      await tx.org_gift_card_transactions.create({
        data: {
          tenant_org_id: giftCard.tenant_org_id,
          gift_card_id: giftCard.id,
          branch_id: branchId,
          transaction_type: 'redemption',
          amount: input.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          order_id: input.order_id,
          invoice_id: input.invoice_id,
          transaction_date: new Date(),
          processed_by: input.processed_by,
          notes: `Applied to order ${input.order_id}`,
        },
      });

      // Update gift card balance
      const newStatus: GiftCardStatus = balanceAfter <= 0 ? 'used' : 'active';

      await tx.org_gift_cards_mst.update({
        where: { id: giftCard.id },
        data: {
          current_balance: balanceAfter,
          status: newStatus,
          updated_at: new Date(),
          updated_by: input.processed_by,
        },
      });

        return {
          success: true,
          newBalance: balanceAfter,
        };
      });
    } catch (error) {
      console.error('Error applying gift card:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}

/**
 * Refund gift card (restore balance)
 */
export async function refundToGiftCard(
  cardNumber: string,
  amount: number,
  orderId: string,
  invoiceId: string,
  reason: string,
  processedBy?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      newBalance: 0,
      error: 'Unauthorized: Tenant ID required',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
      // Get gift card
      const giftCard = await tx.org_gift_cards_mst.findFirst({
        where: {
          card_number: cardNumber,
          is_active: true,
        },
      });

      if (!giftCard) {
        throw new Error('Gift card not found');
      }

      const currentBalance = Number(giftCard.current_balance);
      const originalAmount = Number(giftCard.original_amount);

      // Ensure refund doesn't exceed original amount
      const newBalance = Math.min(currentBalance + amount, originalAmount);
      const actualRefund = newBalance - currentBalance;

      // Derive branch_id from order
      let branchId: string | undefined;
      const order = await tx.org_orders_mst.findUnique({
        where: { id: orderId },
        select: { branch_id: true },
      });
      branchId = order?.branch_id ?? undefined;

      // Record transaction
      await tx.org_gift_card_transactions.create({
        data: {
          tenant_org_id: giftCard.tenant_org_id,
          gift_card_id: giftCard.id,
          branch_id: branchId,
          transaction_type: 'refund',
          amount: actualRefund,
          balance_before: currentBalance,
          balance_after: newBalance,
          order_id: orderId,
          invoice_id: invoiceId,
          transaction_date: new Date(),
          processed_by: processedBy,
          notes: `Refund: ${reason}`,
        },
      });

      // Update gift card balance and status
      await tx.org_gift_cards_mst.update({
        where: { id: giftCard.id },
        data: {
          current_balance: newBalance,
          status: newBalance > 0 ? 'active' : 'used',
          updated_at: new Date(),
          updated_by: processedBy,
        },
      });

        return {
          success: true,
          newBalance,
        };
      });
    } catch (error) {
      console.error('Error refunding to gift card:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}

// ============================================================================
// Gift Card Management
// ============================================================================

/**
 * Create a new gift card
 */
export async function createGiftCard(params: {
  tenantOrgId: string;
  cardNumber: string;
  cardPin?: string;
  cardName: string;
  cardName2?: string;
  amount: number;
  expiryDate?: string;
  issuedToCustomerId?: string;
  createdBy?: string;
}): Promise<GiftCard> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(params.tenantOrgId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.create({
      data: {
        tenant_org_id: params.tenantOrgId, // Explicit for clarity (middleware also adds it)
        card_number: params.cardNumber,
        card_pin: params.cardPin,
        card_name: params.cardName,
        card_name2: params.cardName2,
        original_amount: params.amount,
        current_balance: params.amount,
        issued_date: new Date(),
        expiry_date: params.expiryDate ? new Date(params.expiryDate) : undefined,
        issued_to_customer_id: params.issuedToCustomerId,
        status: 'active',
        is_active: true,
        created_at: new Date(),
        created_by: params.createdBy,
      },
    });

    return mapGiftCardToType(giftCard);
  });
}

/**
 * Get gift card by ID
 */
export async function getGiftCard(
  giftCardId: string
): Promise<GiftCard | null> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.findUnique({
      where: { id: giftCardId },
    });

    if (!giftCard) {
      return null;
    }

    return mapGiftCardToType(giftCard);
  });
}

/**
 * Get gift card by card number
 */
export async function getGiftCardByNumber(
  cardNumber: string
): Promise<GiftCard | null> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const giftCard = await prisma.org_gift_cards_mst.findFirst({
      where: {
        card_number: cardNumber,
        is_active: true,
      },
    });

    if (!giftCard) {
      return null;
    }

    return mapGiftCardToType(giftCard);
  });
}

/**
 * List gift cards for tenant
 */
export async function listGiftCards(params: {
  tenantOrgId?: string;
  status?: GiftCardStatus;
  customerId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ giftCards: GiftCard[]; total: number }> {
  // Get tenant ID from params or session
  const tenantId = params.tenantOrgId || (await getTenantIdFromSession());
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const where: any = {
      tenant_org_id: tenantId, // Explicit filter for clarity (middleware also adds it)
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.customerId) {
      where.issued_to_customer_id = params.customerId;
    }

    const [giftCards, total] = await Promise.all([
      prisma.org_gift_cards_mst.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      prisma.org_gift_cards_mst.count({ where }),
    ]);

    return {
      giftCards: giftCards.map(mapGiftCardToType),
      total,
    };
  });
}

/**
 * Deactivate gift card
 */
export async function deactivateGiftCard(
  giftCardId: string,
  reason: string,
  deactivatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      error: 'Unauthorized: Tenant ID required',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      await prisma.org_gift_cards_mst.update({
        where: { id: giftCardId },
        data: {
          status: 'cancelled',
          is_active: false,
          rec_notes: `Deactivated: ${reason}`,
          updated_at: new Date(),
          updated_by: deactivatedBy,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error deactivating gift card:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  });
}

// ============================================================================
// Gift Card Transactions
// ============================================================================

/**
 * Get transaction history for a gift card
 */
export async function getGiftCardTransactions(
  giftCardId: string
): Promise<GiftCardTransaction[]> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_gift_card_transactions.findMany({
      where: {
        gift_card_id: giftCardId,
      },
      orderBy: {
        transaction_date: 'desc',
      },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      tenant_org_id: transaction.tenant_org_id,
      gift_card_id: transaction.gift_card_id,
      transaction_type: transaction.transaction_type as GiftCardTransactionType,
      amount: Number(transaction.amount),
      balance_before: Number(transaction.balance_before),
      balance_after: Number(transaction.balance_after),
      order_id: transaction.order_id ?? undefined,
      invoice_id: transaction.invoice_id ?? undefined,
      notes: transaction.notes ?? undefined,
      transaction_date: transaction.transaction_date.toISOString(),
      processed_by: transaction.processed_by ?? undefined,
      metadata: transaction.metadata
        ? JSON.parse(transaction.metadata as string)
        : undefined,
    }));
  });
}

/**
 * Get gift card usage summary
 */
export async function getGiftCardUsageSummary(giftCardId: string): Promise<{
  total_transactions: number;
  total_redeemed: number;
  total_refunded: number;
  orders_count: number;
}> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_gift_card_transactions.findMany({
      where: {
        gift_card_id: giftCardId,
      },
    });

    const summary = transactions.reduce(
      (acc, transaction) => {
        acc.total_transactions++;

        if (transaction.transaction_type === 'redemption') {
          acc.total_redeemed += Number(transaction.amount);
        } else if (transaction.transaction_type === 'refund') {
          acc.total_refunded += Number(transaction.amount);
        }

        if (transaction.order_id) {
          acc.orders_count++;
        }

        return acc;
      },
      {
        total_transactions: 0,
        total_redeemed: 0,
        total_refunded: 0,
        orders_count: 0,
      }
    );

    return summary;
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique gift card number
 * Note: This function is called within tenant context, so middleware applies automatically
 */
export async function generateGiftCardNumber(
  tenantOrgId: string
): Promise<string> {
  const prefix = 'GC';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  const cardNumber = `${prefix}${timestamp}${random}`;

  // Ensure uniqueness - middleware adds tenant_org_id automatically
  const existing = await prisma.org_gift_cards_mst.findFirst({
    where: {
      tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
      card_number: cardNumber,
    },
  });

  if (existing) {
    // Recursively try again if collision occurs
    return generateGiftCardNumber(tenantOrgId);
  }

  return cardNumber;
}

/**
 * Calculate total gift card value issued by tenant
 */
export async function getTotalGiftCardValue(tenantOrgId: string): Promise<{
  total_issued: number;
  total_active_balance: number;
  total_redeemed: number;
}> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const giftCards = await prisma.org_gift_cards_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        is_active: true,
      },
    });

    const summary = giftCards.reduce(
      (acc, card) => {
        acc.total_issued += Number(card.original_amount);
        acc.total_active_balance += Number(card.current_balance);
        acc.total_redeemed += Number(card.original_amount) - Number(card.current_balance);
        return acc;
      },
      {
        total_issued: 0,
        total_active_balance: 0,
        total_redeemed: 0,
      }
    );

    return summary;
  });
}

/**
 * Check and expire gift cards
 */
export async function expireGiftCards(tenantOrgId: string): Promise<number> {
  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantOrgId, async () => {
    const now = new Date();

    const result = await prisma.org_gift_cards_mst.updateMany({
      where: {
        tenant_org_id: tenantOrgId, // Explicit filter for clarity (middleware also adds it)
        status: 'active',
        expiry_date: {
          lte: now,
        },
      },
      data: {
        status: 'expired',
        updated_at: now,
      },
    });

    return result.count;
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Prisma gift card to GiftCard type
 */
function mapGiftCardToType(giftCard: any): GiftCard {
  return {
    id: giftCard.id,
    tenant_org_id: giftCard.tenant_org_id,
    card_number: giftCard.card_number,
    card_pin: giftCard.card_pin ?? undefined,
    card_name: giftCard.card_name,
    card_name2: giftCard.card_name2 ?? undefined,
    original_amount: Number(giftCard.original_amount),
    current_balance: Number(giftCard.current_balance),
    issued_date: giftCard.issued_date.toISOString(),
    expiry_date: giftCard.expiry_date?.toISOString(),
    issued_to_customer_id: giftCard.issued_to_customer_id ?? undefined,
    status: giftCard.status as GiftCardStatus,
    is_active: giftCard.is_active,
    metadata: giftCard.metadata
      ? JSON.parse(giftCard.metadata as string)
      : undefined,
    rec_notes: giftCard.rec_notes ?? undefined,
    created_at: giftCard.created_at.toISOString(),
    created_by: giftCard.created_by ?? undefined,
    updated_at: giftCard.updated_at?.toISOString(),
    updated_by: giftCard.updated_by ?? undefined,
  };
}

/**
 * Format amount to OMR currency
 */
export function formatOMR(amount: number): string {
  return `OMR ${amount.toFixed(3)}`;
}
