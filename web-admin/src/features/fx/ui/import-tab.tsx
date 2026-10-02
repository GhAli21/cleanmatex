'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, FileText, Link as LinkIcon } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import { commitHqCopyImportAction, previewHqCopyImportAction, commitCsvImportAction, previewCsvImportAction, commitUrlImportAction, previewUrlImportAction } from '@/app/actions/fx/import-actions';
import { getFxSourcesAction, getActiveFxProvidersAction } from '@/app/actions/fx/lookup-actions';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';
import type {
  HqCopyPreviewResult,
  HqCopyPreviewRow,
  CsvPreviewResult,
  CsvPreviewRow,
  UrlImportPreviewResult,
  UrlImportPreviewRow,
  FxRateSourceOption,
  FxProviderOption,
} from '@/lib/types/currency-fx';

interface ImportTabProps {
  onImported: () => void;
}

export function ImportTab({ onImported }: ImportTabProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const tRowErrors = useTranslations('currencyFx.import.rowErrors');
  const [isPreviewing, startPreview] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const [preview, setPreview] = useState<HqCopyPreviewResult | null>(null);

  const canImport = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_IMPORT);

  const renderRowErrors = (codes: string[]) =>
    codes.length === 0 ? null : (
      <div className="flex flex-wrap gap-1">
        {codes.map((code) => (
          <Badge key={code} variant="destructive">
            {tRowErrors(code as Parameters<typeof tRowErrors>[0])}
          </Badge>
        ))}
      </div>
    );

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

      <CsvImportCard canImport={canImport} onImported={onImported} renderRowErrors={renderRowErrors} />
      <UrlImportCard canImport={canImport} onImported={onImported} renderRowErrors={renderRowErrors} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CmxCard className="opacity-70">
          <CmxCardContent className="space-y-2 p-5">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t('import.comingSoon.excel.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('import.comingSoon.excel.description')}</p>
          </CmxCardContent>
        </CmxCard>
      </div>
    </div>
  );
}

interface AdapterCardProps {
  canImport: boolean;
  onImported: () => void;
  renderRowErrors: (codes: string[]) => React.ReactNode;
}

