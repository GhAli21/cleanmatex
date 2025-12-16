/**
 * CmxFormSection - Visual section grouping for forms
 * @module ui/forms
 */

import { ReactNode } from 'react'

interface CmxFormSectionProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

export function CmxFormSection({ title, description, children }: CmxFormSectionProps) {
  return (
    <section className="space-y-5 rounded-lg border-2 border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] p-5 md:p-6">
      <header className="border-b-2 border-[rgb(var(--cmx-border-rgb,226_232_240))] pb-3">
        <h2 className="text-base font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {description}
          </p>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
