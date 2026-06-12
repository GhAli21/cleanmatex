/**
 * @deprecated Import from `@/lib/constants/settlement-catalog` instead.
 * Re-exports for backward compatibility during Phase 1 rollout.
 */

export {
  OVERPAYMENT_RESOLUTIONS as OVERPAYMENT_DISPOSITION_TYPES,
  SETTLEMENT_MONEY_EPSILON as OVERPAYMENT_DISPOSITION_MONEY_EPSILON,
  OVERPAYMENT_RESOLUTION_ERROR_CODES as OVERPAYMENT_DISPOSITION_ERROR_CODES,
  OVERPAYMENT_RESOLUTION_PERMISSIONS as OVERPAYMENT_DISPOSITION_PERMISSIONS,
  type OverpaymentResolutionCode as OverpaymentDispositionType,
  type OverpaymentResolutionErrorCode as OverpaymentDispositionErrorCode,
} from '@/lib/constants/settlement-catalog';
