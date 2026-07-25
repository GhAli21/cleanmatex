/**
 * Assembly Task Modal Component
 * Full assembly interface with item list, scanning, exceptions, and packing
 * PRD-009: Assembly & QA Workflow
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
  usePackOrder,
} from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { X, Package, AlertTriangle } from 'lucide-react';

interface AssemblyTaskModalProps {
  orderId: string;
  taskId?: string;
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * @param root0
 * @param root0.orderId
 * @param root0.taskId
 * @param root0.onClose
 * @param root0.onComplete
 */
export function AssemblyTaskModal({
  orderId,
  taskId,
  onClose,
  onComplete,
}: AssemblyTaskModalProps) {
  const t = useTranslations('workflow.assembly.task');
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const { showSuccess, showError } = useMessage();
  const { mutate: startTask, isPending: isStarting } = useStartAssemblyTask();
  const { mutate: packOrder, isPending: isPacking } = usePackOrder();
  const startAttemptedRef = useRef<string | null>(null);

  const {
    data: taskData,
    isLoading,
    isError,
    error,
    refetch,
  } = useAssemblyTask(taskId);

  // Auto-start PENDING tasks so scan / manual select can proceed
  useEffect(() => {
    if (!taskId || !taskData) return;
    if (taskData.taskStatus !== 'PENDING') return;
    if (startAttemptedRef.current === taskId) return;

    startAttemptedRef.current = taskId;
    startTask(
      { taskId },
      {
        onSuccess: () => {
          showSuccess(t('messages.taskStarted'));
          void refetch();
        },
        onError: (err) => {
          startAttemptedRef.current = null;
          showError(err.message || t('messages.taskStartFailed'));
        },
      }
    );
  }, [taskId, taskData, startTask, showSuccess, showError, t, refetch]);

  const handlePack = () => {
    if (!taskId) {
      showError(t('messages.taskIdRequired'));
      return;
    }

    packOrder(
      {
        taskId,
        packagingTypeCode: 'BOX',
      },
      {
        onSuccess: () => {
          showSuccess(t('messages.packSuccess'));
          onComplete?.();
          onClose();
        },
        onError: (err) => {
          showError(err.message || t('messages.packFailed'));
        },
      }
    );
  };

  const orderLabel = taskData?.orderNo || orderId;
  const totalItems = taskData?.totalItems ?? 0;
  const scannedItems = taskData?.scannedItems ?? 0;
  const exceptionItems = taskData?.exceptionItems ?? 0;
  const allScanned = totalItems > 0 && scannedItems >= totalItems;

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

              {/* Metrics */}
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

              {/* Scanner + manual item selection */}
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

              {/* Actions */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <CmxButton
                  variant="outline"
                  onClick={() => setShowExceptionDialog(true)}
                  className="flex-1"
                >
                  <AlertTriangle className="me-2 h-4 w-4" />
                  {t('actions.recordException')}
                </CmxButton>
                <CmxButton
                  onClick={handlePack}
                  loading={isPacking}
                  disabled={isPacking || !allScanned}
                  className="flex-1"
                  title={!allScanned ? t('packRequiresAllItems') : undefined}
                >
                  <Package className="me-2 h-4 w-4" />
                  {t('actions.packOrder')}
                </CmxButton>
              </div>
              {!allScanned && !isLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t('packRequiresAllItems')}
                </p>
              ) : null}
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>

      {showExceptionDialog ? (
        <ExceptionDialog
          taskId={taskId}
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
