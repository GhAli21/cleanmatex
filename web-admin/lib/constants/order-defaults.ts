/**
 * Order Defaults Constants
 * Centralized configuration for order creation defaults
 */

/**
 * Order Defaults Configuration
 */
// B15: ORDER_DEFAULTS deliberately has NO currency default. Currency is always
// resolved (tenant settings / branch / order row) or the operation fails
// loudly — see lib/money/currency-resolution.ts and the no-locale-defaults
// rule (CLAUDE.md database rules).
export const ORDER_DEFAULTS = {
  DEBOUNCE_MS: {
    ESTIMATION: 400,
    SEARCH: 300,
  },
  RETRY: {
    COUNT: 2,
    DELAYS: [1000, 2000],
  },
  LIMITS: {
    PRODUCTS_PER_CATEGORY: 20,
    PRODUCTS_PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
    QUANTITY_MIN: 1,
    QUANTITY_MAX: 999,
    ITEMS_HIGH_THRESHOLD: 10,
    MAX_PHOTOS: 10,
  },
  PRICE: {
    MIN: 0.001,
    STEP: 0.001,
    DECIMAL_PLACES: 3,
  },
  CACHE: {
    CATEGORIES_STALE_TIME: 5 * 60 * 1000, // 5 minutes
    PRODUCTS_STALE_TIME: 2 * 60 * 1000, // 2 minutes
  },
  FOCUS_DELAY: 100, // Delay for focusing elements after modal opens (ms)
} as const;

