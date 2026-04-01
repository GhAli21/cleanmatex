import { getLocale, getTranslations } from 'next-intl/server';
import {
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { ErpLiteReportingService } from '@/lib/services/erp-lite-reporting.service';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';

export default async function ErpLiteBranchPlPage() {
  const t = await getTranslations('erpLite.branchPl');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const rows = await ErpLiteReportingService.getBranchProfitability(locale);
  const totalRevenue = rows.reduce((sum, row) => sum + row.direct_revenue, 0);
  const totalExpense = rows.reduce((sum, row) => sum + row.direct_expense, 0);
  const totalProfit = rows.reduce((sum, row) => sum + row.direct_profit, 0);

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED}
      permissions={['erp_lite_branch_pl:view']}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('summary.revenue')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="text-2xl font-semibold">
              {totalRevenue.toFixed(4)}
            </CmxCardContent>
          </CmxCard>
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('summary.expense')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="text-2xl font-semibold">
              {totalExpense.toFixed(4)}
            </CmxCardContent>
          </CmxCard>
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('summary.profit')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="text-2xl font-semibold">
              {totalProfit.toFixed(4)}
            </CmxCardContent>
          </CmxCard>
        </div>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('list.title')}</CmxCardTitle>
            <CmxCardDescription>{t('list.subtitle')}</CmxCardDescription>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('list.columns.branch')}</th>
                    <th className="px-3 py-2 text-right">{t('list.columns.revenue')}</th>
                    <th className="px-3 py-2 text-right">{t('list.columns.expense')}</th>
                    <th className="px-3 py-2 text-right">{t('list.columns.profit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        {t('list.empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.branch_id ?? 'unassigned'} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{row.branch_name}</td>
                        <td className="px-3 py-2 text-right">{row.direct_revenue.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right">{row.direct_expense.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right">{row.direct_profit.toFixed(4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CmxCardContent>
        </CmxCard>
      </div>
    </ErpLitePageGuard>
  );
}
