/**
 * Assembly Hooks
 * React hooks for assembly operations
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { logger } from '@/lib/utils/logger';

/**
 *
 */
export interface AssemblyTask {
  id: string;
  orderId: string;
  taskStatus: string;
  totalItems: number;
  scannedItems: number;
  exceptionItems: number;
  assignedTo?: string;
  locationId?: string;
}

/**
 *
 */
export interface AssemblyTaskItem {
  id: string;
  orderItemId: string;
  itemStatus: string;
  barcode: string | null;
  scannedAt: string | null;
  hasException: boolean;
  productName: string;
  productName2: string;
  quantity: number;
}

/**
 *
 */
export interface AssemblyTaskDetail extends AssemblyTask {
  orderNo: string | null;
  qaStatus: string | null;
  items: AssemblyTaskItem[];
}

const assemblyTaskQueryKey = (tenantId: string | undefined, taskId: string) =>
  ['assembly', 'task', tenantId, taskId] as const;

/**
 *
 */
export interface AssemblyDashboard {
  pendingTasks: number;
  inProgressTasks: number;
  qaPendingTasks: number;
  completedToday: number;
  exceptionsOpen: number;
}

/**
 *
 */
export function useAssemblyDashboard() {
  const { currentTenant } = useAuth();

  return useQuery<AssemblyDashboard>({
    queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
    queryFn: async () => {
      if (!currentTenant) throw new Error('No tenant');

      const response = await fetch('/api/v1/assembly/dashboard');
      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to load dashboard');
    },
    enabled: !!currentTenant,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Load a single assembly task with items for the task modal.
 */
export function useAssemblyTask(taskId: string | undefined) {
  const { currentTenant } = useAuth();

  return useQuery<AssemblyTaskDetail>({
    queryKey: assemblyTaskQueryKey(currentTenant?.tenant_id, taskId ?? ''),
    queryFn: async () => {
      if (!currentTenant || !taskId) throw new Error('No tenant or task');

      const response = await fetch(`/api/v1/assembly/tasks/${taskId}`);
      const result = await response.json();

      if (result.success && result.data) {
        return result.data as AssemblyTaskDetail;
      }
      throw new Error(result.error || 'Failed to load assembly task');
    },
    enabled: !!currentTenant && !!taskId,
    staleTime: 10_000,
  });
}

/**
 *
 */
export function useCreateAssemblyTask() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/v1/assembly/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json();

      if (result.success) {
        return { success: true, taskId: result.taskId };
      }
      throw new Error(result.error || 'Failed to create task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'task', currentTenant?.tenant_id],
      });
    },
    onError: (error: Error, orderId: string) => {
      logger.error('Failed to create assembly task', error, {
        tenantId: currentTenant?.tenant_id,
        orderId,
      });
    },
  });
}

/**
 *
 */
export function useStartAssemblyTask() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      locationId,
    }: {
      taskId: string;
      locationId?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId }),
      });
      const result = await response.json();

      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'Failed to start task');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
      });
      queryClient.invalidateQueries({
        queryKey: assemblyTaskQueryKey(currentTenant?.tenant_id, variables.taskId),
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to start assembly task', error, {
        tenantId: currentTenant?.tenant_id,
        taskId: variables.taskId,
      });
    },
  });
}

/**
 *
 */
export function useScanItem() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      barcode,
      assemblyItemId,
    }: {
      taskId: string;
      barcode?: string;
      assemblyItemId?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      if (!barcode && !assemblyItemId) {
        throw new Error('Barcode or assembly item is required');
      }

      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, assemblyItemId }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          itemId: result.itemId as string | undefined,
          isMatch: result.isMatch as boolean | undefined,
        };
      }
      throw new Error(result.error || 'Scan failed');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
      });
      queryClient.invalidateQueries({
        queryKey: assemblyTaskQueryKey(currentTenant?.tenant_id, variables.taskId),
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to scan item', error, {
        tenantId: currentTenant?.tenant_id,
        taskId: variables.taskId,
      });
    },
  });
}

/**
 *
 */
export function usePerformQA() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      decisionTypeCode,
      qaNote,
      qaPhotoUrl,
    }: {
      taskId: string;
      decisionTypeCode: string;
      qaNote?: string;
      qaPhotoUrl?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionTypeCode,
          qaNote,
          qaPhotoUrl,
        }),
      });
      const result = await response.json();

      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'QA decision failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to perform QA', error, {
        tenantId: currentTenant?.tenant_id,
        taskId: variables.taskId,
      });
    },
  });
}

/**
 *
 */
export function usePackOrder() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      packagingTypeCode,
      packingNote,
    }: {
      taskId: string;
      packagingTypeCode: string;
      packingNote?: string;
    }) => {
      if (!currentTenant || !user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packagingTypeCode,
          packingNote,
        }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          packingListId: result.packingListId,
        };
      }
      throw new Error(result.error || 'Packing failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['assembly', 'dashboard', currentTenant?.tenant_id],
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to pack order', error, {
        tenantId: currentTenant?.tenant_id,
        taskId: variables.taskId,
      });
    },
  });
}

