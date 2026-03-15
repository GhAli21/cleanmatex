/**
 * Unit Tests for Customer Categories API Client
 * Tenant org_customer_category_cf CRUD and check-code
 */

import {
  fetchCustomerCategories,
  fetchCustomerCategoryByCode,
  checkCodeAvailable,
  createCustomerCategory,
  updateCustomerCategory,
  deleteCustomerCategory,
} from '@/lib/api/customer-categories';

global.fetch = jest.fn();

describe('Customer Categories API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCustomerCategories', () => {
    it('should fetch categories with no params', async () => {
      const mockData = [
        { id: '1', code: 'GUEST', name: 'Guest', is_b2b: false, is_individual: true, is_active: true },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      });

      const result = await fetchCustomerCategories();

      expect(fetch).toHaveBeenCalledWith('/api/v1/customer-categories', { credentials: 'include' });
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('GUEST');
    });

    it('should fetch categories with is_b2b filter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await fetchCustomerCategories({ is_b2b: true });

      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/customer-categories?is_b2b=true',
        { credentials: 'include' }
      );
    });

    it('should fetch categories with active_only filter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await fetchCustomerCategories({ active_only: false });

      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/customer-categories?active_only=false',
        { credentials: 'include' }
      );
    });

    it('should throw on failed fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch customer categories' }),
      });

      await expect(fetchCustomerCategories()).rejects.toThrow('Failed to fetch customer categories');
    });
  });

  describe('fetchCustomerCategoryByCode', () => {
    it('should fetch category by code', async () => {
      const mockCategory = { id: '1', code: 'B2B', name: 'B2B', is_b2b: true, is_individual: false, is_active: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCategory }),
      });

      const result = await fetchCustomerCategoryByCode('B2B');

      expect(fetch).toHaveBeenCalledWith('/api/v1/customer-categories/B2B', { credentials: 'include' });
      expect(result).toEqual(mockCategory);
    });

    it('should return null for 404', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await fetchCustomerCategoryByCode('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await expect(fetchCustomerCategoryByCode('B2B')).rejects.toThrow('Server error');
    });
  });

  describe('checkCodeAvailable', () => {
    it('should return true when code is available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      });

      const result = await checkCodeAvailable('HOTEL');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/customer-categories/check-code'),
        { credentials: 'include' }
      );
      expect(result).toBe(true);
    });

    it('should return false when code is taken', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false }),
      });

      const result = await checkCodeAvailable('B2B');

      expect(result).toBe(false);
    });

    it('should pass excludeId when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      });

      await checkCodeAvailable('HOTEL', 'id-123');

      const callUrl = (fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('code=HOTEL');
      expect(callUrl).toContain('excludeId=id-123');
    });
  });

  describe('createCustomerCategory', () => {
    it('should create category', async () => {
      const input = {
        code: 'HOTEL',
        name: 'Hotel',
        system_type: 'walk_in',
        is_b2b: true,
      };
      const mockResponse = { id: '1', ...input, is_individual: false, is_active: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      });

      const result = await createCustomerCategory(input);

      expect(fetch).toHaveBeenCalledWith('/api/v1/customer-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      expect(result.code).toBe('HOTEL');
    });
  });

  describe('updateCustomerCategory', () => {
    it('should update category', async () => {
      const updates = { name: 'B2B Updated' };
      const mockResponse = { id: '1', code: 'B2B', name: 'B2B Updated', is_b2b: true, is_individual: false, is_active: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      });

      const result = await updateCustomerCategory('B2B', updates);

      expect(fetch).toHaveBeenCalledWith('/api/v1/customer-categories/B2B', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      expect(result.name).toBe('B2B Updated');
    });
  });

  describe('deleteCustomerCategory', () => {
    it('should delete category', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await deleteCustomerCategory('HOTEL');

      expect(fetch).toHaveBeenCalledWith('/api/v1/customer-categories/HOTEL', {
        method: 'DELETE',
        credentials: 'include',
      });
    });

    it('should throw on delete failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Cannot delete system category' }),
      });

      await expect(deleteCustomerCategory('B2B')).rejects.toThrow('Cannot delete system category');
    });
  });
});
