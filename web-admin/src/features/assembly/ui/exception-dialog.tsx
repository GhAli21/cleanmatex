/**
 * Exception Dialog — record missing/wrong/damaged assembly items
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useMessage } from '@ui/feedback/useMessage';
import type { AssemblyTaskItem } from '../hooks/use-assembly';
import { AlertTriangle, X } from 'lucide-react';

interface ExceptionDialogProps {
  taskId: string;
  items?: AssemblyTaskItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

const EXCEPTION_TYPE_CODES = [
  'MISSING',
  'WRONG_ITEM',
  'DAMAGED',
  'EXTRA',
  'QUALITY_ISSUE',
] as const;

const SEVERITY_CODES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * @param root0
 * @param root0.taskId
 * @param root0.items
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function ExceptionDialog({
  taskId,
  items = [],
  onClose,
  onSuccess,
}: ExceptionDialogProps) {
  const t = useTranslations('workflow.assembly.task.exception');
  const tTask = useTranslations('workflow.assembly.task');
  const [exceptionType, setExceptionType] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [assemblyItemId, setAssemblyItemId] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useMessage();

  const selectableItems = items.filter(
    (item) => item.itemStatus === 'PENDING' || item.itemStatus === 'SCANNED'
  );

  const handleSubmit = async () => {
    if (!exceptionType || !description.trim()) {
      showError(t('messages.required'));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/assembly/tasks/${taskId}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionTypeCode: exceptionType,
          severity,
          description: description.trim(),
          description2: descriptionAr.trim() || undefined,
          assemblyItemId: assemblyItemId || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(t('messages.success'));
        onSuccess?.();
        onClose();
      } else {
        showError(result.error || t('messages.failed'));
      }
    } catch {
      showError(t('messages.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <CmxCard className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CmxCardHeader className="flex flex-row items-center justify-between">
          <CmxCardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t('title')}
          </CmxCardTitle>
          <CmxButton
            variant="ghost"
            size="xs"
            onClick={onClose}
            aria-label={tTask('actions.close')}
          >
            <X className="h-5 w-5" />
          </CmxButton>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('typeLabel')}</Label>
            <CmxSelectDropdown value={exceptionType} onValueChange={setExceptionType}>
              <CmxSelectDropdownTrigger>
                <CmxSelectDropdownValue placeholder={t('typePlaceholder')} />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {EXCEPTION_TYPE_CODES.map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>
                    {t(`types.${code}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          <div className="space-y-1.5">
            <Label>{t('severityLabel')}</Label>
            <CmxSelectDropdown value={severity} onValueChange={setSeverity}>
              <CmxSelectDropdownTrigger>
                <CmxSelectDropdownValue />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {SEVERITY_CODES.map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>
                    {t(`severity.${code}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          {selectableItems.length > 0 ? (
            <div className="space-y-1.5">
              <Label>{t('itemLabel')}</Label>
              <CmxSelectDropdown
                value={assemblyItemId || '__none__'}
                onValueChange={(value) =>
                  setAssemblyItemId(value === '__none__' ? '' : value)
                }
              >
                <CmxSelectDropdownTrigger>
                  <CmxSelectDropdownValue placeholder={t('itemPlaceholder')} />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  <CmxSelectDropdownItem value="__none__">
                    {t('itemNone')}
                  </CmxSelectDropdownItem>
                  {selectableItems.map((item) => (
                    <CmxSelectDropdownItem key={item.id} value={item.id}>
                      {item.productName}
                      {item.barcode ? ` (${item.barcode})` : ''}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t('descriptionEn')}</Label>
            <CmxTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionEnPlaceholder')}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('descriptionAr')}</Label>
            <CmxTextarea
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              placeholder={t('descriptionArPlaceholder')}
              className="min-h-[100px]"
              dir="rtl"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <CmxButton variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('actions.cancel')}
            </CmxButton>
            <CmxButton
              onClick={() => {
                void handleSubmit();
              }}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {t('actions.submit')}
            </CmxButton>
          </div>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
