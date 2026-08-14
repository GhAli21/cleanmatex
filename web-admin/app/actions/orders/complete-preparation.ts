/**
 * Server Action: Complete Preparation
 *
 * Authenticated compatibility adapter for the Preparation completion command.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { completePreparationSchema } from '@/lib/validations/order-schema';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  listAvailableActions,
  WorkflowEngineError,
} from '@/lib/services/workflow/workflow-engine.service';
import {
  completePreparationCommand,
  PreparationCompletionError,
} from '@/lib/services/preparation/preparation-completion.service';

interface CompletePreparationResult {
  success: boolean;
  data?: {
    orderId: string;
    readyBy: string;
    currentStatus: string;
    stateVersion: number;
  };
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Complete order preparation
 *
 * @param _tenantOrgId - Ignored legacy argument; tenant context comes from the authenticated session.
 * @param orderId - Order ID
 * @param _userId - Ignored legacy argument; actor context comes from the authenticated session.
 * @param data - Preparation completion data
 * @returns Result with updated order
 */
export async function completePreparation(
  _tenantOrgId: string,
  orderId: string,
  _userId: string,
  data: unknown
): Promise<CompletePreparationResult> {
  try {
    // Validate input
    const validation = completePreparationSchema.safeParse(data);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      });

      return {
        success: false,
        error: 'Validation failed - Complete Preparation',
        errors,
      };
    }

    const [auth, canUpdate, canTransition] = await Promise.all([
      getAuthContext(),
      hasPermissionServer('orders:update'),
      hasPermissionServer('orders:transition'),
    ]);
    if (!canUpdate || !canTransition) {
      return { success: false, error: 'You do not have permission to complete preparation.' };
    }

    const available = await listAvailableActions({
      tenantId: auth.tenantId,
      orderId,
      screen: 'preparation',
    });
    const result = await completePreparationCommand({
      tenantId: auth.tenantId,
      orderId,
      actorUserId: auth.userId,
      expectedStateVersion: available.stateVersion,
      idempotencyKey: crypto.randomUUID(),
      readyByOverride: validation.data.readyByOverride,
      internalNotes: validation.data.internalNotes,
    });

    // Revalidate order pages
    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath(`/dashboard/orders/${orderId}/prepare`);
    revalidatePath('/dashboard/orders');

    return {
      success: true,
      data: {
        orderId: result.orderId,
        readyBy: result.readyBy,
        currentStatus: result.workflow.currentStatus,
        stateVersion: result.workflow.stateVersion,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof PreparationCompletionError || error instanceof WorkflowEngineError
          ? error.message
          : 'Failed to complete preparation',
    };
  }
}
