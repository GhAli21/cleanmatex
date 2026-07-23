'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CopyPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { CmxButton } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import { CmxTextarea } from '@ui/primitives'
import { CmxSwitch } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxDataTable } from '@ui/data-display'
import { CmxEmptyState } from '@ui/data-display'
import { CmxTabsPanel } from '@ui/navigation'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays'
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms'
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback'
import { WORKFLOW_SCREEN_KEYS } from '@/lib/constants/workflow-screens'
import type { SerializedScreenContract } from '@features/settings/workflows/model/screen-contract-types'
import {
  createOverrideFromSystemAction,
  createScreenContractAction,
  deleteScreenContractAction,
  updateScreenContractAction,
} from '@/app/actions/settings/screen-contracts-actions'

interface WorkflowConfigRow {
  id: string
  service_category_code: string | null
  is_active: boolean
  updated_at: string | null
  created_at: string
}

interface WorkflowsSettingsScreenProps {
  initialContracts: SerializedScreenContract[]
  initialConfigs: WorkflowConfigRow[]
}

const contractSchema = z.object({
  screenKey: z.string().min(1),
  statusesText: z.string().min(1),
  permissionsText: z.string().optional(),
  additionalFiltersJson: z.string().optional(),
  isActive: z.boolean(),
})

type ContractFormValues = z.infer<typeof contractSchema>

function splitCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Workflows settings: Workflow Config tab + Screen Contracts CRUD tab.
 */
