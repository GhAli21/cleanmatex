'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  localizeWorkflowProfileError,
  type WorkflowProfileErrorDetails,
} from '@/lib/services/workflow/workflow-profile-error-catalog';

/**
 * Resolves staff-facing copy for a PROFILE_* API code on floor and create UIs.
 *
 * @returns Locale sentence, or `fallback` when the code is not a profile error.
 */
export function useWorkflowProfileStaffMessage() {
  const tProfileErrors = useTranslations('workflow.profileErrors');
  const tEngine = useTranslations('workflow.engine');

  return useCallback((
    code?: string | null,
    fallback?: string,
    details?: WorkflowProfileErrorDetails,
  ) => {
    const localized = localizeWorkflowProfileError(tProfileErrors, code, details);
    if (localized) return localized;
    if (typeof code === 'string' && code.startsWith('PROFILE_')) {
      return tEngine('profileUnavailable');
    }
    return fallback;
  }, [tProfileErrors, tEngine]);
}
