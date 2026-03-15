/**
 * Customer Category Service
 * Manages org_customer_category_cf (tenant customer categories)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface CustomerCategoryItem {
  id: string;
  code: string;
  name: string;
  name2?: string | null;
  system_category_code?: string | null;
  system_type?: string | null;
  is_b2b: boolean;
  is_individual: boolean;
  display_order?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCustomerCategoryInput {
  code: string;
  name: string;
  name2?: string;
  system_type: string;
  is_b2b?: boolean;
  is_individual?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateCustomerCategoryInput {
  name?: string;
  name2?: string;
  system_type?: string;
  is_b2b?: boolean;
  is_individual?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export class CustomerCategoryService {
  /**
   * List customer categories for tenant
   */
  static async list(
    supabase: SupabaseClient,
    tenantId: string,
    options?: { is_b2b?: boolean; active_only?: boolean }
  ): Promise<CustomerCategoryItem[]> {
    try {
      let query = supabase
        .from('org_customer_category_cf')
        .select('id, code, name, name2, system_category_code, system_type, is_b2b, is_individual, display_order, is_active, created_at, updated_at')
        .eq('tenant_org_id', tenantId);

      if (options?.is_b2b !== undefined) {
        query = query.eq('is_b2b', options.is_b2b);
      }
      if (options?.active_only !== false) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('display_order', { ascending: true }).order('code', { ascending: true });

      if (error) {
        logger.error('CustomerCategoryService.list failed', new Error(error.message), {
          tenantId,
          feature: 'customer_category',
        });
        throw error;
      }

      return (data || []) as CustomerCategoryItem[];
    } catch (err) {
      logger.error('CustomerCategoryService.list failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'customer_category',
      });
      throw err;
    }
  }

  /**
   * Get customer category by code
   */
  static async getByCode(
    supabase: SupabaseClient,
    tenantId: string,
    code: string
  ): Promise<CustomerCategoryItem | null> {
    const { data, error } = await supabase
      .from('org_customer_category_cf')
      .select('id, code, name, name2, system_category_code, system_type, is_b2b, is_individual, display_order, is_active, created_at, updated_at')
      .eq('tenant_org_id', tenantId)
      .eq('code', code.toUpperCase())
      .single();

    if (error || !data) {
      return null;
    }

    return data as CustomerCategoryItem;
  }

  /**
   * Get customer category by id
   */
  static async getById(
    supabase: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<CustomerCategoryItem | null> {
    const { data, error } = await supabase
      .from('org_customer_category_cf')
      .select('id, code, name, name2, system_category_code, system_type, is_b2b, is_individual, display_order, is_active, created_at, updated_at')
      .eq('tenant_org_id', tenantId)
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as CustomerCategoryItem;
  }

  /**
   * Check if code is available (not already used)
   */
  static async isCodeAvailable(
    supabase: SupabaseClient,
    tenantId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!normalized) return false;

    let query = supabase
      .from('org_customer_category_cf')
      .select('id')
      .eq('tenant_org_id', tenantId)
      .eq('code', normalized);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      logger.error('CustomerCategoryService.isCodeAvailable failed', new Error(error.message), {
        tenantId,
        code: normalized,
        feature: 'customer_category',
      });
      return false;
    }

    return !data || data.length === 0;
  }

  /**
   * Create customer category
   */
  static async create(
    supabase: SupabaseClient,
    tenantId: string,
    input: CreateCustomerCategoryInput,
    userId: string,
    userName?: string
  ): Promise<CustomerCategoryItem> {
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!code) {
      throw new Error('Code is required');
    }

    const available = await this.isCodeAvailable(supabase, tenantId, code);
    if (!available) {
      throw new Error(`Code '${code}' is already in use`);
    }

    const categoryData = {
      tenant_org_id: tenantId,
      code,
      name: input.name.trim(),
      name2: input.name2?.trim() || null,
      system_category_code: null, // tenant-created
      system_type: input.system_type?.toLowerCase() || 'walk_in',
      is_b2b: input.is_b2b ?? false,
      is_individual: input.is_individual ?? true,
      display_order: input.display_order ?? 0,
      is_active: input.is_active ?? true,
      created_by: userId,
      created_info: userName || userId,
      rec_status: 1,
    };

    const { data, error } = await supabase
      .from('org_customer_category_cf')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      logger.error('CustomerCategoryService.create failed', new Error(error.message), {
        tenantId,
        code,
        feature: 'customer_category',
      });
      throw error;
    }

    return data as CustomerCategoryItem;
  }

  /**
   * Update customer category
   */
  static async update(
    supabase: SupabaseClient,
    tenantId: string,
    code: string,
    input: UpdateCustomerCategoryInput,
    userId: string,
    userName?: string
  ): Promise<CustomerCategoryItem> {
    const existing = await this.getByCode(supabase, tenantId, code);
    if (!existing) {
      throw new Error(`Customer category '${code}' not found`);
    }

    // System categories (system_category_code) - only allow name, name2, display_order, is_active
    const isSystemCategory = !!existing.system_category_code;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
      updated_info: userName || userId,
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.name2 !== undefined) updateData.name2 = input.name2?.trim() || null;
    if (input.display_order !== undefined) updateData.display_order = input.display_order;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    if (!isSystemCategory) {
      if (input.system_type !== undefined) updateData.system_type = input.system_type;
      if (input.is_b2b !== undefined) updateData.is_b2b = input.is_b2b;
      if (input.is_individual !== undefined) updateData.is_individual = input.is_individual;
    }

    const { data, error } = await supabase
      .from('org_customer_category_cf')
      .update(updateData)
      .eq('tenant_org_id', tenantId)
      .eq('code', code.toUpperCase())
      .select()
      .single();

    if (error) {
      logger.error('CustomerCategoryService.update failed', new Error(error.message), {
        tenantId,
        code,
        feature: 'customer_category',
      });
      throw error;
    }

    return data as CustomerCategoryItem;
  }

  /**
   * Delete customer category (only tenant-created, not system)
   */
  static async delete(
    supabase: SupabaseClient,
    tenantId: string,
    code: string
  ): Promise<void> {
    const existing = await this.getByCode(supabase, tenantId, code);
    if (!existing) {
      throw new Error(`Customer category '${code}' not found`);
    }

    if (existing.system_category_code) {
      throw new Error('Cannot delete system category. System categories are reserved.');
    }

    const { error } = await supabase
      .from('org_customer_category_cf')
      .delete()
      .eq('tenant_org_id', tenantId)
      .eq('code', code.toUpperCase());

    if (error) {
      logger.error('CustomerCategoryService.delete failed', new Error(error.message), {
        tenantId,
        code,
        feature: 'customer_category',
      });
      throw error;
    }
  }
}