export function WorkflowsSettingsScreen({
  initialContracts,
  initialConfigs,
}: WorkflowsSettingsScreenProps) {
  const t = useTranslations('workflowSettings')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const [contracts, setContracts] = useState(initialContracts)
  const [configs] = useState(initialConfigs)

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<SerializedScreenContract | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedScreenContract | null>(null)

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema) as Resolver<ContractFormValues>,
    defaultValues: {
      screenKey: 'processing',
      statusesText: 'processing',
      permissionsText: '',
      additionalFiltersJson: '{}',
      isActive: true,
    },
  })

  const screenKey = useWatch({ control: form.control, name: 'screenKey' })
  const isActive = useWatch({ control: form.control, name: 'isActive' })

  const resolveError = (code: string | undefined) => {
    if (!code) return tCommon('error')
    const key = `screenContracts.errors.${code}`
    if (t.has(key)) return t(key as never)
    return code
  }

  const screenLabel = (key: string) => {
    const i18nKey = `screenContracts.screens.${key}`
    if (t.has(i18nKey)) return t(i18nKey as never)
    return key
  }

  const openCreate = () => {
    form.reset({
      screenKey: 'processing',
      statusesText: 'processing',
      permissionsText: '',
      additionalFiltersJson: '{}',
      isActive: true,
    })
    setEditing(null)
    setDialogMode('create')
  }

  const openEdit = (row: SerializedScreenContract) => {
    if (row.is_system) {
      cmxMessage.warning(t('screenContracts.systemReadonly'))
      return
    }
    form.reset({
      screenKey: row.screen_key,
      statusesText: row.statuses.join(', '),
      permissionsText: row.required_permissions.join(', '),
      additionalFiltersJson: JSON.stringify(row.additional_filters ?? {}, null, 2),
      isActive: row.is_active,
    })
    setEditing(row)
    setDialogMode('edit')
  }

  const handleSubmit = (values: ContractFormValues) => {
    startTransition(async () => {
      const payload = {
        screenKey: values.screenKey,
        statuses: splitCsv(values.statusesText),
        requiredPermissions: splitCsv(values.permissionsText),
        additionalFiltersJson: values.additionalFiltersJson,
        isActive: values.isActive,
      }

      if (dialogMode === 'create') {
        const result = await createScreenContractAction(payload)
        if (result.success === false) {
          cmxMessage.error(resolveError(result.error))
          return
        }
        setContracts((prev) =>
          [...prev.filter((c) => c.id !== result.data.id), result.data].sort((a, b) =>
            a.screen_key.localeCompare(b.screen_key)
          )
        )
        cmxMessage.success(t('screenContracts.saved'))
        setDialogMode(null)
        return
      }

      if (!editing) return
      const result = await updateScreenContractAction(editing.id, payload)
      if (result.success === false) {
        cmxMessage.error(resolveError(result.error))
        return
      }
      setContracts((prev) =>
        prev.map((c) => (c.id === result.data.id ? result.data : c))
      )
      cmxMessage.success(t('screenContracts.updated'))
      setDialogMode(null)
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteScreenContractAction(deleteTarget.id)
      if (result.success === false) {
        cmxMessage.error(resolveError(result.error))
        return
      }
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
      cmxMessage.success(t('screenContracts.deleted'))
    })
  }

  const handleCreateOverride = (row: SerializedScreenContract) => {
    startTransition(async () => {
      const result = await createOverrideFromSystemAction(row.id)
      if (result.success === false) {
        cmxMessage.error(resolveError(result.error))
        return
      }
      setContracts((prev) =>
        [...prev, result.data].sort((a, b) => a.screen_key.localeCompare(b.screen_key))
      )
      cmxMessage.success(t('screenContracts.overrideCreated'))
      openEdit(result.data)
    })
  }

  const configColumns = [
    {
      key: 'service_category_code',
      header: t('workflowConfig.serviceCategory'),
      render: (row: WorkflowConfigRow) =>
        row.service_category_code || t('workflowConfig.defaultCategory'),
    },
    {
      key: 'is_active',
      header: tCommon('active'),
      render: (row: WorkflowConfigRow) => (
        <Badge variant={row.is_active ? 'success' : 'secondary'}>
          {row.is_active ? tCommon('active') : tCommon('inactive')}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      header: t('workflowConfig.updated'),
      render: (row: WorkflowConfigRow) =>
        new Date(row.updated_at || row.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      render: (row: WorkflowConfigRow) => (
        <CmxButton variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/settings/workflows/${row.id}/edit`}>
            <Pencil className="h-3.5 w-3.5 me-1" />
            {tCommon('edit')}
          </Link>
        </CmxButton>
      ),
    },
  ]

  const contractColumns = [
    {
      key: 'screen_key',
      header: t('screenContracts.screenKey'),
      sortable: true,
      render: (row: SerializedScreenContract) => (
        <div>
          <div className="font-medium">{screenLabel(row.screen_key)}</div>
          <div className="text-xs text-muted-foreground font-mono">{row.screen_key}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      header: t('screenContracts.scope'),
      render: (row: SerializedScreenContract) => (
        <Badge variant={row.is_system ? 'secondary' : 'default'}>
          {row.is_system ? t('screenContracts.system') : t('screenContracts.tenant')}
        </Badge>
      ),
    },
    {
      key: 'statuses',
      header: t('screenContracts.statuses'),
      render: (row: SerializedScreenContract) => (
        <div className="flex flex-wrap gap-1">
          {row.statuses.map((status) => (
            <Badge key={status} variant="outline" className="text-xs font-mono">
              {status}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: t('screenContracts.permissions'),
      render: (row: SerializedScreenContract) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.required_permissions.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            row.required_permissions.map((perm) => (
              <Badge key={perm} variant="secondary" className="text-xs font-mono">
                {perm}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: tCommon('active'),
      render: (row: SerializedScreenContract) => (
        <Badge variant={row.is_active ? 'success' : 'secondary'}>
          {row.is_active ? tCommon('active') : tCommon('inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      render: (row: SerializedScreenContract) => (
        <div className="flex items-center gap-1">
          {row.is_system ? (
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={() => handleCreateOverride(row)}
              disabled={isPending || contracts.some(
                (c) => !c.is_system && c.screen_key === row.screen_key
              )}
              title={t('screenContracts.createOverride')}
            >
              <CopyPlus className="h-3.5 w-3.5" />
            </CmxButton>
          ) : (
            <>
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={() => openEdit(row)}
                disabled={isPending}
              >
                <Pencil className="h-3.5 w-3.5" />
              </CmxButton>
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(row)}
                disabled={isPending}
                title={tCommon('delete')}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </CmxButton>
            </>
          )}
        </div>
      ),
    },
  ]

  const tabs = [
    {
      id: 'workflow-config',
      label: t('tabs.workflowConfig'),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CmxButton asChild>
              <Link href="/dashboard/settings/workflows/new">
                <Plus className="h-4 w-4 me-2" />
                {t('workflowConfig.addNew')}
              </Link>
            </CmxButton>
          </div>
          {configs.length === 0 ? (
            <CmxEmptyState title={t('workflowConfig.empty')} />
          ) : (
            <CmxDataTable columns={configColumns} data={configs} />
          )}
        </div>
      ),
    },
    {
      id: 'screen-contracts',
      label: t('tabs.screenContracts'),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CmxButton onClick={openCreate} disabled={isPending}>
              <Plus className="h-4 w-4 me-2" />
              {t('screenContracts.add')}
            </CmxButton>
          </div>
          {contracts.length === 0 ? (
            <CmxEmptyState title={t('screenContracts.empty')} />
          ) : (
            <CmxDataTable columns={contractColumns} data={contracts} />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <CmxTabsPanel tabs={tabs} defaultTab="screen-contracts" />

      <CmxDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDialogMode(null)
        }}
      >
        <CmxDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {dialogMode === 'edit'
                ? t('screenContracts.edit')
                : t('screenContracts.create')}
            </CmxDialogTitle>
          </CmxDialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">{t('screenContracts.screenKey')} *</label>
              <CmxSelectDropdown
                value={screenKey}
                onValueChange={(v) => form.setValue('screenKey', v)}
                disabled={dialogMode === 'edit'}
              >
                <CmxSelectDropdownTrigger>
                  <CmxSelectDropdownValue />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {WORKFLOW_SCREEN_KEYS.map((key) => (
                    <CmxSelectDropdownItem key={key} value={key}>
                      {screenLabel(key)}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>

            <div>
              <label className="text-sm font-medium">{t('screenContracts.statuses')} *</label>
              <CmxInput
                {...form.register('statusesText')}
                placeholder={t('screenContracts.statusesPlaceholder')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('screenContracts.statusesHint')}
              </p>
              {form.formState.errors.statusesText && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.statusesText.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">{t('screenContracts.permissions')}</label>
              <CmxInput
                {...form.register('permissionsText')}
                placeholder={t('screenContracts.permissionsPlaceholder')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('screenContracts.permissionsHint')}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">
                {t('screenContracts.additionalFilters')}
              </label>
              <CmxTextarea
                rows={4}
                className="font-mono text-xs"
                {...form.register('additionalFiltersJson')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('screenContracts.additionalFiltersHint')}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{tCommon('active')}</span>
              <CmxSwitch
                checked={isActive}
                onCheckedChange={(v) => form.setValue('isActive', v)}
              />
            </div>

            <CmxDialogFooter>
              <CmxButton
                type="button"
                variant="outline"
                onClick={() => setDialogMode(null)}
                disabled={isPending}
              >
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton type="submit" disabled={isPending}>
                {isPending ? tCommon('loading') : tCommon('save')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        </CmxDialogContent>
      </CmxDialog>

      <CmxConfirmDialog
        open={!!deleteTarget}
        title={t('screenContracts.deleteConfirmTitle')}
        description={t('screenContracts.deleteConfirmDesc', {
          screen: deleteTarget ? screenLabel(deleteTarget.screen_key) : '',
        })}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
