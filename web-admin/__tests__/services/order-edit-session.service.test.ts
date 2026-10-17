/** @jest-environment node */

const findOrder = jest.fn();
const findLock = jest.fn();
const createLock = jest.fn();
const updateLock = jest.fn();
const deleteLock = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { findFirst: (...args: unknown[]) => findOrder(...args) },
    org_order_edit_locks: {
      findFirst: (...args: unknown[]) => findLock(...args),
      create: (...args: unknown[]) => createLock(...args),
      updateMany: (...args: unknown[]) => updateLock(...args),
      deleteMany: (...args: unknown[]) => deleteLock(...args),
    },
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) => fn(_tenantId),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  endOrderEditSession,
  OrderEditSessionError,
  startOrderEditSession,
  touchOrderEditSession,
} from '@/lib/services/order-edit-session.service';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER = '44444444-4444-4444-8444-444444444444';
const TOKEN = '55555555-5555-4555-8555-555555555555';
const OTHER_TOKEN = '66666666-6666-4666-8666-666666666666';

describe('order edit session', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findOrder.mockResolvedValue({ id: ORDER_ID });
    deleteLock.mockResolvedValue({ count: 1 });
    updateLock.mockResolvedValue({ count: 1 });
    createLock.mockResolvedValue({ order_id: ORDER_ID });
  });

  it('starts a session only for an order in the authenticated organization', async () => {
    findLock.mockResolvedValue(null);
    const started = await startOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
      userName: 'Ada',
    });
    expect(started.expiresAt).toEqual(expect.any(String));
    expect(findOrder).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: ORDER_ID, tenant_org_id: TENANT_ID },
    }));
    expect(createLock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        order_id: ORDER_ID,
        tenant_org_id: TENANT_ID,
        locked_by: USER_ID,
        session_id: TOKEN,
      }),
    }));
  });

  it('refuses a second tab while the same user already holds a live session', async () => {
    findLock.mockResolvedValue({
      locked_by: USER_ID,
      session_id: OTHER_TOKEN,
      expires_at: new Date(Date.now() + 60_000),
      locked_by_name: 'Ada',
    });
    await expect(startOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
    })).rejects.toMatchObject({ code: 'ALREADY_OPEN' });
    expect(createLock).not.toHaveBeenCalled();
  });

  it('refuses a session held by someone else', async () => {
    findLock.mockResolvedValue({
      locked_by: OTHER_USER,
      session_id: OTHER_TOKEN,
      expires_at: new Date(Date.now() + 60_000),
      locked_by_name: 'Other',
    });
    await expect(touchOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
    })).rejects.toBeInstanceOf(OrderEditSessionError);
    await expect(touchOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
    })).rejects.toMatchObject({ code: 'HELD_BY_OTHER' });
  });

  it('extends a matching live session and drops an expired one', async () => {
    findLock.mockResolvedValueOnce({
      locked_by: USER_ID,
      session_id: TOKEN,
      expires_at: new Date(Date.now() + 60_000),
      locked_by_name: 'Ada',
    });
    const touched = await touchOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
    });
    expect(touched.expiresAt).toEqual(expect.any(String));
    expect(updateLock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        order_id: ORDER_ID,
        tenant_org_id: TENANT_ID,
        locked_by: USER_ID,
        session_id: TOKEN,
      }),
    }));

    findLock.mockResolvedValueOnce({
      locked_by: USER_ID,
      session_id: TOKEN,
      expires_at: new Date(Date.now() - 1000),
      locked_by_name: 'Ada',
    });
    await expect(touchOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
    })).rejects.toMatchObject({ code: 'EXPIRED' });
    expect(deleteLock).toHaveBeenCalled();
  });

  it('ends an explicit exit and only shortens the observed expiry on unload', async () => {
    await endOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
      reason: 'user_exit',
    });
    expect(deleteLock).toHaveBeenCalledWith({
      where: {
        order_id: ORDER_ID,
        tenant_org_id: TENANT_ID,
        locked_by: USER_ID,
        session_id: TOKEN,
      },
    });

    const expected = new Date().toISOString();
    await endOrderEditSession({
      tenantId: TENANT_ID,
      userId: USER_ID,
      orderId: ORDER_ID,
      sessionToken: TOKEN,
      reason: 'unload',
      expectedExpiresAt: expected,
    });
    expect(updateLock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        order_id: ORDER_ID,
        tenant_org_id: TENANT_ID,
        session_id: TOKEN,
      }),
    }));
  });
});
