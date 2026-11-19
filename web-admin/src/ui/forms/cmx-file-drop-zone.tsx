/**
 * CmxFileDropZone — pick files by drag-and-drop, click/keyboard, or paste.
 * Presentational: it validates type and size against the props and hands accepted files to
 * `onFiles`; uploading is the caller's job.
 * @module ui/forms
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Why a picked file was refused before upload. */
export type CmxFileRejectReason = 'type' | 'size' | 'count';

export interface CmxFileDropZoneProps {
  /** Accepted files, in pick order. */
  onFiles: (files: File[]) => void;
  /** Refused files with the reason, so the caller can explain (via cmxMessage). */
  onReject?: (file: File, reason: CmxFileRejectReason) => void;
  /** Allowed MIME types; empty or omitted = any type. */
  acceptMimeTypes?: string[];
  /** Largest accepted file in bytes. */
  maxSizeBytes?: number;
  /** Most files accepted in one pick (rest rejected with `count`). */
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  /** Overrides the default "Drop files here…" title. */
  label?: string;
  /** Extra line under the title (e.g. allowed types and size). */
  hint?: string;
  className?: string;
}

/**
 * Drop zone with keyboard, click and paste support.
 * @param props see CmxFileDropZoneProps
 */
export function CmxFileDropZone({
  onFiles,
  onReject,
  acceptMimeTypes,
  maxSizeBytes,
  maxFiles,
  multiple = true,
  disabled = false,
  label,
  hint,
  className,
}: CmxFileDropZoneProps) {
  const t = useTranslations('common.files');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handle = React.useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const accepted: File[] = [];
      for (const file of Array.from(list)) {
        if (acceptMimeTypes?.length && !acceptMimeTypes.includes(file.type.toLowerCase())) onReject?.(file, 'type');
        else if (maxSizeBytes && file.size > maxSizeBytes) onReject?.(file, 'size');
        else if ((maxFiles !== undefined && accepted.length >= maxFiles) || (!multiple && accepted.length >= 1)) onReject?.(file, 'count');
        else accepted.push(file);
      }
      if (accepted.length) onFiles(accepted);
    },
    [acceptMimeTypes, disabled, maxFiles, maxSizeBytes, multiple, onFiles, onReject],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label ?? t('dropTitle')}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onPaste={(e) => handle(Array.from(e.clipboardData.files))}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--cmx-radius-md,0.375rem)] border-2 border-dashed p-6 text-center transition-colors',
        'border-border text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'border-primary bg-primary-bg',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[rgb(var(--cmx-field-hover-rgb,248_250_252))]',
        className,
      )}
    >
      <UploadCloud className="h-8 w-8" aria-hidden />
      <p className="text-sm font-medium text-foreground">{label ?? t('dropTitle')}</p>
      <p className="text-xs">{hint ?? t('dropHint')}</p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        multiple={multiple}
        accept={acceptMimeTypes?.join(',')}
        disabled={disabled}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = ''; // allow picking the same file again
        }}
      />
    </div>
  );
}
