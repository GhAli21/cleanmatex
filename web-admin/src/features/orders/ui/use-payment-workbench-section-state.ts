'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildInitialWorkbenchSectionExpandedState,
  getPaymentModalSectionDefinition,
  type PaymentModalSectionExpandedState,
  type PaymentModalSectionId,
} from './payment-modal-v04-sections-definition';

/**
 * Manages expand/collapse state for Payment Modal V4 center workbench sections.
 *
 * @param open Whether the payment modal is currently open.
 */
export function usePaymentWorkbenchSectionState(open: boolean) {
  const [expandedBySection, setExpandedBySection] = useState<PaymentModalSectionExpandedState>(
    () => buildInitialWorkbenchSectionExpandedState()
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setExpandedBySection(buildInitialWorkbenchSectionExpandedState());
  }, [open]);

  const isSectionExpanded = useCallback(
    (sectionId: PaymentModalSectionId) => expandedBySection[sectionId] ?? true,
    [expandedBySection]
  );

  const isSectionCollapsible = useCallback((sectionId: PaymentModalSectionId) => {
    return getPaymentModalSectionDefinition(sectionId)?.collapsible ?? true;
  }, []);

  const expandSection = useCallback((sectionId: PaymentModalSectionId) => {
    setExpandedBySection((current) => {
      if (current[sectionId]) {
        return current;
      }
      return { ...current, [sectionId]: true };
    });
  }, []);

  const toggleSection = useCallback((sectionId: PaymentModalSectionId) => {
    if (!isSectionCollapsible(sectionId)) {
      return;
    }
    setExpandedBySection((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, [isSectionCollapsible]);

  return {
    expandedBySection,
    isSectionExpanded,
    isSectionCollapsible,
    expandSection,
    toggleSection,
  };
}
