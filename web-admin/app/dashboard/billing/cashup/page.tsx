/**
 * Cash Up Page
 *
 * End-of-day reconciliation: compare expected amounts (from system) with actual
 * counted amounts by payment method. Route: /dashboard/billing/cashup
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { getCashUpData } from '@/app/actions/billing/cashup-actions';
import CashUpContent from '@features/billing/ui/cashup-content';

type CashUpSearchParams = {
  date?: string;
};

interface PageProps {
  searchParams?: Promise<CashUpSearchParams>;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function CashUpPage({ searchParams }: PageProps) {
  const t = await getTranslations('cashup');
  const tCommon = await getTranslations('common');

  let tenantOrgId: string;
  try {
    const authContext = await getAuthContext();
    tenantOrgId = authContext.tenantId;
  } catch (error) {
    console.error('[CashUpPage] Auth error:', error);
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error
            ? error.message
            : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  const resolved = await searchParams;
  const dateParam = resolved?.date;
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayYYYYMMDD();

  const [cashUpResult, currencyResult] = await Promise.all([
    getCashUpData(selectedDate),
    getCurrencyConfigAction(tenantOrgId).catch(() => ({ currencyCode: ORDER_DEFAULTS.CURRENCY, decimalPlaces: ORDER_DEFAULTS.PRICE.DECIMAL_PLACES, currencyExRate: 1 })),
  ]);

  const currencyCode =
    currencyResult && typeof currencyResult === 'object' && 'currencyCode' in currencyResult
      ? String(currencyResult.currencyCode)
      : ORDER_DEFAULTS.CURRENCY;

  if (!cashUpResult.success) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {cashUpResult.error}
        </div>
      </div>
    );
  }

  const data = cashUpResult.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-gray-600">{t('description')}</p>
      </div>

      <CashUpContent
        data={data}
        selectedDate={selectedDate}
        currencyCode={currencyCode}
      />
    </div>
  );
}
