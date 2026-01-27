/**
 * Order Defaults Constants
 * Centralized configuration for order creation defaults
 */

/**
 * Order Defaults Configuration
 */
export const ORDER_DEFAULTS = {
  CURRENCY: 'OMR',
  DEBOUNCE_MS: {
    ESTIMATION: 400,
    SEARCH: 300,
  },
  RETRY: {
    COUNT: 2,
    DELAYS: [1000, 2000],
  },
  LIMITS: {
    PRODUCTS_PER_CATEGORY: 100,
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

