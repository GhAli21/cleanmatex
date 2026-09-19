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

  return {
    hasUnsavedChanges,
    allowNextNavigation,
  };
}
