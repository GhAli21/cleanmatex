'use client'

/**
 * Login Page
 *
 * Brand-led authentication entry point for tenant users.
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, LockKeyhole, User } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { validateLoginIdentifier, normalizeLoginIdentifier } from '@/lib/auth/login-identifier'
import { LOGIN_ERROR_CODES } from '@/lib/constants/auth-user'
import { LOGIN_REASONS, SESSION_ERROR_CODES } from '@/lib/constants/auth-session'
import { getSafeRedirectPath } from '@/lib/security/safe-redirect'
import { setLocale as persistLocale, type Locale } from '@/lib/utils/locale.client'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import { Alert, AlertDescription, CmxButton, CmxCheckbox, CmxInput } from '@ui/primitives'
import { CmxForm, CmxFormField } from '@ui/forms'

interface LoginFormValues {
  /** User code or email. */
  identifier: string
  password: string
  rememberMe: boolean
}

function getLoginErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

/**
 * Toggle between English and Arabic directly from the login entry point.
 *
 * @returns Compact locale switcher for auth screens.
 */
function LoginLanguageSwitcher() {
  const router = useRouter()
  const locale = useLocale() as Locale
  const t = useTranslations('auth.login')

  const handleLanguageChange = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return
    }

    persistLocale(nextLocale)
    router.refresh()
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/72 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <CmxButton
        type="button"
        size="sm"
        variant={locale === 'en' ? 'primary' : 'ghost'}
        className={`h-9 rounded-full px-4 text-xs font-semibold tracking-[0.18em] ${
          locale === 'en'
            ? 'bg-slate-900 text-white hover:bg-slate-800'
            : 'text-slate-600 hover:bg-white/80'
        }`}
        aria-label={t('languageEnglish')}
        aria-pressed={locale === 'en'}
        onClick={() => handleLanguageChange('en')}
      >
        EN
      </CmxButton>
      <CmxButton
        type="button"
        size="sm"
        variant={locale === 'ar' ? 'primary' : 'ghost'}
        className={`h-9 rounded-full px-4 text-xs font-semibold ${
          locale === 'ar'
            ? 'bg-slate-900 text-white hover:bg-slate-800'
            : 'text-slate-600 hover:bg-white/80'
        }`}
        aria-label={t('languageArabic')}
        aria-pressed={locale === 'ar'}
        onClick={() => handleLanguageChange('ar')}
      >
        عربي
      </CmxButton>
    </div>
  )
}

/**
 * Render the redesigned tenant login screen with CleanMateX brand assets.
 *
 * @returns Full-screen login experience.
 */
