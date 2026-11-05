'use client';

/**
 * GlobalScanTrigger - top-bar "Scan" button, Ctrl+Shift+F shortcut and page-wide scanner listener (HFC P3b, T3.10).
 * Hidden unless the tenant flag `human_codes_scan_labels` is on (default off; fails closed while flags load).
 * The page-wide listener only takes fast keyboard-wedge bursts typed outside a text field, so normal typing is safe.
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ScanLine } from 'lucide-react';
import { useFeatureFlagsQuery } from '@/lib/hooks/use-feature-flags';
import { useKeyboardWedge } from '@/lib/hooks/use-keyboard-wedge';
import { GlobalScanDialog } from './global-scan-dialog';

/** Raw flag key; added to the flag catalog in P6 (plan section 20). */
export const SCAN_LABELS_FLAG = 'human_codes_scan_labels';

/** True for Ctrl+Shift+F (Cmd+Shift+F on macOS), matched by physical key so it works on an Arabic layout. */
export function isScanShortcut(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>) {
  return event.code === 'KeyF' && event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
}

export function GlobalScanTrigger() {
  const flags = useFeatureFlagsQuery();
  const enabled = flags.data?.[SCAN_LABELS_FLAG] === true;
  return enabled ? <GlobalScanTriggerInner /> : null;
}

function GlobalScanTriggerInner() {
  const t = useTranslations('scan.trigger');
  const [open, setOpen] = React.useState(false);
  const [initialCode, setInitialCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isScanShortcut(event)) return;
      event.preventDefault();
      setInitialCode(null);
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useKeyboardWedge({
    enabled: !open,
    onScan: (code) => {
      setInitialCode(code);
      setOpen(true);
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInitialCode(null);
          setOpen(true);
        }}
        title={t('title')}
        aria-keyshortcuts="Control+Shift+F"
        className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="global-scan-trigger"
      >
        <ScanLine className="h-5 w-5" aria-hidden="true" />
        <span className="hidden md:inline">{t('label')}</span>
      </button>
      <GlobalScanDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setInitialCode(null);
        }}
        initialCode={initialCode}
      />
    </>
  );
}
