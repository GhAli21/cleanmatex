/**
 * CmxWizard - Multi-step wizard container
 * @module ui/patterns
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxButton } from '../primitives/cmx-button'

export interface WizardStep {
  id: string
  title: string
  description?: string
  isOptional?: boolean
  validate?: () => boolean | Promise<boolean>
}

export interface CmxWizardProps {
  steps: WizardStep[]
  currentStep: number
  onStepChange: (step: number) => void
  onComplete: () => void | Promise<void>
  canGoNext?: boolean
  canGoBack?: boolean
  isLoading?: boolean
  children: React.ReactNode
  className?: string
}

export const CmxWizard: React.FC<CmxWizardProps> = ({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  canGoNext = true,
  canGoBack = true,
  isLoading = false,
  children,
  className,
}) => {
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  const currentStepData = steps[currentStep]

  const handleNext = async () => {
    if (isLoading) return

    // Validate current step if validation function exists
    if (currentStepData?.validate) {
      const isValid = await currentStepData.validate()
      if (!isValid) return
    }

    if (isLastStep) {
      await onComplete()
    } else {
      onStepChange(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (isLoading || isFirstStep) return
    onStepChange(currentStep - 1)
  }

  const handleSkip = () => {
    if (isLoading || isLastStep || !currentStepData?.isOptional) return
    onStepChange(currentStep + 1)
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-4">
        <div className="flex gap-2">
          {/* Back button */}
          {!isFirstStep && (
            <CmxButton
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={!canGoBack || isLoading}
            >
              Back
            </CmxButton>
          )}

          {/* Skip button (only for optional steps) */}
          {currentStepData?.isOptional && !isLastStep && (
            <CmxButton
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
            >
              Skip
            </CmxButton>
          )}
        </div>

        <div className="flex gap-2">
          {/* Cancel button (always shown) */}
          <CmxButton
            type="button"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Are you sure you want to cancel? All progress will be lost.')) {
                window.history.back()
              }
            }}
            disabled={isLoading}
          >
            Cancel
          </CmxButton>

          {/* Next/Complete button */}
          <CmxButton
            type="button"
            variant="primary"
            onClick={handleNext}
            disabled={!canGoNext || isLoading}
            loading={isLoading}
          >
            {isLastStep ? 'Complete' : 'Next'}
          </CmxButton>
        </div>
      </div>

      {/* Step indicator text */}
      <div className="text-center text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        Step {currentStep + 1} of {steps.length}
        {currentStepData?.isOptional && ' (Optional)'}
      </div>
    </div>
  )
}

CmxWizard.displayName = 'CmxWizard'