function CsvImportCard({ canImport, onImported, renderRowErrors }: AdapterCardProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const fileInputId = useId();
  const [isPreviewing, startPreview] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const [sources, setSources] = useState<FxRateSourceOption[]>([]);
  const [sourceCode, setSourceCode] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getFxSourcesAction();
      if (result.success && result.data) setSources(result.data);
    })();
  }, []);

  const handlePreview = () => {
    if (!file || !sourceCode) {
      cmxMessage.error(t('import.csv.missingFile'));
      return;
    }
    startPreview(async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceCode', sourceCode);
      const result = await previewCsvImportAction(formData);
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
      const result = await commitCsvImportAction(preview.batchId);
      if (result.success && result.data) {
        cmxMessage.success(t('import.csv.committed', { count: result.data.committedCount }));
        if (result.data.skippedCount > 0) {
          cmxMessage.info(t('import.csv.skipped', { count: result.data.skippedCount }));
        }
        setPreview(null);
        setFile(null);
        onImported();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const validCount = preview?.rows.filter((r) => r.errorCodes.length === 0).length ?? 0;

  return (
    <CmxCard>
      <CmxCardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">{t('import.csv.title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('import.csv.description')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t('import.csv.sourceLabel')}</label>
            <CmxSelectDropdown value={sourceCode} onValueChange={setSourceCode}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue placeholder={t('import.csv.selectSource')} /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {sources.map((source) => (
                  <CmxSelectDropdownItem key={source.code} value={source.code}>
                    {source.name}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label htmlFor={fileInputId} className="text-sm font-medium">{t('import.csv.fileLabel')}</label>
            <input
              id={fileInputId}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('import.csv.selectedFile', { fileName: file.name, sizeKb: Math.ceil(file.size / 1024) })}
              </p>
            )}
          </div>
        </div>

        {canImport && (
          <div className="flex justify-end">
            <CmxButton variant="outline" onClick={handlePreview} disabled={isPreviewing}>
              {isPreviewing ? t('import.csv.previewing') : t('import.csv.preview')}
            </CmxButton>
          </div>
        )}

        {isPreviewing && <CmxSkeletonTable rows={3} columns={5} showHeader />}

        {!isPreviewing && preview && preview.rows.length === 0 && (
          <CmxEmptyState icon={<FileText className="h-8 w-8" />} title={t('import.csv.empty')} />
        )}

        {!isPreviewing && preview && preview.rows.length > 0 && (
          <>
            <CmxDataTable
              columns={[
                { key: 'row', header: t('import.csv.rowNumber'), render: (r: CsvPreviewRow) => r.rowNumber },
                { key: 'pair', header: t('rates.pair'), render: (r: CsvPreviewRow) => <span className="font-mono">{r.fromCurrencyCode} → {r.toCurrencyCode}</span> },
                { key: 'rateDate', header: t('rates.rateDate'), render: (r: CsvPreviewRow) => r.rateDate },
                { key: 'rate', header: t('rates.rate'), render: (r: CsvPreviewRow) => <span className="font-mono">{r.rate}</span> },
                { key: 'errors', header: t('import.csv.errorsColumn'), render: (r: CsvPreviewRow) => renderRowErrors(r.errorCodes) },
              ]}
              data={preview.rows}
            />
            {canImport && (
              <div className="flex justify-end">
                <CmxButton onClick={handleCommit} disabled={isCommitting || validCount === 0}>
                  {isCommitting ? t('import.csv.committing') : `${t('import.csv.commit')} (${validCount})`}
                </CmxButton>
              </div>
            )}
          </>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}

function UrlImportCard({ canImport, onImported, renderRowErrors }: AdapterCardProps) {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [isPreviewing, startPreview] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const [providers, setProviders] = useState<FxProviderOption[]>([]);
  const [providerCode, setProviderCode] = useState<string>('');
  const [preview, setPreview] = useState<UrlImportPreviewResult | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getActiveFxProvidersAction();
      if (result.success && result.data) setProviders(result.data);
    })();
  }, []);

  const handlePreview = () => {
    if (!providerCode) {
      cmxMessage.error(t('import.url.missingProvider'));
      return;
    }
    startPreview(async () => {
      const result = await previewUrlImportAction(providerCode);
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
      const result = await commitUrlImportAction(preview.batchId);
      if (result.success && result.data) {
        cmxMessage.success(t('import.url.committed', { count: result.data.committedCount }));
        if (result.data.skippedCount > 0) {
          cmxMessage.info(t('import.url.skipped', { count: result.data.skippedCount }));
        }
        setPreview(null);
        onImported();
      } else {
        cmxMessage.error(resolveFxErrorMessage(tErrors, result.errorCode, result.error ?? tCommon('error')));
      }
    });
  };

  const validCount = preview?.rows.filter((r) => r.errorCodes.length === 0).length ?? 0;

  return (
    <CmxCard>
      <CmxCardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <LinkIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">{t('import.url.title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('import.url.description')}</p>
          </div>
        </div>

        <div className="max-w-sm">
          <label className="text-sm font-medium">{t('import.url.providerLabel')}</label>
          <CmxSelectDropdown value={providerCode} onValueChange={setProviderCode}>
            <CmxSelectDropdownTrigger><CmxSelectDropdownValue placeholder={t('import.url.selectProvider')} /></CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              {providers.map((provider) => (
                <CmxSelectDropdownItem key={provider.code} value={provider.code}>
                  {provider.name}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>

        {canImport && (
          <div className="flex justify-end">
            <CmxButton variant="outline" onClick={handlePreview} disabled={isPreviewing}>
              {isPreviewing ? t('import.url.previewing') : t('import.url.preview')}
            </CmxButton>
          </div>
        )}

        {isPreviewing && <CmxSkeletonTable rows={3} columns={4} showHeader />}

        {!isPreviewing && preview && (
          <p className="text-xs text-muted-foreground">{t('import.url.feedDate', { date: preview.feedRateDate })}</p>
        )}

        {!isPreviewing && preview && preview.rows.length === 0 && (
          <CmxEmptyState icon={<LinkIcon className="h-8 w-8" />} title={t('import.url.empty')} />
        )}

        {!isPreviewing && preview && preview.rows.length > 0 && (
          <>
            <CmxDataTable
              columns={[
                { key: 'pair', header: t('rates.pair'), render: (r: UrlImportPreviewRow) => <span className="font-mono">{r.fromCurrencyCode} → {r.toCurrencyCode}</span> },
                { key: 'rateDate', header: t('rates.rateDate'), render: (r: UrlImportPreviewRow) => r.rateDate },
                { key: 'rate', header: t('rates.rate'), render: (r: UrlImportPreviewRow) => <span className="font-mono">{r.rate}</span> },
                { key: 'errors', header: t('import.csv.errorsColumn'), render: (r: UrlImportPreviewRow) => renderRowErrors(r.errorCodes) },
              ]}
              data={preview.rows}
            />
            {canImport && (
              <div className="flex justify-end">
                <CmxButton onClick={handleCommit} disabled={isCommitting || validCount === 0}>
                  {isCommitting ? t('import.url.committing') : `${t('import.url.commit')} (${validCount})`}
                </CmxButton>
              </div>
            )}
          </>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}
