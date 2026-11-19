'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxSelect } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

interface ExportModalProps {
  onClose: () => void
}

/**
 *
 * @param root0
 * @param root0.onClose
 */
export default function ExportModal({ onClose }: ExportModalProps) {
  const t = useTranslations('catalog')
  const [template, setTemplate] = useState<'basic' | 'advanced'>('advanced')

  function onDownload() {
    window.location.assign(`/api/v1/products/export?template=${template}`)
  }

  return (
    <CmxDialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <CmxDialogContent className="w-full max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('export')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          <CmxSelect
            label={t('downloadTemplate')}
            value={template}
            onChange={(e) => setTemplate(e.target.value as 'basic' | 'advanced')}
            options={[
              { value: 'basic', label: t('basicTemplate') },
              { value: 'advanced', label: t('advancedTemplate') }
            ]}
          />
        </div>

        <CmxDialogFooter className="justify-between">
          <CmxButton variant="secondary" onClick={onClose}>{t('close')}</CmxButton>
          <CmxButton onClick={onDownload}>{t('download')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
