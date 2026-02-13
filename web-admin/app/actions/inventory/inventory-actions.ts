'use server';

import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  searchInventoryItems,
  adjustStock,
  searchStockTransactions,
  getInventoryStatistics,
  getBranchesForCurrentTenant,
} from '@/lib/services/inventory-service';

import type {
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventorySearchParams,
  StockAdjustmentRequest,
  StockTransactionSearchParams,
} from '@/lib/types/inventory';

export async function createInventoryItemAction(request: CreateInventoryItemRequest) {
  try {
    const item = await createInventoryItem(request);
    return { success: true, data: item };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory item';
    return { success: false, error: message };
  }
}

export async function updateInventoryItemAction(request: UpdateInventoryItemRequest) {
  try {
    const item = await updateInventoryItem(request);
    return { success: true, data: item };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update inventory item';
    return { success: false, error: message };
  }
}

export async function deleteInventoryItemAction(id: string) {
  try {
    await deleteInventoryItem(id);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete inventory item';
    return { success: false, error: message };
  }
}

export async function searchInventoryItemsAction(params: InventorySearchParams) {
  try {
    const result = await searchInventoryItems(params);
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to search inventory items';
    return { success: false, error: message };
  }
}

export async function adjustStockAction(request: StockAdjustmentRequest) {
  try {
    const transaction = await adjustStock(request);
    return { success: true, data: transaction };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to adjust stock';
    return { success: false, error: message };
  }
}

export async function searchStockTransactionsAction(params: StockTransactionSearchParams) {
  try {
    const result = await searchStockTransactions(params);
    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to search stock transactions';
    return { success: false, error: message };
  }
}

export async function getInventoryStatisticsAction(params?: { branch_id?: string }) {
  try {
    const stats = await getInventoryStatistics(params);
    return { success: true, data: stats };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory statistics';
    return { success: false, error: message };
  }
}

export async function getBranchesAction() {
  try {
    const branches = await getBranchesForCurrentTenant();
    return { success: true, data: branches };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch branches';
    return { success: false, error: message, data: [] };
  }
}
