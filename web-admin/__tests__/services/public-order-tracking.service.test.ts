/** @jest-environment node */

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(),
}));

jest.mock('@/lib/utils/order-financial-snapshot', () => ({
  readCanonicalOrderFinancialSnapshot: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/utils/public-api-log-context', () => ({
  buildPublicApiLogContext: jest.fn(() => ({})),
}));

jest.mock('@/lib/services/order-service', () => ({
  OrderService: {
    getOrderHistory: jest.fn(),
  },
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  WorkflowEngineError: class WorkflowEngineError extends Error {
    code: string;
    blockedReasons?: string[];

    constructor(code: string, message: string, blockedReasons?: string[]) {
      super(message);
      this.code = code;
      this.blockedReasons = blockedReasons;
    }
  },
  executeAction: jest.fn(),
  listAvailableActions: jest.fn(),
}));

jest.mock('@/lib/constants/workflow-actions', () => ({
  WORKFLOW_ACTIONS: {
    CONFIRM_DELIVERY: 'CONFIRM_DELIVERY',
  },
}));

jest.mock('@/lib/constants/workflow-system-actor', () => ({
  WORKFLOW_SYSTEM_ACTOR: {
    userId: 'system-user',
    displayName: 'System User',
  },
}));

jest.mock('@/lib/services/pickup/pickup-completion.service', () => ({
  completePickup: jest.fn(),
  PickupCompletionError: class PickupCompletionError extends Error {
    code?: string;
    httpStatus?: number;
  },
}));

jest.mock('@/lib/services/pickup/pickup-release-state.service', () => ({
  getPickupReleaseSummary: jest.fn(),
}));

jest.mock('@/lib/types/pickup-release', () => ({
  PICKUP_RELEASE_STATES: {
    AVAILABLE_FOR_PICKUP: 'available_for_pickup',
  },
}));

import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/lib/supabase/server';
import {
  executeAction,
  listAvailableActions,
  WorkflowEngineError,
} from '@/lib/services/workflow/workflow-engine.service';
import { completePickup } from '@/lib/services/pickup/pickup-completion.service';
import { getPickupReleaseSummary } from '@/lib/services/pickup/pickup-release-state.service';
import {
  confirmPublicOrderReceivedResponse,
  getPublicTrackingPathForOrderId,
  resolvePublicTrackingReferenceByToken,
  resolvePublicTrackingTokenByOrderRef,
} from '@/lib/services/public-order-tracking.service';

