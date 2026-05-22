import { getTranslations } from 'next-intl/server';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { ArInvoiceCreateWizard } from '@features/ar/ui/ar-invoice-create-wizard';

export default async function NewArInvoicePage() {
  const t = await getTranslations('invoices.ar.create');

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('wizardTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <ArInvoiceCreateWizard />
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
