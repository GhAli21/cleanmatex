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

jest.mock('@/lib/services/workflow-service', () => ({
  WorkflowService: {
    changeStatus: jest.fn(),
  },
}));

jest.mock('@/lib/config/workflow-engine-v2.server', () => ({
  resolveWorkflowEngineV2Enabled: jest.fn(),
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
import {
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
});
