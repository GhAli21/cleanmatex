/**
 * Assembly Task Modal Component
 * Scan / manual select items, record exceptions, complete assembly + advance workflow
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { AssemblyScanner } from './assembly-scanner';
import { AssemblyItemsList } from './assembly-items-list';
import { ExceptionDialog } from './exception-dialog';
import { OrderStageFiles } from '@features/orders/ui/order-stage-files';
import { FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import {
  useAssemblyTask,
  useStartAssemblyTask,
  useCompleteAssemblyTask,
} from '../hooks/use-assembly';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowProfileStaffMessage } from '@/lib/hooks/use-workflow-profile-staff-message';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { CmxSummaryMessage } from '@ui/feedback';
import { useMessage } from '@ui/feedback/useMessage';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

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
  const tCommon = useTranslations('common');
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const { showSuccess, showError } = useMessage();
  const profileStaffMessage = useWorkflowProfileStaffMessage();
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
        showError(
          profileStaffMessage(result.code, result.error || t('messages.completeFailed'))
            || t('messages.completeFailed'),
        );
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
      <CmxDialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          </CmxDialogHeader>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('creatingTask')}
          </p>
          <CmxButton onClick={onClose} variant="outline" className="w-full">
            {t('actions.close')}
          </CmxButton>
        </CmxDialogContent>
      </CmxDialog>
    );
  }

  return (
    <>
      <CmxDialog
        open
        onOpenChange={(next) => {
          if (!next && !showExceptionDialog) onClose();
        }}
      >
        <CmxDialogContent className="w-full max-w-4xl" scrollBody>
          <CmxDialogHeader>
            <CmxDialogTitle id="assembly-task-title">
              {t('titleWithOrder', { orderNo: orderLabel })}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-6">
            {isError ? (
              <div className="space-y-2">
                <CmxSummaryMessage
                  type="error"
                  message={(error as Error)?.message || t('messages.loadFailed')}
                />
                <CmxButton type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                  {tCommon('retry')}
                </CmxButton>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-info-bg p-4">
                <div className="text-sm text-muted-foreground">
                  {t('metrics.totalItems')}
                </div>
                <div className="text-2xl font-bold text-primary-text tabular-nums">
                  {isLoading ? <CmxSkeleton className="mt-1 h-8 w-10" /> : totalItems}
                </div>
              </div>
              <div className="rounded-lg bg-success-bg p-4">
                <div className="text-sm text-muted-foreground">
                  {t('metrics.scanned')}
                </div>
                <div className="text-2xl font-bold text-success-text tabular-nums">
                  {isLoading ? <CmxSkeleton className="mt-1 h-8 w-10" /> : scannedItems}
                </div>
              </div>
              <div className="rounded-lg bg-danger-bg p-4">
                <div className="text-sm text-muted-foreground">
                  {t('metrics.exceptions')}
                </div>
                <div className="text-2xl font-bold text-danger-text tabular-nums">
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

            <OrderStageFiles
              orderId={orderId}
              source={FILE_SOURCES.ORDER_ASSEMBLY}
              refType={FILE_REF_TYPES.ASM_TASK}
              refId={taskId}
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
          </div>
        </CmxDialogContent>
      </CmxDialog>

      {showExceptionDialog ? (
        <ExceptionDialog
          taskId={taskId}
          orderId={orderId}
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