describe('public-order-tracking service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolvePublicTrackingReferenceByToken', () => {
    it('returns null for an invalid token without querying the database', async () => {
      await expect(resolvePublicTrackingReferenceByToken('bad token')).resolves.toBeNull();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns the resolved order reference for a valid token', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          id: 'order-1',
          tenant_org_id: 'tenant-1',
          order_no: 'ORD-20260725-0004',
          public_tracking_token: 'opaque-token-123456',
        },
      ]);

      await expect(resolvePublicTrackingReferenceByToken('OPAQUE-TOKEN-123456')).resolves.toEqual({
        orderId: 'order-1',
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260725-0004',
        token: 'opaque-token-123456',
      });
    });

    it('returns null when the rollout columns are not available yet', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('column "public_tracking_token" does not exist'));

      await expect(resolvePublicTrackingReferenceByToken('opaque-token-123456')).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Public tracking token columns are not available yet',
        expect.objectContaining({
          feature: 'public_order_tracking',
          action: 'resolve_token',
          token: 'opaque-token-123456',
        }),
      );
    });
  });

  describe('resolvePublicTrackingTokenByOrderRef', () => {
    it('returns the active token for a readable tenant/order reference', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          id: 'order-1',
          tenant_org_id: 'tenant-1',
          order_no: 'ORD-20260725-0004',
          public_tracking_token: 'opaque-token-123456',
        },
      ]);

      await expect(
        resolvePublicTrackingTokenByOrderRef({
          tenantId: 'tenant-1',
          orderNo: 'ORD-20260725-0004',
        }),
      ).resolves.toBe('opaque-token-123456');
    });

    it('returns null when no active token exists', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        resolvePublicTrackingTokenByOrderRef({
          tenantId: 'tenant-1',
          orderNo: 'ORD-20260725-0004',
        }),
      ).resolves.toBeNull();
    });
  });

  describe('getPublicTrackingPathForOrderId', () => {
    it('prefers the opaque path when a token exists', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          id: 'order-1',
          tenant_org_id: 'tenant-1',
          order_no: 'ORD-20260725-0004',
          public_tracking_token: 'opaque-token-123456',
        },
      ]);

      await expect(
        getPublicTrackingPathForOrderId({
          tenantId: 'tenant-1',
          orderId: 'order-1',
          fallbackOrderNo: 'ORD-20260725-0004',
        }),
      ).resolves.toBe('/track/opaque-token-123456');
    });

    it('falls back to the legacy readable path during rollout', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        getPublicTrackingPathForOrderId({
          tenantId: 'tenant-1',
          orderId: 'order-1',
          fallbackOrderNo: 'ORD-20260725-0004',
        }),
      ).resolves.toBe('/public/orders/tenant-1/ORD-20260725-0004');
    });

    it('returns null when no token or fallback order number exists', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('column "public_tracking_token" does not exist'));

      await expect(
        getPublicTrackingPathForOrderId({
          tenantId: 'tenant-1',
          orderId: 'order-1',
        }),
      ).resolves.toBeNull();
    });
  });

  describe('confirmPublicOrderReceivedResponse', () => {
    const request = new Request('https://cmx.cleanmatex.com/api/v1/public/track/token', {
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '127.0.0.1' },
    });

    function mockOrderLookup(currentStatus: string) {
      (createClient as jest.Mock).mockResolvedValueOnce({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'order-1',
                    status: currentStatus,
                    current_status: currentStatus,
                    state_version: 7,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });
    }

    it('uses the pickup service and system actor for a ready_for_pickup order', async () => {
      mockOrderLookup('ready_for_pickup');
      (getPickupReleaseSummary as jest.Mock).mockResolvedValueOnce({
        state: 'available_for_pickup',
      });
      (completePickup as jest.Mock).mockResolvedValueOnce({
        workflow: { currentStatus: 'delivered', stateVersion: 8 },
      });

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 200,
        body: { success: true, data: { status: 'delivered', engine: 'workflow_v2' } },
      });
      expect(completePickup).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        expectedStateVersion: 7,
        actorUserId: 'system-user',
        actorName: 'System User',
        idempotencyKey: 'public-confirm-received:tenant-1:order-1',
        requireReleasedPickup: true,
      }));
    });

    it('rejects ready orders that have not been made available for pickup', async () => {
      mockOrderLookup('ready');
      (getPickupReleaseSummary as jest.Mock).mockResolvedValueOnce({ state: 'not_released' });

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 422,
        body: { success: false, code: 'PICKUP_RELEASE_REQUIRED' },
      });
      expect(completePickup).not.toHaveBeenCalled();
      expect(executeAction).not.toHaveBeenCalled();
    });

    it('does not let a public link use the staff-only direct counter route from ready', async () => {
      mockOrderLookup('ready');
      (getPickupReleaseSummary as jest.Mock).mockResolvedValueOnce({
        state: 'available_for_pickup',
      });

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 422,
        body: { success: false, code: 'PICKUP_RELEASE_REQUIRED' },
      });
      expect(completePickup).not.toHaveBeenCalled();
      expect(executeAction).not.toHaveBeenCalled();
    });

    it('returns idempotent success for delivered without executing another transition', async () => {
      mockOrderLookup('delivered');

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 200,
        body: { success: true, data: { status: 'delivered', idempotent: true } },
      });
      expect(executeAction).not.toHaveBeenCalled();
    });

    it('rejects an invalid workflow status before any transition call', async () => {
      mockOrderLookup('processing');

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 400,
        body: { success: false, code: 'ORDER_STATUS_NOT_CONFIRMABLE' },
      });
      expect(executeAction).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Public confirm-received rejected',
        expect.objectContaining({
          event: 'wf.public_confirm.rejected',
          tenantId: 'tenant-1',
          orderId: 'order-1',
          httpStatus: 400,
        }),
      );
    });

    it('maps an unbound live-policy confirm to HTTP 409', async () => {
      mockOrderLookup('out_for_delivery');
      (listAvailableActions as jest.Mock).mockResolvedValueOnce({ stateVersion: 7 });
      (executeAction as jest.Mock).mockRejectedValueOnce(
        new WorkflowEngineError(
          'PROFILE_SNAPSHOT_INCOMPLETE',
          'The order has an incomplete workflow profile binding.',
        ),
      );

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 409,
        body: { success: false, code: 'PROFILE_SNAPSHOT_INCOMPLETE' },
      });
    });

    it('maps a public channel mismatch to HTTP 403', async () => {
      mockOrderLookup('out_for_delivery');
      (listAvailableActions as jest.Mock).mockResolvedValueOnce({ stateVersion: 7 });
      (executeAction as jest.Mock).mockRejectedValueOnce(
        new WorkflowEngineError(
          'ACTION_NOT_ALLOWED',
          'This action is not available on the public tracking channel.',
        ),
      );

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 403,
        body: { success: false, code: 'ACTION_NOT_ALLOWED' },
      });
    });
  });
});
