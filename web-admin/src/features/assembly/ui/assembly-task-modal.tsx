/**
 * Assembly Task Modal Component
 * Scan / manual select items, record exceptions, complete assembly + advance workflow
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { AssemblyScanner } from './assembly-scanner';
import { AssemblyItemsList } from './assembly-items-list';
import { ExceptionDialog } from './exception-dialog';
import {
  useAssemblyTask,
  useStartAssemblyTask,
  useCompleteAssemblyTask,
} from '../hooks/use-assembly';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback/useMessage';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AssemblyTaskModalProps {
  orderId: string;
  orderNo?: string | null;
  taskId?: string;
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * @param root0
 * @param root0.orderId
 * @param root0.orderNo
 * @param root0.taskId
 * @param root0.onClose
 * @param root0.onComplete
 */
export function AssemblyTaskModal({
  orderId,
  orderNo,
  taskId,
  onClose,
  onComplete,
}: AssemblyTaskModalProps) {
  const t = useTranslations('workflow.assembly.task');
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const { showSuccess, showError } = useMessage();
  const { mutate: startTask, isPending: isStarting } = useStartAssemblyTask();
  const { mutateAsync: completeTask, isPending: isCompletingTask } =
    useCompleteAssemblyTask();
  const transition = useOrderTransition();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const startAttemptedRef = useRef<string | null>(null);

  const {
    data: taskData,
    isLoading,
    isError,
    error,
    refetch,
  } = useAssemblyTask(taskId);

  useEffect(() => {
    if (!taskId || !taskData) return;
    if (taskData.taskStatus !== 'PENDING') return;
    if (startAttemptedRef.current === taskId) return;

    startAttemptedRef.current = taskId;
    startTask(
      { taskId },
      {
        onSuccess: (result) => {
          if (!result.alreadyStarted) {
            showSuccess(t('messages.taskStarted'));
          }
          void refetch();
        },
        onError: (err) => {
          startAttemptedRef.current = null;
          showError(err.message || t('messages.taskStartFailed'));
        },
      }
    );
  }, [taskId, taskData, startTask, showSuccess, showError, t, refetch]);

  const totalItems = taskData?.totalItems ?? 0;
  const scannedItems = taskData?.scannedItems ?? 0;
  const exceptionItems = taskData?.exceptionItems ?? 0;
  const pendingItems =
    taskData?.items.filter((item) => item.itemStatus === 'PENDING').length ?? 0;
  const allAssembled = totalItems > 0 && pendingItems === 0;
  const hasOpenExceptions = exceptionItems > 0;
  const canComplete = allAssembled && !hasOpenExceptions;
  const isBusy = isCompletingTask || transition.isPending;

  const handleComplete = async () => {
    if (!taskId) {
      showError(t('messages.taskIdRequired'));
      return;
    }
    if (!canComplete) {
      showError(
        hasOpenExceptions
          ? t('messages.openExceptionsBlock')
          : t('messages.completeRequiresAllItems')
      );
      return;
    }

    try {
      await completeTask(taskId);

      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'assembly',
          notes: 'Assembly complete',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success === false) {
        showError(result.error || t('messages.completeFailed'));
        return;
      }

      showSuccess(t('messages.completeSuccess'));
      onComplete?.();
      onClose();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : t('messages.completeFailed')
      );
    }
  };

  const orderLabel =
    orderNo || taskData?.orderNo || t('orderFallback');

  if (!taskId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <CmxCard className="w-full max-w-md">
          <CmxCardHeader className="flex flex-row items-center justify-between">
            <CmxCardTitle>{t('title')}</CmxCardTitle>
            <CmxButton
              variant="ghost"
              size="xs"
              onClick={onClose}
              aria-label={t('actions.close')}
            >
              <X className="h-5 w-5" />
            </CmxButton>
          </CmxCardHeader>
          <CmxCardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('creatingTask')}
            </p>
            <CmxButton onClick={onClose} variant="outline" className="w-full">
              {t('actions.close')}
            </CmxButton>
          </CmxCardContent>
        </CmxCard>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assembly-task-title"
      >
        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto">
          <CmxCard>
            <CmxCardHeader className="flex flex-row items-center justify-between gap-2">
              <CmxCardTitle id="assembly-task-title">
                {t('titleWithOrder', { orderNo: orderLabel })}
              </CmxCardTitle>
              <CmxButton
                variant="ghost"
                size="xs"
                onClick={onClose}
                aria-label={t('actions.close')}
              >
                <X className="h-5 w-5" />
              </CmxButton>
            </CmxCardHeader>
            <CmxCardContent className="space-y-6">
              {isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {(error as Error)?.message || t('messages.loadFailed')}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
                  <div className="text-sm text-muted-foreground">
                    {t('metrics.totalItems')}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {isLoading ? <CmxSkeleton className="mt-1 h-8 w-10" /> : totalItems}
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/40">
                  <div className="text-sm text-muted-foreground">
                    {t('metrics.scanned')}
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {isLoading ? <CmxSkeleton className="mt-1 h-8 w-10" /> : scannedItems}
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/40">
                  <div className="text-sm text-muted-foreground">
                    {t('metrics.exceptions')}
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {isLoading ? <CmxSkeleton className="mt-1 h-8 w-10" /> : exceptionItems}
                  </div>
                </div>
              </div>

              {isStarting ? (
                <p className="text-sm text-muted-foreground">{t('startingTask')}</p>
              ) : null}

              <AssemblyScanner
                taskId={taskId}
                onScanSuccess={() => {
                  void refetch();
                }}
              />

              <AssemblyItemsList
                taskId={taskId}
                items={taskData?.items ?? []}
                isLoading={isLoading}
                onItemMarked={() => {
                  void refetch();
                }}
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <CmxButton
                  variant="outline"
                  onClick={() => setShowExceptionDialog(true)}
                  className="flex-1"
                  disabled={isBusy}
                >
                  <AlertTriangle className="me-2 h-4 w-4" />
                  {t('actions.recordException')}
                </CmxButton>
                <CmxButton
                  onClick={() => {
                    void handleComplete();
                  }}
                  loading={isBusy}
                  disabled={isBusy || !canComplete}
                  className="flex-1"
                  title={
                    !canComplete
                      ? hasOpenExceptions
                        ? t('messages.openExceptionsBlock')
                        : t('messages.completeRequiresAllItems')
                      : undefined
                  }
                >
                  <CheckCircle2 className="me-2 h-4 w-4" />
                  {t('actions.completeAssembly')}
                </CmxButton>
              </div>
              {!canComplete && !isLoading ? (
                <p className="text-xs text-muted-foreground">
                  {hasOpenExceptions
                    ? t('messages.openExceptionsBlock')
                    : t('messages.completeRequiresAllItems')}
                </p>
              ) : null}
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>

      {showExceptionDialog ? (
        <ExceptionDialog
          taskId={taskId}
          items={taskData?.items ?? []}
          onClose={() => setShowExceptionDialog(false)}
          onSuccess={() => {
            setShowExceptionDialog(false);
            void refetch();
          }}
        />
      ) : null}
    </>
  );
}
