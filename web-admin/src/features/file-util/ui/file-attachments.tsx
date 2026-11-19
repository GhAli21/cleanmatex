/**
 * FileAttachments — one-line files section for any record:
 * `<FileAttachments category="ORDER_FILE" entityId={orderId} source="ORDER_DETAIL" />`.
 * Pick a purpose and an optional note, then drop / pick / paste / photograph files; see them in a
 * gallery, open them in the viewer, change purpose or note, delete them. Each file shows the stage
 * the record was in and the screen it came from; files can be filtered by purpose and stage.
 */

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, RotateCcw, X } from 'lucide-react';
import { CmxButton, CmxSelect, CmxTextarea } from '@ui/primitives';
import { CmxFileDropZone, type CmxFileRejectReason } from '@ui/forms';
import { CmxFileGallery, formatFileSize, type CmxFileItem, type CmxFilePreviewMode } from '@ui/data-display';
import { CmxCameraCaptureDialog, CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle, CmxFileViewerDialog } from '@ui/overlays';
import { CmxProgressBar, cmxMessage } from '@ui/feedback';
import { useFileAttachments, type UseFileAttachmentsOptions } from '../hooks/use-file-attachments';
import type { FileView } from '../model/file-util-types';

export interface FileAttachmentsProps extends UseFileAttachmentsOptions {
  /** Section title; defaults to "Files". */
  title?: string;
  /** View only: no upload, edit or delete. */
  readOnly?: boolean;
  className?: string;
}

const ALL = '__all__';

/**
 * Connected files section for one record.
 * @param props record, purposes and source; see FileAttachmentsProps
 */