export default function LoginPage() {
  const searchParams = useSearchParams()
  const { signIn, isLoading } = useAuth()
  const t = useTranslations('auth')

  const form = useForm<LoginFormValues>({
    defaultValues: {
      identifier: '',
      password: '',
      rememberMe: false,
    },
  })

  const [showPassword, setShowPassword] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Why the user is here (idle timeout, revoked, ...) and where to return to after signing in. Both come from
  // the URL, so both are validated: unknown reasons show nothing; the return path must be a safe internal path.
  const reasonParam = searchParams.get('reason')
  const loginReason = (Object.values(LOGIN_REASONS) as string[]).includes(reasonParam ?? '') ? reasonParam : null
  const redirectTo = getSafeRedirectPath(searchParams.get('redirect'))
  const rememberMe = useWatch({
    control: form.control,
    name: 'rememberMe',
  })
  const isSubmitting = form.formState.isSubmitting || isLoading

  const handleSubmit = async (values: LoginFormValues) => {
    setGeneralError(null)
    form.clearErrors()

    const identifierError = validateLoginIdentifier(values.identifier)
    const identifierMessages = {
      required: t('login.identifierRequired'),
      invalid_email: t('login.identifierInvalidEmail'),
      invalid_user_code: t('login.identifierInvalidUserCode'),
    } as const

    if (identifierError) {
      form.setError('identifier', {
        type: 'manual',
        message: identifierMessages[identifierError],
      })
    }

    if (!values.password) {
      form.setError('password', {
        type: 'manual',
        message: t('login.passwordRequired'),
      })
    }

    if (identifierError || !values.password) {
      return
    }

    try {
      await signIn(normalizeLoginIdentifier(values.identifier), values.password, values.rememberMe, redirectTo)
    } catch (error: unknown) {
      // Unknown identifier and wrong password share one server code (no account enumeration).
      const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined
      setGeneralError(
        code === LOGIN_ERROR_CODES.INVALID_CREDENTIALS
          ? t('login.invalidCredentials')
          : code === SESSION_ERROR_CODES.SESSION_LIMIT_REACHED
            ? t('login.sessionLimitReached')
            : getLoginErrorMessage(error, t('login.invalidCredentials'))
      )
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[rgb(var(--cmx-background-rgb,255_255_255))]">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50 to-slate-100" />
      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[rgb(var(--cmx-primary-rgb,14_165_233))]/12 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-900/8 blur-3xl" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(115deg, rgba(255,255,255,0.82) 0%, transparent 24%, rgba(255,255,255,0.3) 42%, transparent 62%, rgba(255,255,255,0.26) 100%)',
        }}
      />

      <div
        aria-hidden="true"
        className="absolute left-[-7rem] top-[8%] hidden h-[28rem] w-[28rem] rotate-[-10deg] opacity-12 lg:block"
      >
        <Image
          src="/brand/cleanmatex-x-mark.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 28rem, 0px"
          className="object-contain"
          priority
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-[8%] right-[4%] hidden h-20 w-20 opacity-30 sm:block"
      >
        <Image
          src="/brand/cleanmatex-x-mark.png"
          alt=""
          fill
          sizes="(min-width: 640px) 5rem, 0px"
          className="object-contain"
          loading="eager"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl">
          <div className="mb-6 flex justify-end">
            <LoginLanguageSwitcher />
          </div>

          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_31rem] xl:gap-12">
            <div className="hidden lg:flex lg:flex-col lg:items-start lg:justify-center lg:gap-6 lg:px-4">
              <div className="relative h-[28rem] w-full max-w-[28rem]">
                <div className="absolute inset-0 rounded-full bg-white/40 blur-3xl" />
                <Image
                  src="/brand/cleanmatex-login-mascot.png"
                  alt={t('login.mascotAlt')}
                  fill
                  sizes="(min-width: 1280px) 28rem, (min-width: 1024px) 40vw, 0px"
                  className="relative object-contain drop-shadow-[0_30px_40px_rgba(15,23,42,0.14)]"
                  priority
                />
              </div>

              <div className="max-w-md space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
                  {t('login.eyebrow')}
                </p>
                <h2 className="text-4xl font-semibold tracking-tight text-slate-900">
                  {t('login.tagline')}
                </h2>
                <p className="text-base leading-7 text-slate-600">
                  {t('login.subtitle')}
                </p>
              </div>
            </div>

            <CmxCard className="relative w-full overflow-hidden border-white/70 bg-white/82 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
              />

              <CmxCardHeader className="space-y-6 px-6 pb-6 pt-8 text-center sm:px-8">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-white/75 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:hidden">
                  <div className="relative h-20 w-20">
                    <Image
                      src="/brand/cleanmatex-login-mascot.png"
                      alt={t('login.mascotAlt')}
                      fill
                      sizes="5rem"
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[17rem]">
                  <Image
                    src="/brand/cleanmatex-wordmark.png"
                    alt={t('login.brandAlt')}
                    width={920}
                    height={320}
                    className="h-auto w-full"
                    priority
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
                    {t('login.eyebrow')}
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                    {t('login.title')}
                  </h1>
                  <p className="mx-auto max-w-sm text-sm leading-6 text-slate-600">
                    {t('login.subtitle')}
                  </p>
                </div>
              </CmxCardHeader>

              <CmxCardContent className="px-6 pb-8 sm:px-8">
                <CmxForm
                  form={form}
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  {loginReason ? (
                    <Alert
                      variant={loginReason === LOGIN_REASONS.PASSWORD_CHANGED ? 'info' : 'warning'}
                      className="border-amber-200/80 bg-amber-50/90"
                    >
                      <AlertDescription>{t(`reasons.${loginReason}`)}</AlertDescription>
                    </Alert>
                  ) : null}

                  {generalError ? (
                    <Alert variant="error" className="border-red-200/80 bg-red-50/90">
                      <AlertDescription>{generalError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <CmxFormField<LoginFormValues>
                    name="identifier"
                    label={t('login.identifierLabel')}
                    hint={t('login.identifierHint')}
                    required
                  >
                    {({ id, value, onBlur, onChange, invalid, describedBy }) => (
                      <CmxInput
                        id={id}
                        name="identifier"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={value ?? ''}
                        onBlur={onBlur}
                        onChange={(event) => {
                          if (generalError) {
                            setGeneralError(null)
                          }
                          onChange(event)
                        }}
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        placeholder={t('login.identifierPlaceholder')}
                        leftIcon={<User className="h-4 w-4" />}
                        className="h-12 rounded-xl border-white/70 bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                      />
                    )}
                  </CmxFormField>

                  <CmxFormField<LoginFormValues>
                    name="password"
                    label={t('login.passwordLabel')}
                    required
                  >
                    {({ id, value, onBlur, onChange, invalid, describedBy }) => (
                      <div className="relative">
                        <CmxInput
                          id={id}
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={value ?? ''}
                          onBlur={onBlur}
                          onChange={(event) => {
                            if (generalError) {
                              setGeneralError(null)
                            }
                            onChange(event)
                          }}
                          aria-invalid={invalid}
                          aria-describedby={describedBy}
                          placeholder={t('login.passwordPlaceholder')}
                          leftIcon={<LockKeyhole className="h-4 w-4" />}
                          className="h-12 rounded-xl border-white/70 bg-white/78 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        />
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-[2.55rem] h-8 px-2 text-slate-500 hover:bg-white/70 hover:text-slate-700 rtl:left-2 rtl:right-auto"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </CmxButton>
                      </div>
                    )}
                  </CmxFormField>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <CmxCheckbox
                      id="remember-me"
                      checked={rememberMe}
                      onChange={(event) =>
                        form.setValue('rememberMe', event.target.checked, {
                          shouldDirty: true,
                        })
                      }
                      label={t('rememberMe')}
                    />

                    <Link
                      href="/forgot-password"
                      className="font-medium text-[rgb(var(--cmx-primary-rgb,14_165_233))] transition-colors hover:text-slate-900"
                    >
                      {t('login.forgotPassword')}
                    </Link>
                  </div>

                  <CmxButton
                    type="submit"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    className="h-12 w-full rounded-xl bg-slate-900 text-base font-semibold text-white shadow-[0_18px_32px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                  >
                    {isSubmitting ? t('login.submitting') : t('login.submit')}
                  </CmxButton>

                  <div className="space-y-2 pt-1 text-center">
                    <p className="text-sm text-slate-600">
                      {t('login.noAccount')}{' '}
                      <Link
                        href="/register"
                        className="font-semibold text-[rgb(var(--cmx-primary-rgb,14_165_233))] transition-colors hover:text-slate-900"
                      >
                        {t('login.signUp')}
                      </Link>
                    </p>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {t('login.tagline')}
                    </p>
                  </div>
                </CmxForm>
              </CmxCardContent>
            </CmxCard>
          </div>
        </div>
      </div>
    </div>
  )
}
