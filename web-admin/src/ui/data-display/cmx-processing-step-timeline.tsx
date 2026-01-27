/**
 * CmxProcessingStepTimeline - Visual step tracker for processing workflow
 * Displays the 5 processing steps with current, completed, and upcoming states
 * @module ui/data-display
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';
import type { ProcessingStep, ProcessingStepConfig } from '@/types/order';

export interface ProcessingStepTimelineProps {
  currentStep?: ProcessingStep | null;
  completedSteps?: Set<ProcessingStep>;
  onStepClick?: (step: ProcessingStep) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Custom processing steps configuration. If provided, overrides default hardcoded steps */
  processingSteps?: ProcessingStepConfig[];
}

// Default hardcoded steps (fallback)
const DEFAULT_PROCESSING_STEPS: ProcessingStep[] = [
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
];

const DEFAULT_STEP_LABELS: Record<ProcessingStep, { en: string; ar: string }> = {
  sorting: { en: 'Sorting', ar: 'الفرز' },
  pretreatment: { en: 'Pretreatment', ar: 'المعالجة الأولية' },
  washing: { en: 'Washing', ar: 'الغسيل' },
  drying: { en: 'Drying', ar: 'التجفيف' },
  finishing: { en: 'Finishing', ar: 'الإنهاء' },
};

export function CmxProcessingStepTimeline({
  currentStep,
  completedSteps = new Set(),
  onStepClick,
  className,
  orientation = 'horizontal',
  showLabels = true,
  size = 'md',
  processingSteps,
}: ProcessingStepTimelineProps) {
  // Use custom steps if provided, otherwise use default
  const stepsConfig = React.useMemo(() => {
    if (processingSteps && processingSteps.length > 0) {
      // Sort by step_seq and filter active steps
      return processingSteps
        .filter(step => step.is_active)
        .sort((a, b) => a.step_seq - b.step_seq)
        .map(step => ({
          code: step.step_code as ProcessingStep,
          name: step.step_name,
          name2: step.step_name2,
        }));
    }
    // Fallback to default steps
    return DEFAULT_PROCESSING_STEPS.map(step => ({
      code: step,
      name: DEFAULT_STEP_LABELS[step].en,
      name2: DEFAULT_STEP_LABELS[step].ar,
    }));
  }, [processingSteps]);

  const getStepStatus = (stepCode: ProcessingStep) => {
    if (completedSteps.has(stepCode)) return 'completed';
    if (currentStep === stepCode) return 'current';
    return 'upcoming';
  };

  // Determine if a step is clickable
  // If onStepClick is provided, allow clicking on any step (for interactive selection)
  // Otherwise, only allow clicking on completed or current steps (for navigation)
  const isStepClickable = (stepCode: ProcessingStep, status: string) => {
    if (!onStepClick) return false;
    // For interactive selection, allow clicking on any step
    return true;
  };

  const sizeClasses = {
    sm: {
      circle: 'h-6 w-6',
      icon: 'h-3 w-3',
      text: 'text-xs',
      gap: 'gap-2',
    },
    md: {
      circle: 'h-8 w-8',
      icon: 'h-4 w-4',
      text: 'text-sm',
      gap: 'gap-3',
    },
    lg: {
      circle: 'h-10 w-10',
      icon: 'h-5 w-5',
      text: 'text-base',
      gap: 'gap-4',
    },
  };

  const currentSize = sizeClasses[size];

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col', currentSize.gap, className)}>
        {stepsConfig.map((step, index) => {
          const status = getStepStatus(step.code);
          const isClickable = isStepClickable(step.code, status);
          const isLast = index === stepsConfig.length - 1;

          return (
            <div key={step.code} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(step.code)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-all',
                    currentSize.circle,
                    status === 'completed' &&
                    'border-green-500 bg-green-500 text-white hover:bg-green-600',
                    status === 'current' &&
                    'border-blue-500 bg-blue-500 text-white ring-2 ring-blue-200',
                    status === 'upcoming' &&
                    'border-gray-300 bg-white text-gray-400',
                    isClickable && 'cursor-pointer hover:scale-110 hover:shadow-md transition-all',
                    !isClickable && 'cursor-default'
                  )}
                  aria-label={`Step ${index + 1}: ${step.name}`}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className={currentSize.icon} />
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}
                </button>
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 my-2 transition-colors',
                      status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
              {showLabels && (
                <div className="flex-1 pt-1">
                  <div
                    className={cn(
                      'font-medium',
                      currentSize.text,
                      status === 'current' && 'text-blue-600',
                      status === 'completed' && 'text-green-600',
                      status === 'upcoming' && 'text-gray-400'
                    )}
                  >
                    {step.name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout
  return (
    <nav
      aria-label="Processing steps"
      className={cn('w-full', className)}
      role="navigation"
    >
      <ol className="flex items-center justify-between">
        {stepsConfig.map((step, index) => {
          const status = getStepStatus(step.code);
          const isClickable = isStepClickable(step.code, status);
          const isLast = index === stepsConfig.length - 1;

          return (
            <li
              key={step.code}
              className={cn('flex items-center', !isLast && 'flex-1')}
            >
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.code)}
                disabled={!isClickable}
                className={cn(
                  'group flex flex-col items-center gap-2 transition-all',
                  isClickable && 'cursor-pointer hover:opacity-80',
                  !isClickable && 'cursor-default'
                )}
                aria-label={`Step ${index + 1}: ${step.name}`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-all',
                    currentSize.circle,
                    status === 'completed' &&
                    'border-green-500 bg-green-500 text-white',
                    status === 'current' &&
                    'border-blue-500 bg-blue-500 text-white ring-2 ring-blue-200 ring-offset-2',
                    status === 'upcoming' &&
                    'border-gray-300 bg-white text-gray-400',
                    isClickable && 'hover:scale-110 hover:shadow-md transition-all',
                    !isClickable && 'cursor-default'
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className={currentSize.icon} />
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}
                </div>
                {showLabels && (
                  <div
                    className={cn(
                      'font-medium text-center',
                      currentSize.text,
                      status === 'current' && 'text-blue-600',
                      status === 'completed' && 'text-green-600',
                      status === 'upcoming' && 'text-gray-400'
                    )}
                  >
                    {step.name}
                  </div>
                )}
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 transition-colors',
                    status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

CmxProcessingStepTimeline.displayName = 'CmxProcessingStepTimeline';

