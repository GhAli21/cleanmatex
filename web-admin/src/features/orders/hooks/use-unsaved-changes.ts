/**
 * use-unsaved-changes Hook
 * Warns user before navigating away with unsaved changes
 */

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to handle unsaved changes warning
 * @param hasUnsavedChanges - Function that returns true if there are unsaved changes
 * @param warningMessage - Custom warning message
 */
export function useUnsavedChanges(
  hasUnsavedChanges: () => boolean,
  warningMessage?: string
) {
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  // Warn before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
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

  // Intercept router navigation (use passed hasUnsavedChanges for both beforeunload and router)
  useEffect(() => {
    const originalPush = router.push;
    const originalReplace = router.replace;

    router.push = ((...args: Parameters<typeof router.push>) => {
      if (!isNavigatingRef.current && hasUnsavedChanges()) {
        const confirmed = window.confirm(
          warningMessage ||
            'You have unsaved changes. Are you sure you want to leave this page?'
        );
        if (!confirmed) {
          return Promise.resolve(false);
        }
        isNavigatingRef.current = true;
      }
      return originalPush.apply(router, args);
    }) as typeof router.push;

    router.replace = ((...args: Parameters<typeof router.replace>) => {
      if (!isNavigatingRef.current && hasUnsavedChanges()) {
        const confirmed = window.confirm(
          warningMessage ||
            'You have unsaved changes. Are you sure you want to leave this page?'
        );
        if (!confirmed) {
          return Promise.resolve(false);
        }
        isNavigatingRef.current = true;
      }
      return originalReplace.apply(router, args);
    }) as typeof router.replace;

    return () => {
      router.push = originalPush;
      router.replace = originalReplace;
    };
  }, [router, warningMessage, hasUnsavedChanges]);

  return {
    hasUnsavedChanges,
  };
}

