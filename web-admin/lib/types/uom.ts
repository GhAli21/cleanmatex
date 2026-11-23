/**
 * Unit of Measure types shared by the UoM library, services, routes and screens.
 * Quantities and rates travel as decimal strings so no precision is lost on the
 * way (QUANTITY 21,6 · RATE 28,12; docs/dev/rules/numeric-precision.md).
 */
import type { UomDimension } from '@/lib/constants/uom';

/** Where a tenant unit comes from. */
export type UomOrigin = 'SYSTEM' | 'CUSTOMIZED' | 'CUSTOM';

/** One unit an Organization can use (`org_uom_cf`), in API shape. */
export interface UomUnit {
  code: string;
  /** System unit this row copies; null for a custom unit. */
  sysCode: string | null;
  origin: UomOrigin;
  name: string;
  name2: string | null;
  symbol: string;
  symbol2: string | null;
  dimension: UomDimension;
  isBaseUnit: boolean;
  isPackaging: boolean;
  /** Decimals a quantity in this unit may carry; 0 for COUNT. */
  qtyDecimals: number;
  /** UN/ECE Rec 20 code; null on a custom unit without one. */
  uneceCode: string | null;
  isActive: boolean;
  displayOrder: number | null;
  /** Live products on this unit (list endpoint only). */
  productCount?: number;
}

/** One conversion (`org_uom_conv_cf`), in API shape. */
export interface UomConversion {
  id: string;
  /** Null: Organization-wide. */
  productId: string | null;
  fromCode: string;
  toCode: string;
  /** qty_to = qty_from × multiplyRate (decimal string). */
  multiplyRate: string;
  /** qty_from = qty_to × divideRate (decimal string). */
  divideRate: string;
  isFromSystem: boolean;
  isCustomized: boolean;
  isActive: boolean;
  notes: string | null;
}

/** The minimum a resolver needs about a unit. */
export type UomUnitFacts = Pick<UomUnit, 'code' | 'dimension' | 'isBaseUnit' | 'qtyDecimals' | 'isActive'>;

/** The minimum a resolver needs about a conversion. */
export type UomConversionFacts = Pick<UomConversion, 'productId' | 'fromCode' | 'toCode' | 'multiplyRate' | 'divideRate' | 'isActive'>;

/** The unit facts a display needs (from a unit or an order-line snapshot). */
export interface UomDisplayFacts {
  symbol: string;
  symbol2: string | null;
  qtyDecimals: number;
}
