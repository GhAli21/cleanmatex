'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, FileText, Link as LinkIcon } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import { commitHqCopyImportAction, previewHqCopyImportAction } from '@/app/actions/fx/import-actions';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';
import type { HqCopyPreviewResult, HqCopyPreviewRow } from '@/lib/types/currency-fx';

interface ImportTabProps {
  onImported: () => void;
}

export function ImportTab({ onImported }: ImportTabProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [isPreviewing, startPreview] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const [preview, setPreview] = useState<HqCopyPreviewResult | null>(null);

  const canImport = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT);

  const handlePreview = () => {
    startPreview(async () => {
      const result = await previewHqCopyImportAction({});
      if (result.success && result.data) {
        setPreview(result.data);
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const handleCommit = () => {
    if (!preview) return;
    startCommit(async () => {
      const result = await commitHqCopyImportAction(preview.batchId);
      if (result.success && result.data) {
        cmxMessage.success(t('import.hqCopy.committed', { count: result.data.committedCount }));
        if (result.data.skippedDuplicates > 0) {
          cmxMessage.info(t('import.hqCopy.skippedDuplicates', { count: result.data.skippedDuplicates }));
        }
        setPreview(null);
        onImported();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const validCount = preview?.rows.filter((r) => !r.isDuplicate).length ?? 0;

  return (
    <div className="space-y-6">
      <CmxCard>
        <CmxCardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">{t('import.hqCopy.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('import.hqCopy.description')}</p>
            </div>
            {canImport && (
              <CmxButton variant="outline" onClick={handlePreview} disabled={isPreviewing}>
                <Download className="h-4 w-4 me-2" />
                {isPreviewing ? t('import.hqCopy.previewing') : t('import.hqCopy.preview')}
              </CmxButton>
            )}
          </div>

          {isPreviewing && <CmxSkeletonTable rows={3} columns={4} showHeader />}

          {!isPreviewing && preview && preview.rows.length === 0 && (
            <CmxEmptyState icon={<Download className="h-8 w-8" />} title={t('import.hqCopy.empty')} />
          )}

          {!isPreviewing && preview && preview.rows.length > 0 && (
            <>
              <CmxDataTable
                columns={[
                  { key: 'pair', header: t('rates.pair'), render: (r: HqCopyPreviewRow) => <span className="font-mono">{r.fromCurrencyCode} → {r.toCurrencyCode}</span> },
                  { key: 'source', header: t('rates.source'), render: (r: HqCopyPreviewRow) => r.sourceCode },
                  { key: 'rateDate', header: t('rates.rateDate'), render: (r: HqCopyPreviewRow) => r.rateDate },
                  { key: 'rate', header: t('rates.rate'), render: (r: HqCopyPreviewRow) => <span className="font-mono">{r.rate}</span> },
                  {
                    key: 'status',
                    header: '',
                    render: (r: HqCopyPreviewRow) => (r.isDuplicate ? <Badge variant="outline">{t('import.hqCopy.duplicateBadge')}</Badge> : null),
                  },
                ]}
                data={preview.rows}
              />
              {canImport && (
                <div className="flex justify-end">
                  <CmxButton onClick={handleCommit} disabled={isCommitting || validCount === 0}>
                    {isCommitting ? t('import.hqCopy.committing') : `${t('import.hqCopy.commit')} (${validCount})`}
                  </CmxButton>
                </div>
              )}
            </>
          )}
        </CmxCardContent>
      </CmxCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <CmxCard className="opacity-70">
          <CmxCardContent className="space-y-2 p-5">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('import.comingSoon.csv.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('import.comingSoon.csv.description')}</p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard className="opacity-70">
          <CmxCardContent className="space-y-2 p-5">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('import.comingSoon.excel.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('import.comingSoon.excel.description')}</p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard className="opacity-70">
          <CmxCardContent className="space-y-2 p-5">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('import.comingSoon.url.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('import.comingSoon.url.description')}</p>
          </CmxCardContent>
        </CmxCard>
      </div>
    </div>
  );
}
