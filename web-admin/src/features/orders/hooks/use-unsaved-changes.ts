/**
 * use-unsaved-changes Hook
 * Warns user before navigating away with unsaved changes
 */

'use client';
/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { guardedInAppPath } from './guarded-in-app-path';

/**
 * Hook to handle unsaved changes warning
 * @param hasUnsavedChanges - Function that returns true if there are unsaved changes
 * @param warningMessage - Custom warning title/message
 */
export function useUnsavedChanges(
  hasUnsavedChanges: () => boolean,
  warningMessage?: string
) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const isNavigatingRef = useRef(false);
  const allowNextRef = useRef(false);
  const confirmingRef = useRef(false);

  const allowNextNavigation = useCallback(() => {
    allowNextRef.current = true;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNextRef.current) return;
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = warningMessage || 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, warningMessage]);

  useEffect(() => {
    const originalPush = router.push;
    const originalReplace = router.replace;

    const confirmLeave = async (): Promise<boolean> => {
      if (allowNextRef.current) {
        allowNextRef.current = false;
        return true;
      }
      if (isNavigatingRef.current || !hasUnsavedChanges()) {
        return true;
      }
      const confirmed = await cmxMessage.confirm({
        title: warningMessage || 'You have unsaved changes. Are you sure you want to leave this page?',
        variant: 'warning',
        confirmLabel: tCommon('confirm'),
        cancelLabel: tCommon('cancel'),
      });
      if (!confirmed) return false;
      isNavigatingRef.current = true;
      return true;
    };

    router.push = (async (...args: Parameters<typeof router.push>) => {
      if (!(await confirmLeave())) {
        return Promise.resolve(false);
      }
      return originalPush.apply(router, args);
    }) as typeof router.push;

    router.replace = (async (...args: Parameters<typeof router.replace>) => {
      if (!(await confirmLeave())) {
        return Promise.resolve(false);
      }
      return originalReplace.apply(router, args);
    }) as typeof router.replace;

    return () => {
      router.push = originalPush;
      router.replace = originalReplace;
    };
  }, [router, warningMessage, hasUnsavedChanges, tCommon]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a');
      if (!anchor) return;
      const next = guardedInAppPath({
        href: anchor.getAttribute('href'),
        target: anchor.getAttribute('target'),
        hasDownload: anchor.hasAttribute('download'),
        currentHref: window.location.href,
        primaryUnmodifiedClick: event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey,
      });
      if (!next || allowNextRef.current || !hasUnsavedChanges()) return;

      event.preventDefault();
      event.stopPropagation();
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      void (async () => {
        try {
          const confirmed = await cmxMessage.confirm({
            title: warningMessage || 'You have unsaved changes. Are you sure you want to leave this page?',
            variant: 'warning',
            confirmLabel: tCommon('confirm'),
            cancelLabel: tCommon('cancel'),
          });
          if (!confirmed) return;
          allowNextRef.current = true;
          router.push(next);
        } finally {
          confirmingRef.current = false;
        }
      })();
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [hasUnsavedChanges, router, tCommon, warningMessage]);

  return {
    hasUnsavedChanges,
    allowNextNavigation,
  };
}
