/**
 * Unit Tests for CustomerCategoryService
 * Tenant org_customer_category_cf CRUD
 */

import { CustomerCategoryService } from '@/lib/services/customer-category.service';

const TENANT_ID = 'tenant-123';
const USER_ID = 'user-456';

function createMockChain() {
  const chain: Record<string, jest.Mock> = {
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  return chain;
}

function createMockFrom(chain: ReturnType<typeof createMockChain>) {
  return jest.fn(() => chain);
}

describe('CustomerCategoryService', () => {
  let mockFrom: jest.Mock;
  let mockChain: ReturnType<typeof createMockChain>;

  const supabase = {
    from: jest.fn(),
  } as unknown as Parameters<typeof CustomerCategoryService.list>[0];

  beforeEach(() => {
    mockChain = createMockChain();
    mockFrom = createMockFrom(mockChain);
    (supabase.from as jest.Mock).mockImplementation(mockFrom);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return categories for tenant', async () => {
      const mockData = [
        { id: '1', code: 'GUEST', name: 'Guest', is_b2b: false, is_individual: true, is_active: true },
      ];
      mockChain.order.mockReturnValue({ order: jest.fn().mockResolvedValue({ data: mockData, error: null }) });

      const result = await CustomerCategoryService.list(supabase, TENANT_ID);

      expect(supabase.from).toHaveBeenCalledWith('org_customer_category_cf');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('GUEST');
    });

    it('should apply is_b2b filter when provided', async () => {
      mockChain.order.mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) });

      await CustomerCategoryService.list(supabase, TENANT_ID, { is_b2b: true });

      expect(mockChain.eq).toHaveBeenCalledWith('tenant_org_id', TENANT_ID);
      expect(mockChain.eq).toHaveBeenCalledWith('is_b2b', true);
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('getByCode', () => {
    it('should return category when found', async () => {
      const mockCategory = { id: '1', code: 'B2B', name: 'B2B', is_b2b: true, is_individual: false, is_active: true };
      mockChain.single.mockResolvedValue({ data: mockCategory, error: null });

      const result = await CustomerCategoryService.getByCode(supabase, TENANT_ID, 'B2B');

      expect(result).toEqual(mockCategory);
    });

    it('should return null when not found', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await CustomerCategoryService.getByCode(supabase, TENANT_ID, 'UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return category by id', async () => {
      const mockCategory = { id: 'cat-1', code: 'B2B', name: 'B2B', is_b2b: true, is_individual: false, is_active: true };
      mockChain.single.mockResolvedValue({ data: mockCategory, error: null });

      const result = await CustomerCategoryService.getById(supabase, TENANT_ID, 'cat-1');

      expect(result).toEqual(mockCategory);
    });
  });

  describe('isCodeAvailable', () => {
    it('should return true when code is available', async () => {
      mockChain.limit.mockResolvedValue({ data: [], error: null });

      const result = await CustomerCategoryService.isCodeAvailable(supabase, TENANT_ID, 'HOTEL');

      expect(result).toBe(true);
    });

    it('should return false when code is taken', async () => {
      mockChain.limit.mockResolvedValue({ data: [{ id: '1' }], error: null });

      const result = await CustomerCategoryService.isCodeAvailable(supabase, TENANT_ID, 'B2B');

      expect(result).toBe(false);
    });

    it('should return false for empty code', async () => {
      const result = await CustomerCategoryService.isCodeAvailable(supabase, TENANT_ID, '  ');

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should pass excludeId when provided', async () => {
      mockChain.limit.mockResolvedValue({ data: [], error: null });

      await CustomerCategoryService.isCodeAvailable(supabase, TENANT_ID, 'HOTEL', 'id-123');

      expect(mockChain.neq).toHaveBeenCalledWith('id', 'id-123');
    });
  });

  describe('create', () => {
    it('should create category', async () => {
      const input = { code: 'HOTEL', name: 'Hotel', system_type: 'walk_in', is_b2b: true };
      const mockCreated = { id: '1', ...input, is_individual: false, is_active: true };
      mockChain.limit.mockResolvedValue({ data: [], error: null });
      mockChain.single.mockResolvedValue({ data: mockCreated, error: null });

      const result = await CustomerCategoryService.create(supabase, TENANT_ID, input, USER_ID);

      expect(result.code).toBe('HOTEL');
    });

    it('should throw when code is empty', async () => {
      const input = { code: '  ', name: 'Hotel', system_type: 'walk_in' };

      await expect(
        CustomerCategoryService.create(supabase, TENANT_ID, input, USER_ID)
      ).rejects.toThrow('Code is required');
    });

    it('should throw when code is already in use', async () => {
      const input = { code: 'B2B', name: 'B2B', system_type: 'B2B' };
      mockChain.limit.mockResolvedValue({ data: [{ id: '1' }], error: null });

      await expect(
        CustomerCategoryService.create(supabase, TENANT_ID, input, USER_ID)
      ).rejects.toThrow("Code 'B2B' is already in use");
    });
  });

  describe('update', () => {
    it('should update category', async () => {
      const existing = { id: '1', code: 'B2B', name: 'B2B', system_category_code: null, is_b2b: true, is_individual: false, is_active: true };
      const updated = { ...existing, name: 'B2B Updated' };
      mockChain.single
        .mockResolvedValueOnce({ data: existing, error: null })
        .mockResolvedValueOnce({ data: updated, error: null });

      const result = await CustomerCategoryService.update(
        supabase,
        TENANT_ID,
        'B2B',
        { name: 'B2B Updated' },
        USER_ID
      );

      expect(result.name).toBe('B2B Updated');
    });

    it('should throw when category not found', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      await expect(
        CustomerCategoryService.update(supabase, TENANT_ID, 'UNKNOWN', { name: 'X' }, USER_ID)
      ).rejects.toThrow("Customer category 'UNKNOWN' not found");
    });
  });

  describe('delete', () => {
    it('should throw when deleting system category', async () => {
      const systemCategory = { id: '1', code: 'B2B', system_category_code: 'B2B', is_b2b: true };
      mockChain.single.mockResolvedValue({ data: systemCategory, error: null });

      await expect(
        CustomerCategoryService.delete(supabase, TENANT_ID, 'B2B')
      ).rejects.toThrow('Cannot delete system category');
    });

    it('should delete tenant-created category', async () => {
      const customCategory = { id: '1', code: 'HOTEL', system_category_code: null };
      mockChain.single.mockResolvedValue({ data: customCategory, error: null });
      const inner = { eq: jest.fn().mockResolvedValue({ error: null }) };
      mockChain.delete.mockReturnValue({ eq: jest.fn().mockReturnValue(inner) });

      await CustomerCategoryService.delete(supabase, TENANT_ID, 'HOTEL');

      expect(mockChain.delete).toHaveBeenCalled();
    });

    it('should throw when category not found', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      await expect(
        CustomerCategoryService.delete(supabase, TENANT_ID, 'UNKNOWN')
      ).rejects.toThrow("Customer category 'UNKNOWN' not found");
    });
  });
});
