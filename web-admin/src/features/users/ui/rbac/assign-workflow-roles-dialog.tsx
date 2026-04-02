'use client'

/**
 * AssignWorkflowRolesDialog — Assign operational workflow roles to a user.
 *
 * Workflow roles are independent from tenant/resource roles and control
 * which workflow stations the user can process orders at.
 *
 * Six roles displayed in a 2-column grid with icons:
 *   ROLE_RECEPTION, ROLE_PREPARATION, ROLE_PROCESSING,
 *   ROLE_QA, ROLE_DELIVERY, ROLE_ADMIN
 */

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Inbox,
  Package,
  Settings,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Info,
} from 'lucide-react'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCheckbox } from '@ui/primitives/cmx-checkbox'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog'
import { useUserRoleAssignments } from '@/lib/hooks/use-user-role-assignments'

interface AssignWorkflowRolesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  onSuccess: () => void
}

interface WorkflowRoleOption {
  code: string
  labelEn: string
  labelAr: string
  icon: React.ReactNode
}

const WORKFLOW_ROLE_OPTIONS: WorkflowRoleOption[] = [
  {
    code: 'ROLE_RECEPTION',
    labelEn: 'Reception',
    labelAr: 'الاستقبال',
    icon: <Inbox className="h-4 w-4" />,
  },
  {
    code: 'ROLE_PREPARATION',
    labelEn: 'Preparation',
    labelAr: 'التحضير',
    icon: <Package className="h-4 w-4" />,
  },
  {
    code: 'ROLE_PROCESSING',
    labelEn: 'Processing',
    labelAr: 'المعالجة',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    code: 'ROLE_QA',
    labelEn: 'Quality Assurance',
    labelAr: 'ضمان الجودة',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    code: 'ROLE_DELIVERY',
    labelEn: 'Delivery',
    labelAr: 'التوصيل',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    code: 'ROLE_ADMIN',
    labelEn: 'Workflow Admin',
    labelAr: 'مسؤول سير العمل',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
]

export function AssignWorkflowRolesDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: AssignWorkflowRolesDialogProps) {
  const t = useTranslations('users.rbac')
  const tCommon = useTranslations('common')

  const { workflowRoles, assignWorkflowRoles, loading } = useUserRoleAssignments(userId)

  // Currently assigned workflow role codes
  const assignedCodes = useMemo(
    () => new Set(workflowRoles.map((r) => r.workflow_role)),
    [workflowRoles]
  )

  const [selected, setSelected] = useState<Set<string>>(new Set(assignedCodes))
  const [saving, setSaving] = useState(false)

  // Re-sync selection when dialog opens
  useMemo(() => {
    setSelected(new Set(assignedCodes))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await assignWorkflowRoles(Array.from(selected))
      cmxMessage.success(t('assignWorkflowRolesSuccess'))
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('assignWorkflowRoles')}</CmxDialogTitle>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {userName}
          </p>
        </CmxDialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Info note */}
          <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 p-3">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">{t('workflowRolesInfo')}</p>
          </div>

          {/* Workflow role grid */}
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {WORKFLOW_ROLE_OPTIONS.map((opt) => {
                const isChecked = selected.has(opt.code)
                return (
                  <label
                    key={opt.code}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-[rgb(var(--cmx-primary-rgb,14_165_233))] bg-blue-50'
                        : 'border-[rgb(var(--cmx-border-rgb,226_232_240))] hover:bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]'
                    }`}
                  >
                    <CmxCheckbox
                      checked={isChecked}
                      onChange={() => toggle(opt.code)}
                      className="mt-0.5"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {opt.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))] leading-tight">
                          {opt.labelEn}
                        </p>
                        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" dir="rtl">
                          {opt.labelAr}
                        </p>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton onClick={handleSave} loading={saving} disabled={saving || loading}>
            {tCommon('save')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
