/**
 * Permission Service Tests
 * 
 * Unit tests for permission checking functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getUserPermissionsServer,
  hasPermissionServer,
  invalidatePermissionCache,
} from '@/lib/services/permission-service-server';

// Mock Redis cache
jest.mock('@/lib/cache/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  },
}));

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(),
  })),
}));

// Suppress logger noise in tests
jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe('Permission Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPermissionsServer', () => {
    it('should return cached permissions if available', async () => {
      const { cache } = require('@/lib/cache/redis');
      cache.get.mockResolvedValue(['orders:create', 'orders:read']);

      const permissions = await getUserPermissionsServer('user-id', 'tenant-id');

      expect(permissions).toEqual(['orders:create', 'orders:read']);
      expect(cache.get).toHaveBeenCalledWith('permissions:user-id:tenant-id');
    });

    it('should fetch from database if cache miss', async () => {
      const { cache } = require('@/lib/cache/redis');
      const { createClient } = require('@/lib/supabase/server');
      
      cache.get.mockResolvedValue(null);
      const mockRpc = jest.fn().mockResolvedValue({
        data: [
          { permission_code: 'orders:create' },
          { permission_code: 'orders:read' },
        ],
        error: null,
      });
      createClient.mockReturnValue({ rpc: mockRpc });

      const permissions = await getUserPermissionsServer('user-id', 'tenant-id');

      expect(permissions).toEqual(['orders:create', 'orders:read']);
      expect(cache.set).toHaveBeenCalledWith(
        'permissions:user-id:tenant-id',
        ['orders:create', 'orders:read'],
        900
      );
    });
  });

  describe('hasPermissionServer', () => {
    it('should return true when user has permission', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockRpc = jest.fn().mockResolvedValue({
        data: true,
        error: null,
      });
      createClient.mockReturnValue({ rpc: mockRpc });

      const result = await hasPermissionServer('orders:create');

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('has_permission', {
        p_permission: 'orders:create',
      });
    });

    it('should return false when user lacks permission', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockRpc = jest.fn().mockResolvedValue({
        data: false,
        error: null,
      });
      createClient.mockReturnValue({ rpc: mockRpc });

      const result = await hasPermissionServer('orders:delete');

      expect(result).toBe(false);
    });
  });

  describe('invalidatePermissionCache', () => {
    it('should delete permission cache', async () => {
      const { cache } = require('@/lib/cache/redis');
      cache.del.mockResolvedValue(true);

      await invalidatePermissionCache('user-id', 'tenant-id');

      expect(cache.del).toHaveBeenCalledWith('permissions:user-id:tenant-id');
      expect(cache.del).toHaveBeenCalledWith('workflow_roles:user-id:tenant-id');
    });
  });
});

