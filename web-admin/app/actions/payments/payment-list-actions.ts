/**
 * Server Action: Payment List Management
 *
 * Actions for listing and retrieving payment statistics.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/server-auth";
import {
  listPayments as listPaymentsService,
  getPaymentStats as getPaymentStatsService,
} from "@/lib/services/payment-service";
import type {
  PaymentListFilters,
  PaymentStatus,
  PaymentKind,
} from "@/lib/types/payment";

/**
 * List all payments with filtering and pagination
 */
export async function listPayments(params: {
  page?: number;
  limit?: number;
  status?: string[];
  paymentMethodCode?: string[];
  kind?: string[];
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  try {
    // Get auth context for tenant isolation
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return {
        success: false,
        error: "Not authenticated or no tenant context",
      };
    }

    // Parse date strings to Date objects
    const startDate = params.startDate ? new Date(params.startDate) : undefined;
    const endDate = params.endDate ? new Date(params.endDate) : undefined;

    // Call service function
    const result = await listPaymentsService({
      tenantOrgId: auth.tenantId,
      page: params.page,
      limit: params.limit,
      status: params.status,
      paymentMethodCode: params.paymentMethodCode,
      kind: params.kind,
      customerId: params.customerId,
      orderId: params.orderId,
      invoiceId: params.invoiceId,
      startDate,
      endDate,
      searchQuery: params.searchQuery,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error listing payments:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list payments",
    };
  }
}

/**
 * Get payment statistics for the tenant
 */
export async function getPaymentStats(params?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    // Get auth context for tenant isolation
    const auth = await getAuthContext();
    if (!auth.tenantId) {
      return {
        success: false,
        error: "Not authenticated or no tenant context",
      };
    }

    // Parse date strings to Date objects
    const startDate = params?.startDate
      ? new Date(params.startDate)
      : undefined;
    const endDate = params?.endDate ? new Date(params.endDate) : undefined;

    // Call service function
    const stats = await getPaymentStatsService({
      tenantOrgId: auth.tenantId,
      startDate,
      endDate,
    });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error getting payment stats:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get payment statistics",
    };
  }
}
