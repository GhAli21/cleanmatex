/**
 * Exception Dialog — record missing/wrong/damaged assembly items
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { useMessage } from '@ui/feedback/useMessage';
import { cmxMessage } from '@ui/feedback';
import { PendingFilesPicker, uploadFilesToRecord } from '@features/file-util';
import { FILE_CATEGORIES, FILE_PURPOSES, FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import type { AssemblyTaskItem } from '../hooks/use-assembly';
import { AlertTriangle } from 'lucide-react';

interface ExceptionDialogProps {
  taskId: string;
  /** Order of the task; exception photos are saved as files of this order. */
  orderId: string;
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
 * @param root0.orderId
 * @param root0.items
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function ExceptionDialog({
  taskId,
  orderId,
  items = [],
  onClose,
  onSuccess,
}: ExceptionDialogProps) {
  const t = useTranslations('workflow.assembly.task.exception');
  const tTask = useTranslations('workflow.assembly.task');
  const tFiles = useTranslations('fileUtil');
  const { token: csrfToken } = useCSRFToken();
  const [photos, setPhotos] = useState<File[]>([]);
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
        // The exception id exists only now; photos upload in the background and report their own result.
        if (result.exceptionId && photos.length > 0) {
          void uploadFilesToRecord({
            category: FILE_CATEGORIES.ORDER_FILE,
            entityId: orderId,
            purpose: FILE_PURPOSES.ORDER_FILE.ASSEMBLY_EXCEPTION,
            source: FILE_SOURCES.ORDER_ASSEMBLY,
            refType: FILE_REF_TYPES.ASM_EXCEPTION,
            refId: result.exceptionId,
            files: photos,
            csrfToken,
          }).then(({ saved, failed }) => {
            if (failed > 0) cmxMessage.warning(tFiles('orderPhotosFailed', { failed }));
            else cmxMessage.success(tFiles('orderPhotosSaved', { count: saved }));
          });
        }
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
    <CmxDialog open onOpenChange={(next) => { if (!next && !isSubmitting) onClose(); }} stackAboveModals>
      <CmxDialogContent className="max-w-2xl w-full p-0" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-text" />
            {t('title')}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <div className="p-6 space-y-4">
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

          <PendingFilesPicker
            label={t('photos')}
            category={FILE_CATEGORIES.ORDER_FILE}
            purpose={FILE_PURPOSES.ORDER_FILE.ASSEMBLY_EXCEPTION}
            files={photos}
            onChange={setPhotos}
            disabled={isSubmitting}
          />
        </div>

        <CmxDialogFooter className="border-t px-6 py-4">
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
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
