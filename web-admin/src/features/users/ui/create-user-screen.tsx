'use client'

/**
 * Create User Screen
 *
 * Full-page Add User form matching platform-web design.
 * Two-column layout: Account + Personal Info (left), Role & Access + Actions (right).
 * All API calls go through platform-api via lib/api/users.
 */

import { useTranslations } from 'next-intl'
import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { createUser } from '@/lib/api/users'
import { getAllRoles } from '@/lib/api/roles'
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions'
import { validateEmail, validatePassword } from '@/lib/auth/validation'
import type { CreateUserData } from '@/lib/api/users'
import type { TenantRole } from '@/lib/api/roles'
import type { BranchOption } from '@/lib/services/inventory-service'

// Fallback role options when API roles not available
const FALLBACK_ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'operator', label: 'Operator' },
  { value: 'tenant_admin', label: 'Tenant Administrator' },
  { value: 'branch_manager', label: 'Branch Manager' },
] as const

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  const roleOptions = roles.length
    ? roles.map((r) => ({ value: r.code, label: r.name || r.code }))
    : FALLBACK_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const emailError = validateEmail(formData.email)
    if (emailError) newErrors.email = emailError

    if (!formData.password) {
      newErrors.password = tValidation('passwordRequired')
    } else {
      const pw = validatePassword(formData.password)
      if (!pw.isValid) newErrors.password = pw.feedback.join('. ')
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = tValidation('passwordsMismatch')
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
    if (!validate() || !currentTenant) return

    setLoading(true)
    try {
      const createData: CreateUserData = {
        email: formData.email,
        password: formData.password,
        display_name: formData.display_name.trim(),
        role: formData.role,
        is_active: formData.is_active,
      }
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
    'mt-1 block w-full rounded-md shadow-sm sm:text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500'
  const inputError = 'border-red-300 focus:border-red-500 focus:ring-red-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" />
        {t('backToUsers')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {/* General Error */}
      {errors.general && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column - Account + Personal */}
          <div className="space-y-6 lg:col-span-2">
            {/* Account Information */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">{t('accountInfo')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('accountInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {tModal('emailLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`${inputBase} ${errors.email ? inputError : ''}`}
                    placeholder="user@example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('emailHelper')}</p>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {tModal('passwordLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`block w-full rounded-md shadow-sm sm:text-sm pr-10 ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      } focus:border-blue-500 focus:ring-blue-500`}
                      placeholder={tModal('passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t('passwordHelper')}</p>
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    {tModal('confirmPasswordLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className={`block w-full rounded-md shadow-sm sm:text-sm pr-10 ${
                        errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      } focus:border-blue-500 focus:ring-blue-500`}
                      placeholder={tModal('confirmPasswordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">{t('personalInfo')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('personalInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
                    {tModal('displayNameLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="display_name"
                    required
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className={`${inputBase} ${errors.display_name ? inputError : ''}`}
                    placeholder={tModal('displayNamePlaceholder')}
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('displayNameHelper')}</p>
                  {errors.display_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.display_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                      {t('firstName')}
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className={inputBase}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                      {t('lastName')}
                    </label>
                    <input
                      type="text"
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className={inputBase}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    {t('phone')}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputBase}
                    placeholder="+968 9123 4567"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t('fullNameEn')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputBase}
                    placeholder="John Doe"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('fullNameEnHelper')}</p>
                </div>

                <div>
                  <label htmlFor="name2" className="block text-sm font-medium text-gray-700">
                    {t('fullNameAr')}
                  </label>
                  <input
                    type="text"
                    id="name2"
                    value={formData.name2}
                    onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                    className={inputBase}
                    placeholder="أحمد محمد"
                    dir="rtl"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('fullNameArHelper')}</p>
                </div>

                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                    {t('userType')}
                  </label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={inputBase}
                  >
                    <option value="employee">{t('userTypeEmployee')}</option>
                    <option value="manager">{t('userTypeManager')}</option>
                    <option value="admin">{t('userTypeAdmin')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">{t('addressInfo')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('addressInfoDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    {t('address')}
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={inputBase}
                    placeholder={t('addressPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="area" className="block text-sm font-medium text-gray-700">
                      {t('areaDistrict')}
                    </label>
                    <input
                      type="text"
                      id="area"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className={inputBase}
                      placeholder={t('areaPlaceholder')}
                    />
                  </div>
                  <div>
                    <label htmlFor="building" className="block text-sm font-medium text-gray-700">
                      {t('building')}
                    </label>
                    <input
                      type="text"
                      id="building"
                      value={formData.building}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      className={inputBase}
                      placeholder={t('buildingPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="floor" className="block text-sm font-medium text-gray-700">
                    {t('floor')}
                  </label>
                  <input
                    type="text"
                    id="floor"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className={inputBase}
                    placeholder={t('floorPlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="main_branch_id" className="block text-sm font-medium text-gray-700">
                    {t('mainBranch')}
                  </label>
                  {branchesLoading ? (
                    <div className="mt-1 text-sm text-gray-500">Loading branches...</div>
                  ) : (
                    <>
                      <select
                        id="main_branch_id"
                        value={formData.main_branch_id}
                        onChange={(e) =>
                          setFormData({ ...formData, main_branch_id: e.target.value })
                        }
                        className={inputBase}
                      >
                        <option value="">{t('noBranchAssigned')}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">{t('mainBranchHelper')}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Role & Access + Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">{t('roleAccess')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('roleAccessDesc')}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    {tModal('roleLabel')} <span className="text-red-500">*</span>
                  </label>
                  {rolesLoading ? (
                    <div className="mt-1 text-sm text-gray-500">Loading roles...</div>
                  ) : (
                    <>
                      <select
                        id="role"
                        required
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className={`${inputBase} ${errors.role ? inputError : ''}`}
                      >
                        <option value="">{t('selectRolePlaceholder')}</option>
                        {roleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {errors.role && (
                        <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-700">
                        {t('accountActive')}
                      </span>
                      <span className="block text-xs text-gray-500">{t('accountActiveHelper')}</span>
                    </div>
                  </label>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formData.is_user}
                      onChange={(e) =>
                        setFormData({ ...formData, is_user: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-700">
                        {t('isUserAccount')}
                      </span>
                      <span className="block text-xs text-gray-500">{t('isUserHelper')}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {tCommon('saving')}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
                    {tModal('createUser')}
                  </>
                )}
              </button>
              <Link
                href="/dashboard/users"
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {tCommon('cancel')}
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
