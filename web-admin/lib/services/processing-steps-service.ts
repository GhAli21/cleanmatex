/**
 * ProcessingStepsService
 * Service for fetching processing steps configuration per service category
 * Supports tenant overrides with inheritance from system defaults
 */

import { createClient } from '@/lib/supabase/server';

export interface ProcessingStepConfig {
  step_code: string;
  step_seq: number;
  step_name: string;
  step_name2: string | null;
  step_color: string | null;
  step_icon: string | null;
  is_active: boolean;
  display_order: number;
}

export interface GetProcessingStepsParams {
  tenantId: string;
  serviceCategoryCode: string;
}

export interface GetProcessingStepsResult {
  success: boolean;
  steps?: ProcessingStepConfig[];
  error?: string;
}

export class ProcessingStepsService {
  /**
   * Get processing steps for a service category
   * Checks tenant override first, then falls back to system defaults
   * 
   * @param params - Tenant ID and service category code
   * @returns Processing steps with color/icon information, ordered by step_seq
   */
  static async getProcessingStepsForCategory(
    params: GetProcessingStepsParams
  ): Promise<GetProcessingStepsResult> {
    try {
      const supabase = await createClient();
      const { tenantId, serviceCategoryCode } = params;

      if (!tenantId || !serviceCategoryCode) {
        return {
          success: false,
          error: 'Tenant ID and service category code are required',
        };
      }

      // First, check for tenant-specific overrides
      const { data: tenantSteps, error: tenantError } = await supabase
        .from('org_svc_cat_proc_steps_cf')
        .select('step_code, step_seq, step_name, step_name2, step_color, step_icon, is_active, display_order')
        .eq('tenant_org_id', tenantId)
        .eq('service_category_code', serviceCategoryCode)
        .eq('is_active', true)
        .order('step_seq', { ascending: true });

      if (tenantError) {
        console.error('Error fetching tenant processing steps:', tenantError);
        // Continue to system defaults even if tenant query fails
      }

      // If tenant has overrides, use them
      if (tenantSteps && tenantSteps.length > 0) {
        return {
          success: true,
          steps: tenantSteps.map(step => ({
            step_code: step.step_code,
            step_seq: step.step_seq,
            step_name: step.step_name,
            step_name2: step.step_name2,
            step_color: step.step_color,
            step_icon: step.step_icon,
            is_active: step.is_active,
            display_order: step.display_order || step.step_seq,
          })),
        };
      }

      // Fall back to system defaults
      const { data: systemSteps, error: systemError } = await supabase
        .from('sys_svc_cat_proc_steps')
        .select('step_code, step_seq, step_name, step_name2, step_color, step_icon, is_active, display_order')
        .eq('service_category_code', serviceCategoryCode)
        .eq('is_active', true)
        .order('step_seq', { ascending: true });

      if (systemError) {
        return {
          success: false,
          error: `Failed to fetch processing steps: ${systemError.message}`,
        };
      }

      if (!systemSteps || systemSteps.length === 0) {
        return {
          success: false,
          error: `No processing steps configured for service category: ${serviceCategoryCode}`,
        };
      }

      return {
        success: true,
        steps: systemSteps.map(step => ({
          step_code: step.step_code,
          step_seq: step.step_seq,
          step_name: step.step_name,
          step_name2: step.step_name2,
          step_color: step.step_color,
          step_icon: step.step_icon,
          is_active: step.is_active,
          display_order: step.display_order || step.step_seq,
        })),
      };
    } catch (error) {
      console.error('ProcessingStepsService.getProcessingStepsForCategory error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate if a step code is valid for a service category
   * 
   * @param params - Tenant ID, service category code, and step code to validate
   * @returns True if step is valid for the category
   */
  static async isValidStepForCategory(
    tenantId: string,
    serviceCategoryCode: string,
    stepCode: string
  ): Promise<boolean> {
    try {
      const result = await this.getProcessingStepsForCategory({
        tenantId,
        serviceCategoryCode,
      });

      if (!result.success || !result.steps) {
        return false;
      }

      return result.steps.some(step => step.step_code === stepCode && step.is_active);
    } catch (error) {
      console.error('ProcessingStepsService.isValidStepForCategory error:', error);
      return false;
    }
  }

  /**
   * Get all valid step codes for a service category
   * 
   * @param params - Tenant ID and service category code
   * @returns Array of valid step codes
   */
  static async getValidStepCodes(
    params: GetProcessingStepsParams
  ): Promise<string[]> {
    try {
      const result = await this.getProcessingStepsForCategory(params);

      if (!result.success || !result.steps) {
        return [];
      }

      return result.steps
        .filter(step => step.is_active)
        .map(step => step.step_code);
    } catch (error) {
      console.error('ProcessingStepsService.getValidStepCodes error:', error);
      return [];
    }
  }
}

