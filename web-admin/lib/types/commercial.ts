/**
 * Commercial calculator — TypeScript types (Line-Level Money Snapshot, ADR-060).
 * Import constants-derived types from commercial constants; re-export here for
 * single-import usage by callers that only need types.
 */

import type {
  CommercialLevel,
  DiscAllocBasis,
  DiscAllocMode,
  PriceBasis,
  ServiceSpeed,
  SpeedPriceType,
  TaxCategory,
} from '@/lib/constants/commercial';

export type {
  CommercialLevel,
  DiscAllocBasis,
  DiscAllocMode,
  PriceBasis,
  ServiceSpeed,
  SpeedPriceType,
  TaxCategory,
};

/** One row of `sys_service_speed_cd`, as read for pickers/admin screens. */
export interface ServiceSpeedOption {
  code: ServiceSpeed;
  name: string;
  name2: string | null;
  isDefault: boolean;
  displayOrder: number;
}

/** One row of `sys_tax_category_cd`, as read for pickers/admin screens. */
export interface TaxCategoryOption {
  code: TaxCategory;
  name: string;
  name2: string | null;
  uncl5305Code: string;
  isDefault: boolean;
  displayOrder: number;
}

/**
 * One row of `org_speed_price_rules_cf`, as read by the resolver and the
 * Phase 7 rules admin screen. Exactly one of `defaultSpeedSellPrice` /
 * `multiplierSpeed` / `speedExtraAmount` is non-null, matching `speedPriceType`.
 */
export interface SpeedPriceRule {
  id: string;
  tenantOrgId: string;
  serviceSpeed: ServiceSpeed;
  branchId: string | null;
  serviceCategoryCode: string | null;
  productId: string | null;
  speedPriceType: SpeedPriceType;
  defaultSpeedSellPrice: number | null;
  multiplierSpeed: number | null;
  speedExtraAmount: number | null;
  priceBasis: PriceBasis | null;
  turnaroundHhSpeed: number | null;
  name: string | null;
  name2: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}
