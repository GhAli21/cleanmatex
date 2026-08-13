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
    code?: string;
    blockedReasons?: string[];
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

import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/lib/supabase/server';
import {
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
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

    it('always uses the engine action and system actor for a ready order', async () => {
      mockOrderLookup('ready');
      (listAvailableActions as jest.Mock).mockResolvedValueOnce({ stateVersion: 7 });
      (executeAction as jest.Mock).mockResolvedValueOnce({
        ok: true,
        currentStatus: 'delivered',
        stateVersion: 8,
      });

      const result = await confirmPublicOrderReceivedResponse(request as never, {
        tenantId: 'tenant-1',
        orderNo: 'ORD-20260813-0002',
      });

      expect(result).toMatchObject({
        status: 200,
        body: { success: true, data: { status: 'delivered', engine: 'workflow_v2' } },
      });
      expect(executeAction).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        screen: 'public_tracking',
        actionCode: 'CONFIRM_DELIVERY',
        expectedStateVersion: 7,
        actorUserId: 'system-user',
        actorName: 'System User',
        idempotencyKey: 'public-confirm-received:tenant-1:order-1',
      }));
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

      expect(result).toMatchObject({ status: 400, body: { success: false } });
      expect(executeAction).not.toHaveBeenCalled();
    });
  });
});
