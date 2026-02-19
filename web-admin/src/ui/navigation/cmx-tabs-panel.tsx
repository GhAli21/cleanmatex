/**
 * CmxTabsPanel - High-level tabs wrapper with tabs[] API
 * Compatible with the legacy Tabs component from components/ui
 * @module ui/navigation
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CmxTabs, CmxTabsList, CmxTabsTrigger, CmxTabsContent } from '@ui/primitives/tabs';

export interface CmxTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface CmxTabsPanelProps {
  tabs: CmxTabItem[];
  defaultTab?: string;
  /** Controlled mode: when provided, active tab is controlled by parent */
  value?: string;
  /** Called when tab changes (use with value for controlled mode) */
  onChange?: (tabId: string) => void;
  className?: string;
}

export const CmxTabsPanel: React.FC<CmxTabsPanelProps> = ({
  tabs,
  defaultTab,
  value,
  onChange,
  className = '',
}) => {
  const defaultValue = defaultTab ?? tabs[0]?.id;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = isControlled ? value : internalValue;

  const handleValueChange = (v: string) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  return (
    <div className={cn('w-full', className)}>
      <CmxTabs
        value={activeValue}
        onValueChange={handleValueChange}
        defaultValue={isControlled ? undefined : defaultValue}
        className="w-full"
      >
        <CmxTabsList
          className={cn(
            'w-full justify-start rounded-none border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]',
            'bg-transparent p-0 h-auto gap-0'
          )}
        >
          {tabs.map((tab) => (
            <CmxTabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={cn(
                'rounded-none border-b-2 border-transparent data-[state=active]:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
                'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
                'data-[state=active]:text-[rgb(var(--cmx-primary-rgb,14_165_233))]',
                'hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))] hover:border-[rgb(var(--cmx-border-rgb,226_232_240))]',
                'px-1 py-4 mx-1'
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon && <span className="text-lg">{tab.icon}</span>}
                {tab.label}
              </span>
            </CmxTabsTrigger>
          ))}
        </CmxTabsList>
        {tabs.map((tab) => (
          <CmxTabsContent key={tab.id} value={tab.id} className="mt-6">
            <div className="contents">{tab.content}</div>
          </CmxTabsContent>
        ))}
      </CmxTabs>
    </div>
  );
};

CmxTabsPanel.displayName = 'CmxTabsPanel';
