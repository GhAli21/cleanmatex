/**
 * CmxProgressSteps - Visual progress indicator for wizard
 * @module ui/navigation
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressStep {
  id: string
  title: string
  description?: string
}

export interface CmxProgressStepsProps {
  steps: ProgressStep[]
  currentStep: number
  completedSteps?: Set<number>
  onStepClick?: (stepIndex: number) => void
  className?: string
}

export const CmxProgressSteps: React.FC<CmxProgressStepsProps> = ({
  steps,
  currentStep,
  completedSteps = new Set(),
  onStepClick,
  className,
}) => {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index)
          const isCurrent = currentStep === index
          const isUpcoming = index > currentStep && !isCompleted
          const isClickable = onStepClick && (isCompleted || index < currentStep)

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center',
                index !== steps.length - 1 && 'flex-1'
              )}
            >
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  'group flex items-center gap-3',
                  isClickable && 'cursor-pointer hover:opacity-80',
                  !isClickable && 'cursor-default'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isCompleted && 'border-[rgb(var(--cmx-primary-rgb,14_165_233))] bg-[rgb(var(--cmx-primary-rgb,14_165_233))] text-white',
                    isCurrent && 'border-[rgb(var(--cmx-primary-rgb,14_165_233))] bg-white text-[rgb(var(--cmx-primary-rgb,14_165_233))]',
                    isUpcoming && 'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
                  )}
                >
                  {isCompleted ? (
                    // Checkmark icon
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <div className="hidden md:block text-left">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      isCurrent && 'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
                      isCompleted && 'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
                      isUpcoming && 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
                    )}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {step.description}
                    </div>
                  )}
                </div>
              </button>

              {/* Connector line */}
              {index !== steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 transition-colors',
                    isCompleted ? 'bg-[rgb(var(--cmx-primary-rgb,14_165_233))]' : 'bg-[rgb(var(--cmx-border-rgb,226_232_240))]'
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

CmxProgressSteps.displayName = 'CmxProgressSteps'
