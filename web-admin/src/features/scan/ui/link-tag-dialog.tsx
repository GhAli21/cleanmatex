'use client';

/**
 * LinkTagDialog - link, change or remove the external tag of one piece (HFC P3b, T3.10).
 * Uses PUT/DELETE /api/v1/orders/pieces/:pieceId/external-tag, which runs the same checks as batch-update, so the
 * messages for a bad, code-like or in-use tag are the ones staff already see on the pieces screen.
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxScanInput, type CmxScanStatus } from '@ui/forms';
import { CmxCodeChip } from '@ui/data-display';
import { useMessage } from '@ui/feedback';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { pieceTagErrorMessage } from '@features/workflow/lib/piece-tag-error';
import { linkPieceTag, removePieceTag, type ApiErrorBody, type PieceTagSaved } from '../api/scan-api';

export interface LinkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieceId: string;
  pieceCode: string | null;
  currentTag: string | null;
  onSaved?: (saved: PieceTagSaved) => void;
}

const OWN_ERROR_CODES = ['PIECE_TAG_ORDER_CLOSED', 'PIECE_TAG_PIECE_REMOVED', 'PIECE_NOT_FOUND'];

export function LinkTagDialog(props: LinkTagDialogProps) {
  // Mounted per open so the status line starts empty each time.
  return props.open ? <LinkTagBody {...props} /> : null;
}

function LinkTagBody({ onOpenChange, pieceId, pieceCode, currentTag, onSaved }: LinkTagDialogProps) {
  const t = useTranslations('scan.linkTag');
  const tTag = useTranslations('processing.modal');
  const tCodes = useTranslations('codes');
  const { showSuccess } = useMessage();
  const { token } = useCSRFToken();
  const [status, setStatus] = React.useState<CmxScanStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const code = pieceCode ?? '';

  const errorText = (body: ApiErrorBody): string => {
    if (body.code && OWN_ERROR_CODES.includes(body.code)) return t(`errors.${body.code}`);
    return pieceTagErrorMessage(body, tTag) ?? t('errors.failed');
  };

  const save = async (tag: string | null) => {
    setBusy(true);
    setStatus(null);
    try {
      const outcome = tag === null ? await removePieceTag(pieceId, token) : await linkPieceTag(pieceId, tag, token);
      if (outcome.ok === false) {
        setStatus({ tone: 'error', message: errorText(outcome.body) });
        return;
      }
      const saved = outcome.data;
      showSuccess(
        saved.externalTag
          ? t('linked', { tag: saved.externalTag, pieceCode: code })
          : t('removedOk', { pieceCode: code }),
      );
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      setStatus({ tone: 'error', message: t('errors.failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={onOpenChange}>
      <CmxDialogContent className="text-start">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          <CmxDialogDescription>
            {t('description', { pieceCode: code })}
          </CmxDialogDescription>
        </CmxDialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">{t('current')}:</span>
            {currentTag ? <CmxCodeChip code={currentTag} kind="tag" /> : <span>{tCodes('noTag')}</span>}
          </div>
          <CmxScanInput
            label={t('inputLabel')}
            placeholder={t('placeholder')}
            submitLabel={t('submit')}
            status={status}
            busy={busy}
            onScan={(value) => save(value)}
            autoFocus
            dedupeMs={0}
          />
        </div>
        <CmxDialogFooter>
          {currentTag ? (
            <CmxButton type="button" variant="outline" disabled={busy} onClick={() => void save(null)} className="min-h-11">
              {t('remove')}
            </CmxButton>
          ) : null}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
