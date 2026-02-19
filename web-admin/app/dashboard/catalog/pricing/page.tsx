'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, Button, Input, Select } from '@ui/compat'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('pricing')}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {/* Create form */}
      <Card className="p-4">
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input placeholder={t('priceListName')} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={t('priceListNameAr')} value={name2} onChange={(e) => setName2(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="standard">{t('standard')}</option>
            <option value="express">{t('express')}</option>
            <option value="vip">{t('vip')}</option>
            <option value="seasonal">{t('seasonal')}</option>
            <option value="b2b">{t('b2b')}</option>
            <option value="promotional">{t('promotional')}</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Input type="number" placeholder="Priority" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          <select value={isDefault ? 'yes' : 'no'} onChange={(e) => setIsDefault(e.target.value === 'yes')}>
            <option value="no">{t('no')}</option>
            <option value="yes">{t('yes')}</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" disabled={creating}>{creating ? tCommon('loading') : tCommon('create')}</Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">{tCommon('loading')}</div>
        ) : lists.length === 0 ? (
          <div className="p-4 text-gray-500">{t('noPriceLists')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2">{t('priceListName')}</th>
                  <th className="px-4 py-2">{t('priceListType')}</th>
                  <th className="px-4 py-2">{t('effectiveFrom')}</th>
                  <th className="px-4 py-2">{t('effectiveTo')}</th>
                  <th className="px-4 py-2">Items</th>
                  <th className="px-4 py-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((pl) => (
                  <tr key={pl.id} className="border-t">
                    <td className="px-4 py-2">{pl.name}</td>
                    <td className="px-4 py-2">{pl.price_list_type}</td>
                    <td className="px-4 py-2">{pl.effective_from ?? '-'}</td>
                    <td className="px-4 py-2">{pl.effective_to ?? '-'}</td>
                    <td className="px-4 py-2">{pl.item_count ?? 0}</td>
                    <td className="px-4 py-2">
                      <Button size="sm" variant="secondary" onClick={() => window.location.assign(`/dashboard/catalog/pricing/${pl.id}`)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
