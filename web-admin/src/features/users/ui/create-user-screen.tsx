'use client'

/**
 * Create User Screen
 *
 * Full-page Add User form matching platform-web design.
 * Two-column layout: Account + Personal Info (left), Role & Access + Actions (right).
 * All API calls go through platform-api via lib/api/users.
 */

import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect, Label } from '@ui/primitives'
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import { createUser, lookupGlobalUser } from '@/lib/api/users'
import { getAllRoles } from '@/lib/api/roles'
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions'
import { validateEmail, validatePassword } from '@/lib/auth/validation'
import type { CreateUserData, GlobalUserLookup } from '@/lib/api/users'
import type { TenantRole } from '@/lib/api/roles'
import type { BranchOption } from '@/lib/services/inventory-service'

/**
 *
 */
export default function CreateUserScreen() {
  const t = useTranslations('users.create')
  const tModal = useTranslations('users.modal')
  const tValidation = useTranslations('users.validation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { currentTenant, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    name: '',
    name2: '',
    type: 'employee',
    address: '',
    area: '',
    building: '',
    floor: '',
    main_branch_id: '',
    role: '',
    is_active: true,
    is_user: true,
  })

  const [roles, setRoles] = useState<TenantRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [lookup, setLookup] = useState<GlobalUserLookup | null>(null)
  const lookupSeq = useRef(0)
  const reusesLogin = lookup?.outcome === 'add' || lookup?.outcome === 'activate'

  // Fetch roles
  useEffect(() => {
    if (!accessToken) return
    const load = async () => {
      try {
        const list = await getAllRoles(accessToken)
        setRoles(list.filter((r) => r.is_active && r.code !== 'super_admin'))
      } catch (err) {
        console.error('Failed to load roles:', err)
      } finally {
        setRolesLoading(false)
      }
    }
    load()
  }, [accessToken])

  // Fetch branches
  useEffect(() => {
    if (!currentTenant) return
    getBranchesAction().then((r) => {
      if (r.success && r.data) setBranches(r.data)
    }).finally(() => setBranchesLoading(false))
  }, [currentTenant])

  const fallbackRoleOptions = [
    { value: 'viewer', label: t('fallbackViewer') },
    { value: 'operator', label: t('fallbackOperator') },
    { value: 'tenant_admin', label: t('fallbackTenantAdmin') },
    { value: 'branch_manager', label: t('fallbackBranchManager') },
  ]
  const roleOptions = roles.length
    ? roles.map((r) => ({ value: r.code, label: r.name || r.code }))
    : fallbackRoleOptions

  const runLookup = async (): Promise<GlobalUserLookup | null> => {
    if (!currentTenant || !accessToken) return null
    const email = formData.email.trim()
    const phone = formData.phone.trim()
    const seq = ++lookupSeq.current
    if (!email && !phone) {
      setLookup(null)
      return null
    }
    try {
      const result = await lookupGlobalUser(
        currentTenant.tenant_id,
        { email: email || undefined, phone: phone || undefined },
        accessToken
      )
      if (seq !== lookupSeq.current) return result
      setLookup(result)
      return result
    } catch (err) {
      if (seq !== lookupSeq.current) return null
      console.error('Failed to look up the global user:', err)
      cmxMessage.error(t('lookupFailed'))
      return null
    }
  }

  const validate = (found: GlobalUserLookup | null = lookup): boolean => {
    const newErrors: Record<string, string> = {}
    const emailError = validateEmail(formData.email)
    if (emailError) newErrors.email = emailError

    if (found?.outcome === 'open') {
      newErrors.general = t('lookupOpen')
    }

    const reuse = found?.outcome === 'add' || found?.outcome === 'activate'
    if (!reuse && found?.outcome !== 'open') {
      if (!formData.password) {
        newErrors.password = tValidation('passwordRequired')
      } else {
        const pw = validatePassword(formData.password)
        if (!pw.isValid) newErrors.password = pw.feedback.join('. ')
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = tValidation('passwordsMismatch')
      }
    }

    if (!formData.display_name?.trim()) {
      newErrors.display_name = tValidation('displayNameRequired')
    }

    if (!formData.role) {
      newErrors.role = t('roleRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = lookup ?? (await runLookup())
    const reuse = found?.outcome === 'add' || found?.outcome === 'activate'
    if (!validate(found) || !currentTenant || found?.outcome === 'open') return

    setLoading(true)
    try {
      const createData: CreateUserData = {
        email: formData.email,
        display_name: formData.display_name.trim(),
        role: formData.role,
        is_active: formData.is_active,
      }
      if (!reuse) createData.password = formData.password
      if (formData.first_name?.trim()) createData.first_name = formData.first_name.trim()
      if (formData.last_name?.trim()) createData.last_name = formData.last_name.trim()
      if (formData.phone?.trim()) createData.phone = formData.phone.trim()
      if (formData.name?.trim()) createData.name = formData.name.trim()
      if (formData.name2?.trim()) createData.name2 = formData.name2.trim()
      if (formData.type) createData.type = formData.type
      if (formData.address?.trim()) createData.address = formData.address.trim()
      if (formData.area?.trim()) createData.area = formData.area.trim()
      if (formData.building?.trim()) createData.building = formData.building.trim()
      if (formData.floor?.trim()) createData.floor = formData.floor.trim()
      if (formData.main_branch_id?.trim())
        createData.main_branch_id = formData.main_branch_id.trim()

      const result = await createUser(currentTenant.tenant_id, createData, accessToken)

      if (result.success) {
        router.push('/dashboard/users')
      } else {
        setErrors({ general: result.error || result.message || tValidation('operationFailed') })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      console.error('Create user error:', err)
      setErrors({ general: msg })
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    'mt-1 block w-full rounded-md shadow-sm sm:text-sm border-border focus:border-ring focus:ring-ring'
  const inputError = 'border-danger-border focus:border-destructive focus:ring-destructive'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 me-1" />
        {t('backToUsers')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* General Error */}
      {errors.general && (
        <div className="rounded-md bg-danger-bg p-4">
          <p className="text-sm text-danger-text">{errors.general}</p>
        </div>
      )}

      {lookup && lookup.outcome !== 'new' ? (
        <CmxSummaryMessage
          type={lookup.outcome === 'open' ? 'info' : 'warning'}
          title={t(
            lookup.outcome === 'add'
              ? 'lookupAdd'
              : lookup.outcome === 'activate'
                ? 'lookupActivate'
                : 'lookupOpen'
          )}
          items={[]}
        />
      ) : null}
      {lookup?.outcome === 'open' && lookup.membershipId ? (
        <Link
          href={`/dashboard/users/${lookup.membershipId}`}
          className="inline-flex text-sm font-medium text-primary-text"
        >
          {t('lookupOpenAction')}
        </Link>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column - Account + Personal */}
          <div className="space-y-6 lg:col-span-2">
            {/* Account Information */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('accountInfo')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('accountInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="email" className="mb-1 block">
                    {tModal('emailLabel')} <span className="text-danger-text">*</span>
                  </Label>
                  <CmxInput
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setLookup(null)
                      setFormData({ ...formData, email: e.target.value })
                    }}
                    onBlur={() => {
                      void runLookup()
                    }}
                    dir="ltr"
                    error={errors.email}
                    helpText={t('emailHelper')}
                    placeholder="user@example.com"
                  />
                </div>

                {!reusesLogin && lookup?.outcome !== 'open' ? (
                <>
                <div>
                  <Label htmlFor="password" className="mb-1 block">
                    {tModal('passwordLabel')} <span className="text-danger-text">*</span>
                  </Label>
                  <CmxInput
                    type="password"
                    id="password"
                    passwordToggle
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    dir="ltr"
                    error={errors.password}
                    helpText={t('passwordHelper')}
                    placeholder={tModal('passwordPlaceholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="mb-1 block">
                    {tModal('confirmPasswordLabel')}
                  </Label>
                  <CmxInput
                    type="password"
                    id="confirmPassword"
                    passwordToggle
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    dir="ltr"
                    error={errors.confirmPassword}
                    placeholder={tModal('confirmPasswordPlaceholder')}
                  />
                </div>
                </>
                ) : null}
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('personalInfo')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('personalInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="display_name" className="mb-1 block">
                    {tModal('displayNameLabel')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="display_name"
                    required
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    error={errors.display_name}
                    helpText={t('displayNameHelper')}
                    placeholder={tModal('displayNamePlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="first_name" className="mb-1 block">
                      {t('firstName')}
                    </Label>
                    <CmxInput
                      type="text"
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name" className="mb-1 block">
                      {t('lastName')}
                    </Label>
                    <CmxInput
                      type="text"
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="mb-1 block">
                    {t('phone')}
                  </Label>
                  <CmxInput
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      setLookup(null)
                      setFormData({ ...formData, phone: e.target.value })
                    }}
                    onBlur={() => {
                      void runLookup()
                    }}
                    dir="ltr"
                    className="tabular-nums"
                    placeholder="+968 9123 4567"
                  />
                </div>

                <div>
                  <Label htmlFor="name" className="mb-1 block">
                    {t('fullNameEn')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    helpText={t('fullNameEnHelper')}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="name2" className="mb-1 block">
                    {t('fullNameAr')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="name2"
                    value={formData.name2}
                    onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                    helpText={t('fullNameArHelper')}
                    placeholder="أحمد محمد"
                    dir="rtl"
                  />
                </div>

                <div>
                  <Label htmlFor="type" className="mb-1 block">
                    {t('userType')}
                  </Label>
                  <CmxSelect
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    options={[
                      { value: 'employee', label: t('userTypeEmployee') },
                      { value: 'manager', label: t('userTypeManager') },
                      { value: 'admin', label: t('userTypeAdmin') },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('addressInfo')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('addressInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="address" className="mb-1 block">
                    {t('address')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t('addressPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="area" className="mb-1 block">
                      {t('areaDistrict')}
                    </Label>
                    <CmxInput
                      type="text"
                      id="area"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder={t('areaPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="building" className="mb-1 block">
                      {t('building')}
                    </Label>
                    <CmxInput
                      type="text"
                      id="building"
                      value={formData.building}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      placeholder={t('buildingPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="floor" className="mb-1 block">
                    {t('floor')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="floor"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    placeholder={t('floorPlaceholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="main_branch_id" className="mb-1 block">
                    {t('mainBranch')}
                  </Label>
                  {branchesLoading ? (
                    <div className="mt-1 text-sm text-muted-foreground">{t('loadingBranches')}</div>
                  ) : (
                    <>
                      <CmxSelect
                        id="main_branch_id"
                        value={formData.main_branch_id}
                        onChange={(e) =>
                          setFormData({ ...formData, main_branch_id: e.target.value })
                        }
                        options={[
                          { value: '', label: t('noBranchAssigned') },
                          ...branches.map((b) => ({ value: b.id, label: b.name })),
                        ]}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{t('mainBranchHelper')}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Role & Access + Actions */}
          <div className="space-y-6">
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('roleAccess')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('roleAccessDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="role" className="mb-1 block">
                    {tModal('roleLabel')}
                  </Label>
                  {rolesLoading ? (
                    <div className="mt-1 text-sm text-muted-foreground">{t('loadingRoles')}</div>
                  ) : (
                    <CmxSelect
                      id="role"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      error={errors.role}
                      options={[
                        { value: '', label: t('selectRolePlaceholder') },
                        ...roleOptions.map((opt) => ({ value: opt.value, label: opt.label })),
                      ]}
                    />
                  )}
                </div>

                <div className="pt-2">
                  <CmxCheckbox
                    id="create-user-active"
                    size="sm"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    label={t('accountActive')}
                    description={t('accountActiveHelper')}
                  />
                </div>

                <div className="pt-2">
                  <CmxCheckbox
                    id="create-user-account"
                    size="sm"
                    checked={formData.is_user}
                    onChange={(e) =>
                      setFormData({ ...formData, is_user: e.target.checked })
                    }
                    label={t('isUserAccount')}
                    description={t('isUserHelper')}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <CmxButton
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading || lookup?.outcome === 'open'}
                className="w-full"
              >
                <UserPlus className="h-5 w-5 me-2" aria-hidden="true" />
                {loading ? tCommon('saving') : tModal('createUser')}
              </CmxButton>
              <CmxButton variant="outline" className="w-full" asChild>
                <Link href="/dashboard/users">
                  {tCommon('cancel')}
                </Link>
              </CmxButton>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
