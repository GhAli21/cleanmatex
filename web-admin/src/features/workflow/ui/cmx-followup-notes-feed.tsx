'use client';

/**
 * CmxFollowupNotesFeed
 * Reusable bilingual, RTL-safe follow-up notes feed + composer supporting all 4 order
 * target levels (ORDER, ITEM, PIECE, PREFERENCE). Can either save immediately via
 * `/api/v1/orders/[id]/notes-followup` or stage a draft note for batch save.
 */

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquarePlus, Send, Lock } from 'lucide-react';
import { CmxButton, CmxTextarea } from '@ui/primitives';
import { CmxCodeChip, CmxCollapsibleSection } from '@ui/data-display';
import { CmxStatusBadge, useMessage } from '@ui/feedback';
import type { PrefsFollowupNote } from '@/lib/utils/notes-followup';
import type { NotesFollowupTargetLevel } from '@/lib/constants/processing-trx';
import { PREFS_FOLLOWUP_NOTE_MAX_LEN, PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import { formatDateTime } from '@/lib/utils/rtl';
import { cn } from '@/lib/utils';

export interface CmxFollowupNotesFeedProps {
  orderId: string;
  targetLevel: NotesFollowupTargetLevel;
  targetId: string;
  notes: PrefsFollowupNote[] | null | undefined;
  /** Optional legacy/intake read-only note to display above the operational feed. */
  intakeNote?: string | null;
  intakeNoteLocked?: boolean;
  /** Screen/stage identifier stored on `note_source` & `sourceScreen` when appending directly. */
  noteSource?: string;
  sourceScreen?: string;
  /** Called after an immediate POST append succeeds with the refreshed notes + optional trx_code. */
  onNotesUpdated?: (notes: PrefsFollowupNote[], trxCode?: string) => void;
  /** Optional staged mode (for batch-save rows like ProcessingPieceRow / SimpleProcessingDialog). */
  stagedValue?: string;
  onStagedChange?: (nextText: string) => void;
  readOnly?: boolean;
  compact?: boolean;
  defaultOpen?: boolean;
  collapsible?: boolean;
  title?: string;
  className?: string;
}

export function CmxFollowupNotesFeed({
  orderId,
  targetLevel,
  targetId,
  notes,
  intakeNote,
  intakeNoteLocked = false,
  noteSource = PREFS_SOURCE_STAGE.ORDER_PROCESSING,
  sourceScreen = 'processing_detail',
  onNotesUpdated,
  stagedValue,
  onStagedChange,
  readOnly = false,
  compact = false,
  defaultOpen = false,
  collapsible = true,
  title,
  className,
}: CmxFollowupNotesFeedProps) {
  const t = useTranslations('processing');
  const locale = useLocale();
  const { showSuccess, showError } = useMessage();

  const [draft, setDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const isStagedMode = typeof onStagedChange === 'function';
  const currentDraft = isStagedMode ? (stagedValue ?? '') : draft;
  const noteList = React.useMemo(() => notes ?? [], [notes]);
  const cleanIntake = intakeNote?.trim() ?? '';

  const handleImmediateAppend = async () => {
    const clean = currentDraft.trim();
    if (!clean || submitting || readOnly) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/notes-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLevel,
          targetId,
          noteText: clean,
          noteSource,
          sourceScreen,
          recordPrcTrx: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: { notes?: PrefsFollowupNote[]; trxCode?: string };
      };

      if (!res.ok || !json.success) {
        showError(json.error || t('notes.saveError'));
        return;
      }

      setDraft('');
      const updatedNotes = json.data?.notes ?? [];
      const trxCode = json.data?.trxCode;
      onNotesUpdated?.(updatedNotes, trxCode);
      showSuccess(
        trxCode ? t('notes.savedWithTrx', { trxCode }) : t('notes.saved')
      );
    } catch {
      showError(t('notes.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const sectionTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <MessageSquarePlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium text-foreground">
        {title || t('notes.feedTitle')}
      </span>
      <CmxStatusBadge
        tone={noteList.length > 0 ? 'info' : 'neutral'}
        size="sm"
        label={String(noteList.length)}
      />
      {isStagedMode && currentDraft.trim().length > 0 && (
        <CmxStatusBadge tone="warning" size="sm" label={t('notes.stagedBadge')} />
      )}
    </div>
  );

  const feedBody = (
    <div className={cn('space-y-2.5', compact ? 'pt-1' : 'pt-2')}>
      {cleanIntake && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {intakeNoteLocked && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{t('notes.intakeNoteReadOnly')}</span>
          </div>
          <p className="text-xs text-foreground whitespace-pre-wrap">{cleanIntake}</p>
        </div>
      )}

      {noteList.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('notes.empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {noteList.map((entry) => (
            <div
              key={`${entry.note_seq}-${entry.note_datetime}`}
              className="rounded-md border border-border bg-card px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    {entry.note_user_name || entry.note_user_id || t('notes.operatorFallback')}
                  </span>
                  <CmxStatusBadge
                    tone="neutral"
                    size="sm"
                    label={t(`notes.sources.${entry.note_source}`, {
                      defaultValue: entry.note_source,
                    })}
                  />
                  {entry.trx_code && (
                    <CmxCodeChip code={entry.trx_code} kind="order" size="sm" />
                  )}
                </div>
                {entry.note_datetime && (
                  <time dateTime={entry.note_datetime} className="tabular-nums">
                    {formatDateTime(entry.note_datetime, locale === 'ar' ? 'ar' : 'en')}
                  </time>
                )}
              </div>
              <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">
                {entry.note_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="space-y-1.5">
          <CmxTextarea
            value={currentDraft}
            onChange={(e) => {
              const val = e.target.value.slice(0, PREFS_FOLLOWUP_NOTE_MAX_LEN);
              if (isStagedMode) {
                onStagedChange?.(val);
              } else {
                setDraft(val);
              }
            }}
            rows={compact ? 2 : 2}
            maxLength={PREFS_FOLLOWUP_NOTE_MAX_LEN}
            placeholder={
              isStagedMode ? t('notes.stagedPlaceholder') : t('notes.addPlaceholder')
            }
            aria-label={t('notes.addPlaceholder')}
            className="text-xs"
          />
          {!isStagedMode && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentDraft.length}/{PREFS_FOLLOWUP_NOTE_MAX_LEN}
              </span>
              <CmxButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={!currentDraft.trim() || submitting}
                loading={submitting}
                onClick={handleImmediateAppend}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                {t('notes.addButton')}
              </CmxButton>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className={cn('rounded-md border border-border bg-background p-3', className)}>
        <div className="mb-2">{sectionTitle}</div>
        {feedBody}
      </div>
    );
  }

  return (
    <CmxCollapsibleSection
      title={sectionTitle}
      defaultOpen={defaultOpen || noteList.length > 0}
      className={cn('rounded-md border border-border bg-background', className)}
      headerClassName="px-3 py-2"
      bodyClassName="px-3 pb-3"
    >
      {feedBody}
    </CmxCollapsibleSection>
  );
}