export function FileAttachments({ title, readOnly = false, className, ...opts }: FileAttachmentsProps) {
  const t = useTranslations('fileUtil');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const fa = useFileAttachments(opts);

  const purposes = useMemo(
    () => (fa.config?.purposes ?? []).filter((p) => !opts.purposes || opts.purposes.includes(p.purposeCode)),
    [fa.config, opts.purposes],
  );
  const nameOf = (code: string) => {
    const p = fa.config?.purposes.find((x) => x.purposeCode === code);
    return p ? (locale === 'ar' ? p.name2 || p.name : p.name) : code;
  };
  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    const labels = fa.config?.labels;
    for (const [kind, list] of [['source', labels?.sources], ['stage', labels?.stages], ['ref', labels?.refTypes]] as const) {
      for (const l of list ?? []) map.set(`${kind}:${l.code}`, locale === 'ar' ? l.name2 || l.name : l.name);
    }
    // Unknown code (e.g. a stage the lookup lacks): show the code rather than nothing.
    return (kind: 'source' | 'stage' | 'ref', code: string) => map.get(`${kind}:${code}`) ?? code;
  }, [fa.config, locale]);
  const previewOf = useMemo(() => {
    const map = new Map<string, CmxFilePreviewMode>();
    for (const p of fa.config?.purposes ?? []) for (const m of p.mimeTypes) map.set(m.mimeType, m.previewCode as CmxFilePreviewMode);
    return (mime: string): CmxFilePreviewMode => map.get(mime) ?? 'DOWNLOAD';
  }, [fa.config]);

  const [purpose, setPurpose] = useState<string | null>(null);
  const selected = purposes.find((p) => p.purposeCode === purpose) ?? purposes.find((p) => p.isDefault) ?? purposes[0];
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [stageFilter, setStageFilter] = useState(ALL);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: string; purpose: string; notes: string } | null>(null);

  const errorText = (code?: string) => (code && t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.FILE_UTIL_FAILED'));

  // Stages present on this record's files, in workflow order (lookup order), then unknown ones.
  const stageOptions = useMemo(() => {
    const present = new Set(fa.files.map((f) => f.stageCode).filter((c): c is string => !!c));
    const ordered = (fa.config?.labels.stages ?? []).map((l) => l.code).filter((c) => present.has(c));
    const rest = [...present].filter((c) => !ordered.includes(c));
    return [...ordered, ...rest].map((code) => ({ value: code, label: labelOf('stage', code) }));
  }, [fa.files, fa.config, labelOf]);
  // A stage whose last file was deleted (or the filter hidden) must not keep hiding files.
  const activeStage = stageOptions.length > 1 && stageOptions.some((o) => o.value === stageFilter) ? stageFilter : ALL;
  const visible: FileView[] = fa.files.filter(
    (f) => (filter === ALL || f.purposeCode === filter) && (activeStage === ALL || f.stageCode === activeStage),
  );
  const metaOf = (f: FileView) =>
    [f.stageCode && labelOf('stage', f.stageCode), labelOf('source', f.sourceCode), f.refTypeCode && labelOf('ref', f.refTypeCode)]
      .filter(Boolean)
      .join(' · ');
  const items: CmxFileItem[] = visible.map((f) => ({
    id: f.id,
    name: f.originalName,
    mimeType: f.mimeType,
    url: f.url,
    thumbUrl: f.thumbUrl,
    previewMode: previewOf(f.mimeType),
    label: nameOf(f.purposeCode),
    meta: metaOf(f),
    notes: f.notes,
    sizeBytes: f.sizeBytes,
    locked: Boolean(f.lockedAt),
  }));

  const accept = selected?.mimeTypes.map((m) => m.mimeType) ?? [];
  const canPhoto = accept.includes('image/jpeg');

  const startUpload = (files: File[]) => {
    fa.upload(files, { purpose: selected?.purposeCode, notes });
    setNotes('');
  };

  const onReject = (file: File, reason: CmxFileRejectReason) => {
    const key = reason === 'type' ? 'rejectType' : reason === 'size' ? 'rejectSize' : 'rejectCount';
    cmxMessage.warning(t(key, { name: file.name, size: formatFileSize(selected?.maxSizeBytes ?? 0) }));
  };

  const onDelete = async (item: CmxFileItem) => {
    const ok = await cmxMessage.confirm({
      title: t('deleteTitle'),
      message: t('deleteMessage', { name: item.name }),
      variant: 'destructive',
      confirmLabel: tCommon('delete'),
      cancelLabel: tCommon('cancel'),
    });
    if (!ok) return;
    try {
      await fa.remove.mutateAsync(item.id);
      cmxMessage.success(t('deleted'));
    } catch (error) {
      cmxMessage.error(errorText((error as { code?: string }).code));
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await fa.update.mutateAsync({ fileId: editing.id, purpose: editing.purpose, notes: editing.notes.trim() || null });
      cmxMessage.success(t('saved'));
      setEditing(null);
    } catch (error) {
      cmxMessage.error(errorText((error as { code?: string }).code));
    }
  };

  const purposeOptions = purposes.map((p) => ({ value: p.purposeCode, label: locale === 'ar' ? p.name2 || p.name : p.name }));

  return (
    <section className={className} aria-label={title ?? t('title')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title ?? t('title')}</h3>
        <div className="flex flex-wrap gap-2">
          {stageOptions.length > 1 && (
            <CmxSelect
              aria-label={t('filterByStage')}
              value={activeStage}
              onChange={(e) => setStageFilter(e.target.value)}
              options={[{ value: ALL, label: t('allStages') }, ...stageOptions]}
              className="w-44"
            />
          )}
          {purposes.length > 1 && fa.files.length > 0 && (
            <CmxSelect
              aria-label={t('filterByPurpose')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={[{ value: ALL, label: t('allPurposes') }, ...purposeOptions]}
              className="w-44"
            />
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {purposes.length > 1 && (
              <CmxSelect
                label={t('purpose')}
                value={selected?.purposeCode ?? ''}
                onChange={(e) => setPurpose(e.target.value)}
                options={purposeOptions}
                disabled={fa.configLoading}
              />
            )}
            <CmxTextarea
              aria-label={t('notes')}
              placeholder={t('notesPlaceholder')}
              value={notes}
              maxLength={2000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <CmxFileDropZone
              className="flex-1"
              disabled={!fa.ready || !selected}
              acceptMimeTypes={accept}
              maxSizeBytes={selected?.maxSizeBytes}
              onFiles={startUpload}
              onReject={onReject}
              hint={selected ? t('dropHint', { size: formatFileSize(selected.maxSizeBytes) }) : undefined}
            />
            {canPhoto && (
              <CmxButton variant="outline" onClick={() => setCameraOpen(true)} disabled={!fa.ready} className="sm:self-stretch sm:h-auto">
                <Camera className="h-4 w-4" aria-hidden />
                {t('takePhoto')}
              </CmxButton>
            )}
          </div>

          {fa.uploads.length > 0 && (
            <ul className="space-y-2" aria-live="polite">
              {fa.uploads.map((u) => (
                <li key={u.key} className="rounded-[var(--cmx-radius-md,0.375rem)] border border-border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{u.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {u.status === 'error' ? errorText(u.errorCode) : t(`status.${u.status}`)}
                    </span>
                    {u.status === 'error' && (
                      <CmxButton size="icon" variant="ghost" className="h-7 w-7" onClick={() => fa.retry(u.key)} aria-label={tCommon('retry')}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      </CmxButton>
                    )}
                    {u.status !== 'done' && (
                      <CmxButton size="icon" variant="ghost" className="h-7 w-7" onClick={() => fa.cancel(u.key)} aria-label={tCommon('cancel')}>
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </CmxButton>
                    )}
                  </div>
                  {(u.status === 'uploading' || u.status === 'verifying') && <CmxProgressBar value={u.progress} size="sm" className="mt-1" />}
                </li>
              ))}
              {fa.uploads.some((u) => u.status === 'done') && (
                <li>
                  <CmxButton size="sm" variant="ghost" onClick={fa.clearDone}>
                    {t('clearDone')}
                  </CmxButton>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {fa.filesError ? (
        <div className="flex items-center gap-2 text-sm" role="alert">
          <span>{errorText(fa.filesError)}</span>
          <CmxButton size="sm" variant="outline" onClick={() => void fa.reload()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxFileGallery
          items={items}
          loading={fa.filesLoading}
          readOnly={readOnly}
          onOpen={setViewIndex}
          onEdit={(item) => {
            const file = fa.files.find((f) => f.id === item.id);
            if (file) setEditing({ id: file.id, purpose: file.purposeCode, notes: file.notes ?? '' });
          }}
          onDelete={(item) => void onDelete(item)}
          emptyLabel={t('empty')}
        />
      )}

      <CmxFileViewerDialog items={items} index={viewIndex} onIndexChange={setViewIndex} />
      {!readOnly && (
        <CmxCameraCaptureDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(photo) => startUpload([photo])} />
      )}

      <CmxDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('editTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          {editing && (
            <div className="space-y-3">
              {purposes.length > 1 && (
                <CmxSelect
                  label={t('purpose')}
                  value={editing.purpose}
                  onChange={(e) => setEditing({ ...editing, purpose: e.target.value })}
                  options={purposeOptions}
                />
              )}
              <CmxTextarea
                aria-label={t('notes')}
                placeholder={t('notesPlaceholder')}
                value={editing.notes}
                maxLength={2000}
                rows={3}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
          )}
          <CmxDialogFooter>
            <CmxButton variant="secondary" onClick={() => setEditing(null)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton onClick={() => void saveEdit()} loading={fa.update.isPending}>
              {tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </section>
  );
}
