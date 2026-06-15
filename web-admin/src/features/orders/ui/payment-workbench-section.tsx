/**
 * Collapsible shell for Payment Modal V4 center workbench sections.
 */

'use client';

import { useId, type ReactNode, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { PaymentModalSectionId } from './payment-modal-v04-sections-definition';

export interface PaymentWorkbenchSectionProps {
  sectionId: PaymentModalSectionId;
  expanded: boolean;
  collapsible: boolean;
  onToggle: (sectionId: PaymentModalSectionId) => void;
  sectionRef?: Ref<HTMLDivElement>;
  cardClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  titleClassName?: string;
  headerAside?: ReactNode;
  isRTL: boolean;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}

/**
 * Renders a workbench card with an optional corner collapse control.
 * Header stays visible when collapsed so operators can re-open the section quickly.
 */
export function PaymentWorkbenchSection({
  sectionId,
  expanded,
  collapsible,
  onToggle,
  sectionRef,
  cardClassName,
  headerClassName,
  contentClassName,
  title,
  description,
  titleClassName,
  headerAside,
  isRTL,
  expandLabel,
  collapseLabel,
  children,
}: PaymentWorkbenchSectionProps) {
  const panelId = useId();
  const toggleLabel = expanded ? collapseLabel : expandLabel;

  return (
    <div ref={sectionRef} tabIndex={-1} className="outline-none">
      <CmxCard className={cn('overflow-hidden shadow-sm', cardClassName)}>
        <CmxCardHeader className={cn('pb-3', expanded && 'border-b', headerClassName)}>
          <div
            className={cn(
              'flex items-start justify-between gap-3',
              isRTL ? 'flex-row-reverse text-right' : 'text-left'
            )}
          >
            <div className="min-w-0 flex-1">
              <CmxCardTitle className={cn('text-base text-slate-900', titleClassName)}>{title}</CmxCardTitle>
              {description ? (
                <p className={cn('mt-1 text-sm text-slate-600', isRTL ? 'text-right' : 'text-left')}>
                  {description}
                </p>
              ) : null}
            </div>
            <div
              className={cn(
                'flex shrink-0 items-center gap-2',
                isRTL ? 'flex-row-reverse' : ''
              )}
            >
              {headerAside}
              {collapsible ? (
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={toggleLabel}
                  title={toggleLabel}
                  onClick={() => onToggle(sectionId)}
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform duration-200', !expanded && '-rotate-90')}
                    aria-hidden
                  />
                </CmxButton>
              ) : null}
            </div>
          </div>
        </CmxCardHeader>
        {expanded ? (
          <CmxCardContent id={panelId} className={cn('pt-4', contentClassName)}>
            {children}
          </CmxCardContent>
        ) : null}
      </CmxCard>
    </div>
  );
}
