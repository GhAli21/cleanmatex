'use client'

/**
 * CmxTopBar - dashboard top bar: page title, caller-supplied actions and the
 * signed-in user's menu. Feature components (scan, notifications, sessions,
 * permissions inspector) are passed in by the layout, so this file never
 * imports feature code.
 * @module ui/navigation
 */

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { CmxButton } from '@ui/primitives/cmx-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import { CmxLanguageSwitcher } from './cmx-language-switcher'

/** Props of {@link CmxTopBar}. */
export interface CmxTopBarProps {
  /** Page title. */
  title: ReactNode
  /** Controls shown before the language switcher (scan, inspector, sessions, notifications). */
  actions?: ReactNode
  /** Search control, when the app has one. */
  search?: ReactNode
}

/**
 * Dashboard top bar.
 * @param props - {@link CmxTopBarProps}
 * @returns The header element
 */
export default function CmxTopBar({ title, actions, search }: CmxTopBarProps) {
  const router = useRouter()
  const { user, currentTenant, signOut } = useAuth()
  const t = useTranslations('layout.topBar')
  const isRTL = useRTL()
  const name = user?.user_metadata?.display_name || user?.email

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>

        <div className="flex items-center gap-4">
          {search ? <div className="hidden md:block">{search}</div> : null}
          {actions}
          <CmxLanguageSwitcher />

          {/* A session is bound to one tenant at sign-in; to use another tenant the user signs out and signs in there. */}
          {currentTenant?.tenant_name ? (
            <span
              className="line-clamp-1 hidden max-w-40 break-words rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground md:block"
              title={currentTenant.tenant_name}
            >
              {currentTenant.tenant_name}
            </span>
          ) : null}

          <DropdownMenu dir={isRTL ? 'rtl' : 'ltr'}>
            <DropdownMenuTrigger asChild>
              <CmxButton variant="ghost" className="gap-2 px-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
                <span className="hidden md:block">{name}</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </CmxButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="line-clamp-1 break-words text-sm font-medium text-foreground">{name}</p>
                <p className="line-clamp-1 break-words text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push('/dashboard/settings/general')}>
                <User className="me-2 h-4 w-4" aria-hidden="true" />
                {t('profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/dashboard/account/security')}>
                <ShieldCheck className="me-2 h-4 w-4" aria-hidden="true" />
                {t('accountSecurity')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
                <Settings className="me-2 h-4 w-4" aria-hidden="true" />
                {t('settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger-text" onSelect={() => void handleSignOut()}>
                <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
                {t('signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
