/**
 * Assembly Task Modal Component
 * Full assembly interface with scanning, exceptions, and packing
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useState, useEffect } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { AssemblyScanner } from './assembly-scanner';
import { ExceptionDialog } from './exception-dialog';
import { useStartAssemblyTask, usePackOrder } from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { X, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AssemblyTaskModalProps {
  orderId: string;
  taskId?: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function AssemblyTaskModal({
  orderId,
  taskId,
  onClose,
  onComplete,
}: AssemblyTaskModalProps) {
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [taskData, setTaskData] = useState<any>(null);
  const { showSuccess, showError } = useMessage();
  const { mutate: startTask, isPending: isStarting } = useStartAssemblyTask();
  const { mutate: packOrder, isPending: isPacking } = usePackOrder();

  useEffect(() => {
    // Fetch task data if taskId provided
    if (taskId) {
      // TODO: Fetch task details
    }
  }, [taskId]);

  const handleStart = () => {
    if (!taskId) {
      showError('Task ID is required');
      return;
    }

    startTask(
      { taskId },
      {
        onSuccess: () => {
          showSuccess('Assembly task started');
        },
        onError: (error) => {
          showError(error.message || 'Failed to start task');
        },
      }
    );
  };

  const handlePack = () => {
    if (!taskId) {
      showError('Task ID is required');
      return;
    }

    packOrder(
      {
        taskId,
        packagingTypeCode: 'BOX', // Default, should come from selection
      },
      {
        onSuccess: () => {
          showSuccess('Order packed successfully');
          onComplete?.();
          onClose();
        },
        onError: (error) => {
          showError(error.message || 'Packing failed');
        },
      }
    );
  };

  if (!taskId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <CmxCard className="w-full max-w-md">
          <CmxCardHeader className="flex flex-row items-center justify-between">
            <CmxCardTitle>Assembly Task</CmxCardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </CmxCardHeader>
          <CmxCardContent>
            <p className="text-sm text-gray-600 mb-4">
              Assembly task not found. Creating task...
            </p>
            <CmxButton onClick={onClose} variant="outline" className="w-full">
              Close
            </CmxButton>
          </CmxCardContent>
        </CmxCard>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <CmxCard>
            <CmxCardHeader className="flex flex-row items-center justify-between">
              <CmxCardTitle>Assembly Task - Order {orderId}</CmxCardTitle>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </CmxCardHeader>
            <CmxCardContent className="space-y-6">
              {/* Task Status */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Total Items</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {taskData?.totalItems || 0}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Scanned</div>
                  <div className="text-2xl font-bold text-green-600">
                    {taskData?.scannedItems || 0}
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600">Exceptions</div>
                  <div className="text-2xl font-bold text-red-600">
                    {taskData?.exceptionItems || 0}
                  </div>
                </div>
              </div>

              {/* Scanner */}
              <AssemblyScanner taskId={taskId} onScanSuccess={() => {
                // Refresh task data
              }} />

              {/* Actions */}
              <div className="flex gap-2">
                <CmxButton
                  variant="outline"
                  onClick={() => setShowExceptionDialog(true)}
                  className="flex-1"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Record Exception
                </CmxButton>
                <CmxButton
                  onClick={handlePack}
                  loading={isPacking}
                  disabled={isPacking}
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Pack Order
                </CmxButton>
              </div>
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>

      {showExceptionDialog && (
        <ExceptionDialog
          taskId={taskId}
          onClose={() => setShowExceptionDialog(false)}
          onSuccess={() => {
            setShowExceptionDialog(false);
            // Refresh task data
          }}
        />
      )}
    </>
  );
}

