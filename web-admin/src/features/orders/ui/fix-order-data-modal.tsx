/**
 * Fix Order Data Modal
 * Runs fix_order_data for the current order and shows per-step results.
 * Sections: (1) Pieces fix  (2) Product names fix
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  Wrench,
  Loader2,
  CheckCircle,
  AlertCircle,
  MinusCircle,
  Tag,
  Package,
  ChevronRight,
} from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { Alert, AlertDescription } from '@ui/primitives';

export interface FixOrderDataStepResult {
  step_id: string;
  status: 'success' | 'error' | 'skipped';
  summary: string | null;
  details: {
    items_adjusted?: number;
    items_fixed?: number;
    pieces_added?: number;
    pieces_removed?: number;
    dry_run?: boolean;
    item_results?: Array<{
      order_item_id: string;
      order_item_srno: string;
      action: string;
      count: number;
    }>;
  } | null;
  error_message: string | null;
}

export interface FixOrderDataResult {
  overall: 'success' | 'partial' | 'error';
  steps: FixOrderDataStepResult[];
  dry_run?: boolean;
}

interface FixOrderDataModalProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type SectionKey = 'pieces' | 'productNames';

interface SectionState {
  checking: boolean;
  running: boolean;
  result: FixOrderDataResult | null;
  apiError: string | null;
}

const INITIAL_SECTION: SectionState = {
  checking: false,
  running: false,
  result: null,
  apiError: null,
};

export function FixOrderDataModal({
  orderId,
  open,
  onOpenChange,
  onSuccess,
}: FixOrderDataModalProps) {
  const t = useTranslations('orders.fixOrderDataModal');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    pieces: { ...INITIAL_SECTION },
    productNames: { ...INITIAL_SECTION },
  });

  const updateSection = useCallback((key: SectionKey, patch: Partial<SectionState>) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const callApi = useCallback(
    async (steps: string[], dryRun: boolean): Promise<FixOrderDataResult | null> => {
      const res = await fetch(`/api/v1/orders/${orderId}/fix-order-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, dryRun }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return null;
      return json.data as FixOrderDataResult;
    },
    [orderId]
  );

  const handleSectionAction = useCallback(
    async (key: SectionKey, steps: string[], dryRun: boolean) => {
      updateSection(key, {
        checking: dryRun,
        running: !dryRun,
        result: null,
        apiError: null,
      });
      try {
        const data = await callApi(steps, dryRun);
        if (data) {
          updateSection(key, { result: data, checking: false, running: false });
        } else {
          updateSection(key, {
            apiError: t('errorMessage'),
            checking: false,
            running: false,
          });
        }
      } catch {
        updateSection(key, {
          apiError: t('errorMessage'),
          checking: false,
          running: false,
        });
      }
    },
    [callApi, t, updateSection]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSections({ pieces: { ...INITIAL_SECTION }, productNames: { ...INITIAL_SECTION } });
  }, [onOpenChange]);

  const handleRefresh = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [onSuccess, handleClose]);

  const getActionLabel = (action: string): string => {
    if (action === 'added_pieces') return t('stepActionAdded');
    if (action === 'removed_pieces') return t('stepActionRemoved');
    return t('stepActionAdjusted');
  };

  const anyBusy = Object.values(sections).some((s) => s.checking || s.running);
  const anyApplied = Object.values(sections).some(
    (s) => s.result && !s.result.dry_run
  );

  const renderStepResult = (step: FixOrderDataStepResult) => (
    <div
      key={step.step_id}
      className={`rounded-lg border p-3 space-y-1.5 ${
        step.status === 'error'
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50'
      } ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {step.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
        {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
        {step.status === 'skipped' && <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />}
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            step.status === 'success'
              ? 'text-green-700 dark:text-green-400'
              : step.status === 'error'
                ? 'text-red-700 dark:text-red-400'
                : 'text-gray-500'
          }`}
        >
          {step.status === 'success' && t('stepStatusSuccess')}
          {step.status === 'error' && t('stepStatusError')}
          {step.status === 'skipped' && t('stepStatusSkipped')}
        </span>
      </div>
      {step.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300">{step.summary}</p>
      )}
      {step.status === 'success' && !step.summary && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('stepNoChanges')}</p>
      )}
      {step.details && (
        <div className={`pt-1 ${isRTL ? 'pr-5' : 'pl-5'} text-xs text-gray-600 dark:text-gray-400 space-y-0.5`}>
          {step.details.items_adjusted != null && (
            <p>
              {step.details.dry_run
                ? t('detailsItemsWouldBeAdjusted', { count: step.details.items_adjusted })
                : `${t('stepDetailsItemsAdjusted')}: ${step.details.items_adjusted}`}
            </p>
          )}
          {step.details.items_fixed != null && (
            <p>
              {step.details.dry_run
                ? t('detailsItemsWouldBeFixed', { count: step.details.items_fixed })
                : `${t('stepDetailsItemsFixed')}: ${step.details.items_fixed}`}
            </p>
          )}
          {step.details.pieces_added != null && (
            <p>
              {step.details.dry_run
                ? t('detailsPiecesWouldBeAdded', { count: step.details.pieces_added })
                : `${t('stepDetailsPiecesAdded')}: ${step.details.pieces_added}`}
            </p>
          )}
          {step.details.pieces_removed != null && (
            <p>
              {step.details.dry_run
                ? t('detailsPiecesWouldBeRemoved', { count: step.details.pieces_removed })
                : `${t('stepDetailsPiecesRemoved')}: ${step.details.pieces_removed}`}
            </p>
          )}
          {step.details.item_results && step.details.item_results.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {step.details.item_results.map((ir, idx) => (
                <li key={idx}>
                  {t('stepItemAdjusted', {
                    srno: ir.order_item_srno || ir.order_item_id?.slice(0, 8),
                    action: getActionLabel(ir.action),
                    count: ir.count,
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {step.status === 'error' && step.error_message && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{step.error_message}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderSection = ({
    sectionKey,
    icon: Icon,
    titleKey,
    descKey,
    steps,
    checkHintKey,
    runHintKey,
  }: {
    sectionKey: SectionKey;
    icon: React.ElementType;
    titleKey: string;
    descKey: string;
    steps: string[];
    checkHintKey: string;
    runHintKey: string;
  }) => {
    const s = sections[sectionKey];
    const isActive = s.checking || s.running;
    const isDone = !!s.result;

    return (
      <div className={`rounded-xl border ${isDone ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900/30`}>
        {/* Section header */}
        <div className={`flex items-start gap-3 p-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="mt-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-2 shrink-0">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : ''}`}>
              {t(titleKey)}
            </p>
            <p className={`text-xs text-gray-500 dark:text-gray-400 mt-0.5 ${isRTL ? 'text-right' : ''}`}>
              {t(descKey)}
            </p>
          </div>
        </div>

        <div className={`px-4 pb-4 space-y-3 ${isRTL ? 'text-right' : ''}`}>
          {/* Actions (shown when no result yet) */}
          {!isDone && (
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Check button */}
              <div className="flex-1 space-y-1">
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => handleSectionAction(sectionKey, steps, true)}
                  disabled={anyBusy}
                  className="w-full"
                >
                  {s.checking ? (
                    <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      {t('checking')}
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      {t('checkButton')}
                    </span>
                  )}
                </CmxButton>
                <p className="text-xs text-gray-400 dark:text-gray-500 px-0.5">{t(checkHintKey)}</p>
              </div>

              {/* Run button */}
              <div className="flex-1 space-y-1">
                <CmxButton
                  size="sm"
                  onClick={() => handleSectionAction(sectionKey, steps, false)}
                  disabled={anyBusy}
                  className="w-full"
                >
                  {s.running ? (
                    <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      {t('running')}
                    </span>
                  ) : (
                    t('runButton')
                  )}
                </CmxButton>
                <p className="text-xs text-gray-400 dark:text-gray-500 px-0.5">{t(runHintKey)}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {s.apiError && (
            <Alert variant="destructive" className={isRTL ? 'text-right' : 'text-left'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{s.apiError}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {s.result && (
            <div className="space-y-2">
              {s.result.dry_run && (
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                    {t('checkResultBadge')}
                  </span>
                </div>
              )}
              {s.result.steps.map((step) => renderStepResult(step))}

              {/* After dry-run: offer to apply */}
              {s.result.dry_run && (
                <CmxButton
                  size="sm"
                  onClick={() => handleSectionAction(sectionKey, steps, false)}
                  disabled={anyBusy}
                  className="w-full mt-1"
                >
                  {s.running ? (
                    <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      {t('running')}
                    </span>
                  ) : (
                    t('applyFixButton')
                  )}
                </CmxButton>
              )}

              {/* After apply: allow re-check */}
              {!s.result.dry_run && (
                <CmxButton
                  variant="outline"
                  size="sm"
                  onClick={() => updateSection(sectionKey, { result: null, apiError: null })}
                  className="w-full mt-1"
                >
                  {t('retryButton')}
                </CmxButton>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent
        className={`max-w-lg ${isRTL ? 'text-right' : 'text-left'}`}
        onPointerDownOutside={(e) => anyBusy && e.preventDefault()}
      >
        <CmxDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CmxDialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Wrench className="h-5 w-5 shrink-0" />
            {t('title')}
          </CmxDialogTitle>
          <CmxDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {t('description')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-3">
          {/* Section 1: Pieces */}
          {renderSection({
            sectionKey: 'pieces',
            icon: Package,
            titleKey: 'sectionPiecesTitle',
            descKey: 'sectionPiecesDesc',
            steps: ['complete_order_item_pieces'],
            checkHintKey: 'checkHint',
            runHintKey: 'runHint',
          })}

          {/* Section 2: Product Names */}
          {renderSection({
            sectionKey: 'productNames',
            icon: Tag,
            titleKey: 'sectionProductNamesTitle',
            descKey: 'sectionProductNamesDesc',
            steps: ['fix_product_names'],
            checkHintKey: 'checkHintProductNames',
            runHintKey: 'runHintProductNames',
          })}
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          {anyApplied ? (
            <>
              <CmxButton variant="outline" onClick={handleClose} disabled={anyBusy}>
                {tCommon('close')}
              </CmxButton>
              <CmxButton onClick={handleRefresh} disabled={anyBusy}>
                {t('refreshPage')}
              </CmxButton>
            </>
          ) : (
            <CmxButton variant="outline" onClick={handleClose} disabled={anyBusy}>
              {tCommon('close')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
