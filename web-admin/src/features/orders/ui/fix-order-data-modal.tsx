/**
 * Fix Order Data Modal
 * Runs fix_order_data for the current order and shows per-step results.
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Wrench, Loader2, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react';
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

/** Steps shown under "Fixes to run" (check is display-only; API only runs complete_order_item_pieces) */
const STEP_IDS: { id: string; labelKey: string }[] = [
  { id: 'check_order_data', labelKey: 'stepCheckOrderData' },
  { id: 'complete_order_item_pieces', labelKey: 'stepCompleteOrderItemPieces' },
];

export function FixOrderDataModal({
  orderId,
  open,
  onOpenChange,
  onSuccess,
}: FixOrderDataModalProps) {
  const t = useTranslations('orders.fixOrderDataModal');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FixOrderDataResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const callApi = useCallback(
    async (dryRun: boolean) => {
      const res = await fetch(`/api/v1/orders/${orderId}/fix-order-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: ['complete_order_item_pieces'],
          dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setApiError(json.error ?? t('errorMessage'));
        return null;
      }
      if (json.success && json.data) {
        setResult(json.data as FixOrderDataResult);
        setApiError(null);
        return json.data as FixOrderDataResult;
      }
      setApiError(json.error ?? t('errorMessage'));
      return null;
    },
    [orderId, t]
  );

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setResult(null);
    setApiError(null);
    try {
      await callApi(true);
    } finally {
      setChecking(false);
    }
  }, [callApi]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setApiError(null);
    try {
      await callApi(false);
    } finally {
      setRunning(false);
    }
  }, [callApi]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setResult(null);
    setApiError(null);
  }, [onOpenChange]);

  const handleRefresh = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [onSuccess, handleClose]);

  const getStepLabel = (stepId: string): string => {
    const step = STEP_IDS.find((s) => s.id === stepId);
    return step ? t(step.labelKey) : stepId;
  };

  const getActionLabel = (action: string): string => {
    if (action === 'added_pieces') return t('stepActionAdded');
    if (action === 'removed_pieces') return t('stepActionRemoved');
    return t('stepActionAdjusted');
  };

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent
        className={`max-w-lg ${isRTL ? 'text-right' : 'text-left'}`}
        onPointerDownOutside={(e) => result && e.preventDefault()}
      >
        <CmxDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CmxDialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Wrench className="h-5 w-5" />
            {t('title')}
          </CmxDialogTitle>
          <CmxDialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {t('description')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className={`space-y-5 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('stepsLabel')}
            </p>
            <ul className={`space-y-1.5 text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'list-none' : ''}`}>
              {STEP_IDS.map((s) => (
                <li key={s.id} className={isRTL ? 'flex flex-row-reverse gap-2' : ''}>
                  {t(s.labelKey)}
                </li>
              ))}
            </ul>
          </div>

          {!result && !apiError && (
            <div className={`space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('actionsLabel')}
              </p>
              <div className={`flex flex-col gap-3 ${isRTL ? 'items-stretch' : ''}`}>
                <div className="space-y-1">
                  <CmxButton
                    variant="outline"
                    onClick={handleCheck}
                    disabled={running || checking}
                    className="w-full"
                    size="lg"
                  >
                    {checking ? (
                      <>
                        <Loader2 className={`h-4 w-4 animate-spin shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('checking')}
                      </>
                    ) : (
                      t('checkButton')
                    )}
                  </CmxButton>
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    {t('checkHint')}
                  </p>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-600" />
                  <span className={`bg-gray-50 dark:bg-gray-900/40 px-2 text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
                    {t('orLabel')}
                  </span>
                </div>
                <div className="space-y-1">
                  <CmxButton
                    onClick={handleRun}
                    disabled={running || checking}
                    className="w-full"
                    size="lg"
                  >
                    {running ? (
                      <>
                        <Loader2 className={`h-4 w-4 animate-spin shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('running')}
                      </>
                    ) : (
                      t('runButton')
                    )}
                  </CmxButton>
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                    {t('runHint')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {apiError && (
            <Alert variant="destructive" className={isRTL ? 'text-right' : 'text-left'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">{t('errorTitle')}</span>
                <span className="block mt-1">{apiError}</span>
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {t('resultSectionTitle')}
                </p>
                {result.dry_run && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                    {t('checkResultBadge')}
                  </span>
                )}
              </div>
              {result.overall === 'error' && (
                <Alert variant="destructive" className={isRTL ? 'text-right' : 'text-left'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('errorTitle')} — {t('errorMessage')}</AlertDescription>
                </Alert>
              )}
              {result.steps.map((step) => (
                <div
                  key={step.step_id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    step.status === 'error'
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50'
                  } ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {step.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    {step.status === 'skipped' && (
                      <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {getStepLabel(step.step_id)}
                    </span>
                    <span
                      className={`text-xs font-medium ${
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('stepNoChanges')}</p>
                  )}
                  {step.details && (
                    <div className="mt-2 pl-6 rtl:pl-0 rtl:pr-6">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('stepDetailsLabel')}
                      </p>
                      {(step.details.items_adjusted !== undefined ||
                        step.details.pieces_added !== undefined ||
                        step.details.pieces_removed !== undefined) && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {[
                            step.details.items_adjusted != null &&
                              (step.details.dry_run
                                ? t('detailsItemsWouldBeAdjusted', {
                                    count: step.details.items_adjusted,
                                  })
                                : `Items adjusted: ${step.details.items_adjusted}`),
                            step.details.pieces_added != null &&
                              (step.details.dry_run
                                ? t('detailsPiecesWouldBeAdded', {
                                    count: step.details.pieces_added,
                                  })
                                : `Pieces added: ${step.details.pieces_added}`),
                            step.details.pieces_removed != null &&
                              (step.details.dry_run
                                ? t('detailsPiecesWouldBeRemoved', {
                                    count: step.details.pieces_removed,
                                  })
                                : `Pieces removed: ${step.details.pieces_removed}`),
                          ]
                            .filter(Boolean)
                            .join('. ')}
                        </p>
                      )}
                      {step.details.item_results && step.details.item_results.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
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
              ))}
            </div>
          )}
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          {result ? (
            <>
              <CmxButton variant="outline" onClick={handleClose}>
                {t('close')}
              </CmxButton>
              {result.dry_run ? (
                <CmxButton
                  onClick={handleRun}
                  disabled={running}
                  className={isRTL ? 'flex-row-reverse' : ''}
                >
                  {running ? (
                    <>
                      <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('running')}
                    </>
                  ) : (
                    t('applyFixButton')
                  )}
                </CmxButton>
              ) : (
                <CmxButton onClick={handleRefresh}>{t('refreshPage')}</CmxButton>
              )}
            </>
          ) : (
            <CmxButton variant="outline" onClick={handleClose} disabled={running || checking}>
              {tCommon('close')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
