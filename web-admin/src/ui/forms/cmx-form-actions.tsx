/**
 * CmxFormActions - Form submit and cancel actions
 * @module ui/forms
 */

import { CmxButton } from '../primitives/cmx-button'

interface CmxFormActionsProps {
  primaryLabel: string
  secondaryLabel?: string
  loading?: boolean
  onSecondaryClick?: () => void
}

export function CmxFormActions({
  primaryLabel,
  secondaryLabel,
  loading,
  onSecondaryClick,
}: CmxFormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      {secondaryLabel && (
        <CmxButton type="button" variant="ghost" onClick={onSecondaryClick}>
          {secondaryLabel}
        </CmxButton>
      )}
      <CmxButton type="submit" loading={loading}>
        {primaryLabel}
      </CmxButton>
    </div>
  )
}
