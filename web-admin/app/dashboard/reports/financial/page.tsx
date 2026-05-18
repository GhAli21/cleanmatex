import { getTranslations } from 'next-intl/server';
import { FinancialReportsClient } from '@features/reports/ui/financial-reports-client';

export default async function FinancialReportsPage() {
  const t = await getTranslations('reports.financial');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </div>
      <FinancialReportsClient />
    </div>
  );
}
