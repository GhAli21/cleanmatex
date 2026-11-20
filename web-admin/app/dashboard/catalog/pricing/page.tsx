'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'
import { CmxCard } from '@ui/primitives/cmx-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table'
import { CatalogSectionGate } from '@features/catalog/ui/catalog-section-gate'

interface PriceList {
  id: string
  name: string
  name2: string | null
  price_list_type: 'standard' | 'express' | 'vip' | 'seasonal' | 'b2b' | 'promotional'
  effective_from: string | null
  effective_to: string | null
  is_default: boolean
  priority: number
  is_active: boolean
  item_count?: number
}

/**
 *
 */
export default function PricingPage() {
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<PriceList[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [name, setName] = useState('')
  const [name2, setName2] = useState('')
  const [type, setType] = useState<PriceList['price_list_type']>('standard')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [priority, setPriority] = useState<number>(0)
  const [isDefault, setIsDefault] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/price-lists')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load price lists')
      setLists(json.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load price lists')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/price-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name2: name2 || undefined,
          price_list_type: type,
          effective_from: from || undefined,
          effective_to: to || undefined,
          is_default: isDefault,
          priority,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create price list')
      // reset
      setName(''); setName2(''); setType('standard'); setFrom(''); setTo(''); setPriority(0); setIsDefault(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to create price list')
    } finally {
      setCreating(false)
    }
  }

  return (
    <CatalogSectionGate>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('pricing')}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-danger-text">{error}</div>
      )}

      {/* Create form */}
      <CmxCard className="p-4">
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <CmxInput placeholder={t('priceListName')} value={name} onChange={(e) => setName(e.target.value)} />
          <CmxInput placeholder={t('priceListNameAr')} value={name2} onChange={(e) => setName2(e.target.value)} />
          <CmxSelect
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            options={[
              { value: 'standard', label: t('standard') },
              { value: 'express', label: t('express') },
              { value: 'vip', label: t('vip') },
              { value: 'seasonal', label: t('seasonal') },
              { value: 'b2b', label: t('b2b') },
              { value: 'promotional', label: t('promotional') },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <CmxInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <CmxInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <CmxInput type="number" placeholder={t('pricingPage.priority')} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          <CmxSelect
            value={isDefault ? 'yes' : 'no'}
            onChange={(e) => setIsDefault(e.target.value === 'yes')}
            options={[
              { value: 'no', label: t('no') },
              { value: 'yes', label: t('yes') },
            ]}
          />
          <div className="flex gap-2">
            <CmxButton type="submit" disabled={creating} loading={creating}>{creating ? tCommon('loading') : tCommon('create')}</CmxButton>
          </div>
        </form>
      </CmxCard>

      {/* List */}
      <CmxCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-muted-foreground">{tCommon('loading')}</div>
        ) : lists.length === 0 ? (
          <div className="p-4 text-muted-foreground">{t('noPriceLists')}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full text-sm">
              <TableHeader>
                <TableRow className="bg-muted text-start">
                  <TableHead className="px-4 py-2">{t('priceListName')}</TableHead>
                  <TableHead className="px-4 py-2">{t('priceListType')}</TableHead>
                  <TableHead className="px-4 py-2">{t('effectiveFrom')}</TableHead>
                  <TableHead className="px-4 py-2">{t('effectiveTo')}</TableHead>
                  <TableHead className="px-4 py-2">{t('pricingPage.itemsCol')}</TableHead>
                  <TableHead className="px-4 py-2">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((pl) => (
                  <TableRow key={pl.id} className="border-t">
                    <TableCell className="px-4 py-2">{pl.name}</TableCell>
                    <TableCell className="px-4 py-2">{t(pl.price_list_type)}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{pl.effective_from ?? '-'}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{pl.effective_to ?? '-'}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{pl.item_count ?? 0}</TableCell>
                    <TableCell className="px-4 py-2">
                      <CmxButton size="sm" variant="secondary" onClick={() => window.location.assign(`/dashboard/catalog/pricing/${pl.id}`)}>
                        {tCommon('edit')}
                      </CmxButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CmxCard>
    </div>
    </CatalogSectionGate>
  )
}
