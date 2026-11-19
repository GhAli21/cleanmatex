/**
 * POS shortcuts cheat sheet (PR-04 Task 2), opened with `?` on the order screen.
 */

'use client';

import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays/cmx-dialog';
import { POS_HOTKEYS } from '../hooks/use-pos-hotkeys';

interface PosShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lists every POS hotkey with its translated meaning. Key names stay left-to-right in Arabic.
 *
 * @param props Open state and its setter.
 * @returns The dialog.
 */
export function PosShortcutsDialog({ open, onOpenChange }: PosShortcutsDialogProps) {
  const t = useTranslations('newOrder.shortcuts');
  return (
    <CmxDialog open={open} onOpenChange={onOpenChange} closeOnOverlayClick>
      <CmxDialogContent className="text-start">
        <CmxDialogHeader className="text-start">
          <CmxDialogTitle className="text-start">{t('title')}</CmxDialogTitle>
          <CmxDialogDescription className="text-start">{t('onlyNewOrder')}</CmxDialogDescription>
        </CmxDialogHeader>
        <ul className="divide-y divide-gray-200">
          {POS_HOTKEYS.map((row) => (
            <li key={row.labelKey} className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm text-gray-700">{t(row.labelKey)}</span>
              <kbd dir="ltr" className="shrink-0 rounded border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-800">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </CmxDialogContent>
    </CmxDialog>
  );
}
