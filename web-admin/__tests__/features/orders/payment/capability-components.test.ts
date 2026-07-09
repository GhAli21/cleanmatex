jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import {
  CAPABILITY_COMPONENTS,
  hasCapabilityComponent,
  type CapabilityComponentKey,
} from '@features/orders/payment/capabilities/capability-components';
import {
  PAYMENT_CAPABILITY,
  PAYMENT_CAPABILITY_KEYS,
} from '@features/orders/payment/capabilities/capability-keys';

/**
 * Capabilities intentionally WITHOUT a dedicated component — rendered inline by
 * the view (method chips) or as the aggregate submit-guard banner.
 */
const REGISTRY_INLINE_KEYS = [
  PAYMENT_CAPABILITY.CASH,
  PAYMENT_CAPABILITY.CARD,
  PAYMENT_CAPABILITY.SUBMIT_GUARDS,
] as const;

describe('CAPABILITY_COMPONENTS (key → component wiring)', () => {
  it('maps exactly the capabilities that have a dedicated component', () => {
    const expected: CapabilityComponentKey[] = [
      PAYMENT_CAPABILITY.CASH_CARD_SPLIT,
      PAYMENT_CAPABILITY.SPLIT_TENDER,
      PAYMENT_CAPABILITY.GIFT_CARD,
      PAYMENT_CAPABILITY.PROMO_CODE,
      PAYMENT_CAPABILITY.CUSTOMER_CREDIT,
      PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
      PAYMENT_CAPABILITY.CASH_DRAWER,
      PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
      PAYMENT_CAPABILITY.PAY_LATER,
      PAYMENT_CAPABILITY.FX_ROUNDING,
    ];
    expect(new Set(Object.keys(CAPABILITY_COMPONENTS))).toEqual(new Set(expected));
  });

  it('binds every mapped key to a renderable component', () => {
    for (const component of Object.values(CAPABILITY_COMPONENTS)) {
      expect(typeof component).toBe('function');
    }
  });

  it('surfaces both split shortcuts through the same split-tender dialog', () => {
    expect(CAPABILITY_COMPONENTS.CASH_CARD_SPLIT).toBe(CAPABILITY_COMPONENTS.SPLIT_TENDER);
  });

  it('excludes the registry-inline capabilities', () => {
    for (const key of REGISTRY_INLINE_KEYS) {
      expect(hasCapabilityComponent(key)).toBe(false);
    }
  });

  it('accounts for every capability key (mapped xor registry-inline — none forgotten)', () => {
    for (const key of PAYMENT_CAPABILITY_KEYS) {
      const mapped = hasCapabilityComponent(key);
      const inline = (REGISTRY_INLINE_KEYS as readonly string[]).includes(key);
      expect(mapped !== inline).toBe(true);
    }
  });
});
