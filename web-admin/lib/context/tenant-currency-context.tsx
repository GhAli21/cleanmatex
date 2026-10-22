'use client';

/**
 * Resolved tenant money settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES) for dashboard UI.
 * Loaded once per tenant session; refreshes when `currentTenant` changes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { getCurrencyConfigOutcomeAction } from '@/app/actions/tenant/get-currency-config';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import {
  formatMoneyAmount,
  formatMoneyAmountWithCode,
  roundMoneyAmount,
  type MoneyAmountInput,
  type MoneyLocale,
} from '@/lib/money/format-money';

/** Resolution state of the organization currency authority for display consumers. */
export type TenantCurrencyConfigStatus =
  | 'loading'
  | 'ready'
  | 'missing-config'
  | 'unavailable';

/** Shared display currency state; payment and posting flows must still enforce their own fail-closed gate. */
export interface TenantCurrencyContextValue {
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
  /** False while loading or when the organization currency cannot be verified. */
  isReady: boolean;
  /** Explains why formatting is currently display-only rather than configuration-backed. */
  status: TenantCurrencyConfigStatus;
  /** Resolved UI locale ('en' | 'ar') already used for `formatMoney`/`formatMoneyWithCode`. */
  moneyLocale: MoneyLocale;
  /**
   * A3-4 (POS Session & Cash Drawer Hardening): `amount` accepts the exact
   * fixed-point string form the drawer/POS-session APIs now return, not just
   * a JS number. `currencyCode` optionally overrides the tenant's own
   * currency — needed for a row whose currency differs from the tenant
   * default (a multi-currency session, D14).
   */
  formatMoney: (
    amount: MoneyAmountInput,
    currencyCode?: string | null,
  ) => string;
  /** Same digits as formatMoney but `12.500 OMR` style */
  formatMoneyWithCode: (
    amount: MoneyAmountInput,
    currencyCode?: string | null,
  ) => string;
  roundMoney: (amount: MoneyAmountInput) => number;
  refresh: () => Promise<void>;
}

const TenantCurrencyContext = createContext<TenantCurrencyContextValue | null>(
  null,
);

function toMoneyLocale(locale: string): MoneyLocale {
  return locale === 'ar' ? 'ar' : 'en';
}

/**
 *
 * @param root0
 * @param root0.children
 */
export function TenantCurrencyProvider({ children }: { children: ReactNode }) {
  const { currentTenant, user, isLoading } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const userId = user?.id;
  const intlLocale = useLocale();
  const moneyLocale = toMoneyLocale(intlLocale);

  // B15: '' until resolved — formatters render plain numbers, never a default code.
  const [currencyCode, setCurrencyCode] = useState<string>('');
  const [decimalPlaces, setDecimalPlaces] = useState<number>(
    ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
  );
  const [currencyExRate, setCurrencyExRate] = useState(1);
  const [status, setStatus] = useState<TenantCurrencyConfigStatus>(
    currentTenant ? 'loading' : 'ready',
  );
  const isReady = status === 'ready';

  const load = useCallback(async () => {
    if (!tenantId) {
      setCurrencyCode('');
      setDecimalPlaces(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES);
      setCurrencyExRate(1);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    const outcome = await getCurrencyConfigOutcomeAction(
      tenantId,
      undefined,
      userId,
    );
    if ('config' in outcome) {
      const { config: cfg } = outcome;
      setCurrencyCode(cfg.currencyCode || '');
      setDecimalPlaces(
        Number.isFinite(cfg.decimalPlaces) && cfg.decimalPlaces >= 0
          ? cfg.decimalPlaces
          : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
      );
      setCurrencyExRate(
        typeof cfg.currencyExRate === 'number' &&
          Number.isFinite(cfg.currencyExRate)
          ? cfg.currencyExRate
          : 1,
      );
      setStatus('ready');
      return;
    }

    setCurrencyCode('');
    setDecimalPlaces(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES);
    setCurrencyExRate(1);
    setStatus(
      outcome.code === 'MISSING_TENANT_CURRENCY'
        ? 'missing-config'
        : 'unavailable',
    );
  }, [tenantId, userId]);

  useEffect(() => {
    if (isLoading) return;

    // Defer the async state transition so the effect only schedules synchronization.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoading, load]);

  const formatMoney = useCallback(
    (amount: MoneyAmountInput, overrideCurrencyCode?: string | null) =>
      formatMoneyAmount(amount, {
        currencyCode: overrideCurrencyCode || currencyCode,
        decimalPlaces,
        locale: moneyLocale,
      }),
    [currencyCode, decimalPlaces, moneyLocale],
  );

  const formatMoneyWithCodeCb = useCallback(
    (amount: MoneyAmountInput, overrideCurrencyCode?: string | null) =>
      formatMoneyAmountWithCode(amount, {
        currencyCode: overrideCurrencyCode || currencyCode,
        decimalPlaces,
        locale: moneyLocale,
      }),
    [currencyCode, decimalPlaces, moneyLocale],
  );

  const roundMoney = useCallback(
    (amount: MoneyAmountInput) => roundMoneyAmount(amount, decimalPlaces),
    [decimalPlaces],
  );

  const value = useMemo<TenantCurrencyContextValue>(
    () => ({
      currencyCode,
      decimalPlaces,
      currencyExRate,
      isReady,
      status,
      moneyLocale,
      formatMoney,
      formatMoneyWithCode: formatMoneyWithCodeCb,
      roundMoney,
      refresh: load,
    }),
    [
      currencyCode,
      currencyExRate,
      decimalPlaces,
      formatMoney,
      formatMoneyWithCodeCb,
      isReady,
      load,
      moneyLocale,
      roundMoney,
      status,
    ],
  );

  return (
    <TenantCurrencyContext.Provider value={value}>
      {children}
    </TenantCurrencyContext.Provider>
  );
}

/**
 *
 */
export function useTenantCurrency(): TenantCurrencyContextValue {
  const ctx = useContext(TenantCurrencyContext);
  if (!ctx) {
    const moneyLocale: MoneyLocale = 'en';
    // B15: '' — outside the provider money renders as plain numbers.
    const currencyCode = '';
    const decimalPlaces = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
    return {
      currencyCode,
      decimalPlaces,
      currencyExRate: 1,
      isReady: true,
      status: 'ready',
      moneyLocale,
      formatMoney: (
        amount: MoneyAmountInput,
        overrideCurrencyCode?: string | null,
      ) =>
        formatMoneyAmount(amount, {
          currencyCode: overrideCurrencyCode || currencyCode,
          decimalPlaces,
          locale: moneyLocale,
        }),
      formatMoneyWithCode: (
        amount: MoneyAmountInput,
        overrideCurrencyCode?: string | null,
      ) =>
        formatMoneyAmountWithCode(amount, {
          currencyCode: overrideCurrencyCode || currencyCode,
          decimalPlaces,
          locale: moneyLocale,
        }),
      roundMoney: (amount: MoneyAmountInput) =>
        roundMoneyAmount(amount, decimalPlaces),
      refresh: async () => {},
    };
  }
  return ctx;
}
