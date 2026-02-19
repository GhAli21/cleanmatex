'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxCard, CmxSelect } from '@ui/primitives'

interface ExportModalProps {
  onClose: () => void
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const t = useTranslations('catalog')
  const [template, setTemplate] = useState<'basic' | 'advanced'>('advanced')

  function onDownload() {
    window.location.assign(`/api/v1/products/export?template=${template}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <CmxCard className="w-full max-w-lg p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('export')}</h2>
          <CmxButton variant="secondary" onClick={onClose}>{t('close')}</CmxButton>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('downloadTemplate')}</label>
            <CmxSelect
              value={template}
              onChange={(e) => setTemplate(e.target.value as 'basic' | 'advanced')}
              options={[
                { value: 'basic', label: t('basicTemplate') },
                { value: 'advanced', label: t('advancedTemplate') }
              ]}
            />
          </div>

          <div className="flex items-center justify-between">
            <CmxButton onClick={onDownload}>{t('download')}</CmxButton>
            <CmxButton variant="secondary" onClick={onClose}>{t('close')}</CmxButton>
          </div>
        </div>
      </CmxCard>
    </div>
  )
}
