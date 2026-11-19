/**
 * PendingFilesPicker — choose files for a record that is not saved yet (a new issue, exception,
 * QA decision). It only holds the files; the caller uploads them after its save with
 * `uploadFilesToRecord`, because the record id does not exist before.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxFileDropZone, type CmxFileRejectReason } from '@ui/forms';
import { formatFileSize } from '@ui/data-display';
import { CmxCameraCaptureDialog } from '@ui/overlays';
import { cmxMessage } from '@ui/feedback';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchFileConfig } from '../api/file-util-api';
import type { FileCategoryCode } from '../model/file-util-types';

/** Same lifetime and key as `useFileAttachments`, so both share one config read. */
const CONFIG_STALE_MS = 10 * 60 * 1000;

export interface PendingFilesPickerProps {
  category: FileCategoryCode;
  /** Purpose the files will be saved under; its types, size and count limits apply here. */
  purpose: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Title shown above the drop zone. */
  label?: string;
}

/**
 * Drop zone + camera + list of chosen files, checked against the purpose rules before upload.
 * @param props see PendingFilesPickerProps
 */
export function PendingFilesPicker({ category, purpose, files, onChange, disabled = false, label }: PendingFilesPickerProps) {
  const t = useTranslations('fileUtil');
  const tenantId = useAuth().currentTenant?.tenant_id;
  const [cameraOpen, setCameraOpen] = useState(false);

  const config = useQuery({
    queryKey: ['file-util', 'config', tenantId, category],
    queryFn: ({ signal }) => fetchFileConfig(category, signal),
    enabled: !!tenantId,
    staleTime: CONFIG_STALE_MS,
  });
  const rules = config.data?.purposes.find((p) => p.purposeCode === purpose);
  const accept = rules?.mimeTypes.map((m) => m.mimeType) ?? [];
  const room = rules?.maxFiles == null ? undefined : Math.max(0, rules.maxFiles - files.length);
  const blocked = disabled || !rules || room === 0;

  const add = (picked: File[]) => onChange([...files, ...picked]);
  const onReject = (file: File, reason: CmxFileRejectReason) => {
    const key = reason === 'type' ? 'rejectType' : reason === 'size' ? 'rejectSize' : 'rejectCount';
    cmxMessage.warning(t(key, { name: file.name, size: formatFileSize(rules?.maxSizeBytes ?? 0) }));
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      {config.isError || (config.isSuccess && !rules) ? (
        <p className="text-sm text-muted-foreground">{t('errors.CATEGORY_UNAVAILABLE')}</p>
      ) : (
        <>
          <CmxFileDropZone
            onFiles={add}
            onReject={onReject}
            acceptMimeTypes={accept}
            maxSizeBytes={rules?.maxSizeBytes}
            maxFiles={room}
            disabled={blocked}
            hint={rules ? `${t('dropHint', { size: formatFileSize(rules.maxSizeBytes) })} ${t('pendingHint')}` : undefined}
          />
          {accept.includes('image/jpeg') && (
            <CmxButton type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)} disabled={blocked}>
              <Camera className="h-4 w-4" aria-hidden />
              {t('takePhoto')}
            </CmxButton>
          )}
        </>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              <CmxButton
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={t('removePending', { name: file.name })}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </CmxButton>
            </li>
          ))}
        </ul>
      )}
      <CmxCameraCaptureDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(photo) => add([photo])} />
    </div>
  );
}
