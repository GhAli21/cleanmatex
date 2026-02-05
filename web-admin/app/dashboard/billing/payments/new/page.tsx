/**
 * Create New Payment Page — Server Component
 *
 * Fetches available payment methods, payment types, and tenant currency;
 * renders the create form.
 * Route: /dashboard/billing/payments/new
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getAvailablePaymentMethods,
  getAvailablePaymentTypes,
} from '@/lib/services/payment-service';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import CreatePaymentForm from './create-payment-form';

export default async function CreatePaymentPage() {
  const t = await getTranslations('payments.create');

  const auth = await getAuthContext();

  const [methods, types, currencyConfig] = await Promise.all([
    getAvailablePaymentMethods(),
    getAvailablePaymentTypes(),
    getCurrencyConfigAction(auth.tenantId),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
      </div>
      <CreatePaymentForm
        paymentMethods={methods
          .filter((m) => m.payment_method_code !== 'PAY_ON_COLLECTION')
          .map((m) => ({
            code: m.payment_method_code,
            name: m.payment_method_name,
          }))}
        paymentTypes={types.map((t) => ({
          code: t.payment_type_code,
          name: t.payment_type_name,
        }))}
        defaultCurrencyCode={currencyConfig.currencyCode}
      />
    </div>
  );
}
