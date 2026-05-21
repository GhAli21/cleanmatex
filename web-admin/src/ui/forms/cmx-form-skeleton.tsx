/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxFormSkeleton - Premium loading placeholder for page and dialog forms.
 * It mirrors the updated form rhythm so async screens do not collapse into
 * generic gray bars while data is being prepared.
 * @module ui/forms
 */

'use client'

import { CmxSkeleton } from '@ui/primitives'

export interface CmxFormSkeletonProps {
  sections?: number
  fieldsPerSection?: number
  stickyActions?: boolean
}

/**
 * Skeleton intentionally follows the sectioned form silhouette so perceived
 * loading time feels shorter and layout shift stays low once data arrives.
 *
 * @param root0 Skeleton props.
 * @param root0.sections Number of section shells to render.
 * @param root0.fieldsPerSection Approximate field count inside each section shell.
 * @param root0.stickyActions Whether the action placeholder should stick to the bottom.
 * @returns Form-shaped loading placeholder.
 */
export function CmxFormSkeleton({
  sections = 2,
  fieldsPerSection = 4,
  stickyActions = false,
}: CmxFormSkeletonProps) {
  return (
    <div className="space-y-5">
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <div
          key={`section-${sectionIndex}`}
          className="rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] p-5 shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))]"
        >
          <CmxSkeleton className="h-5 w-40 rounded-full" />
          <CmxSkeleton className="mt-3 h-4 w-72 max-w-full rounded-full" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
              <div key={`field-${fieldIndex}`} className="space-y-2">
                <CmxSkeleton className="h-4 w-28 rounded-full" />
                <CmxSkeleton className="h-11 w-full rounded-[var(--cmx-radius-md,0.875rem)]" />
                <CmxSkeleton className="h-3 w-36 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div
        className={[
          'flex flex-col gap-3 rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] p-4 shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))]',
          stickyActions ? 'sticky bottom-0' : '',
        ].join(' ')}
      >
        <CmxSkeleton className="h-11 w-full rounded-[var(--cmx-radius-md,0.875rem)] md:ml-auto md:w-40" />
      </div>
    </div>
  )
}
