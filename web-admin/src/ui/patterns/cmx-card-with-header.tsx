/**
 * CmxCardWithHeader - Composable card with optional header pattern
 * Replaces compat CardHeader with title/subtitle/actions
 * @module ui/patterns
 */

'use client';

import * as React from 'react';
import {
  CmxCard,
  CmxCardHeader,
  CmxCardTitle,
  CmxCardDescription,
  CmxCardContent,
  CmxCardFooter,
} from '@ui/primitives/cmx-card';

export interface CmxCardWithHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function CmxCardWithHeader({
  title,
  subtitle,
  actions,
  children,
  footer,
  className,
}: CmxCardWithHeaderProps) {
  return (
    <CmxCard className={className}>
      {(title || subtitle || actions) && (
        <CmxCardHeader className="flex flex-row items-center justify-between">
          <div>
            {title && <CmxCardTitle>{title}</CmxCardTitle>}
            {subtitle && <CmxCardDescription>{subtitle}</CmxCardDescription>}
          </div>
          {actions}
        </CmxCardHeader>
      )}
      <CmxCardContent>{children}</CmxCardContent>
      {footer && <CmxCardFooter>{footer}</CmxCardFooter>}
    </CmxCard>
  );
}
