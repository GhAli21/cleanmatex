/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxWizardStep - Individual wizard step wrapper
 * @module ui/patterns
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CmxWizardStepProps {
  stepId: string
  currentStep: number
  stepIndex: number
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export const CmxWizardStep: React.FC<CmxWizardStepProps> = ({
  stepId,
  currentStep,
  stepIndex,
  title,
  description,
  children,
  className,
}) => {
  const isActive = currentStep === stepIndex

  // Only render if this is the active step
  if (!isActive) {
    return null
  }

  return (
    <div className={cn('space-y-6 animate-in fade-in-50 duration-200', className)}>
      {/* Step header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Step content */}
      <div>{children}</div>
    </div>
  )
}

CmxWizardStep.displayName = 'CmxWizardStep'
