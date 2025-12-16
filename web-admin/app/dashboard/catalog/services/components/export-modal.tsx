'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'

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
      <Card className="w-full max-w-lg p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('export')}</h2>
          <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
        </div>

        <div className="space-y-4">
          <div>
            <Select
              label={t('downloadTemplate')}
              value={template}
              onChange={(e) => setTemplate(e.target.value as 'basic' | 'advanced')}
              options={[
                { value: 'basic', label: t('basicTemplate') },
                { value: 'advanced', label: t('advancedTemplate') }
              ]}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button onClick={onDownload}>{t('download')}</Button>
            <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
