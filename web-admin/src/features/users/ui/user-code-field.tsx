'use client'

/**
 * UserCodeField — shows a user's sign-in code with an inline "change" dialog.
 *
 * - Reads via GET /api/users/[userId]/user-code (users:read), saves via PATCH (users:update).
 * - Edit control is hidden without `users:update`; the API enforces it again.
 * - Tenant resolved server-side from the session; `userId` is the auth user id.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { CmxButton, CmxInput } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'
import { cmxMessage } from '@ui/feedback'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { USER_CODE_REGEX } from '@/lib/constants/auth-user'
import { fetchUserCode, updateUserCode, UserCodeApiError } from '../api/user-code-api'

interface UserCodeFieldProps {
  /** Auth user id (users/[userId] URL segment). */
  userId: string
}

/**
 * @param props - Component props
 * @param props.userId - Auth user id of the user being viewed
 */
export function UserCodeField({ userId }: UserCodeFieldProps) {
  const t = useTranslations('users.detail')
  const tCommon = useTranslations('common')
  const canEdit = useHasPermission('users', 'update')
  const queryClient = useQueryClient()
  const queryKey = ['user-code', userId] as const

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const { data: userCode, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchUserCode(userId),
  })

  const mutation = useMutation({
    mutationFn: (next: string) => updateUserCode(userId, next),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      cmxMessage.success(t('userCodeSaved'))
      setOpen(false)
    },
    onError: (err: unknown) => {
      if (err instanceof UserCodeApiError && err.code === 'USER_CODE_TAKEN') {
        setFieldError(t('userCodeTaken'))
      } else if (err instanceof UserCodeApiError && err.code === 'INVALID_USER_CODE') {
        setFieldError(t('userCodeInvalid'))
      } else {
        cmxMessage.error(t('userCodeSaveFailed'))
      }
    },
  })

  const openDialog = () => {
    setDraft(userCode ?? '')
    setFieldError(null)
    setOpen(true)
  }

  const submit = () => {
    const next = draft.trim()
    if (!USER_CODE_REGEX.test(next)) {
      setFieldError(t('userCodeInvalid'))
      return
    }
    if (next === userCode) {
      setOpen(false)
      return
    }
    setFieldError(null)
    mutation.mutate(next)
  }

  return (
    <div>
      <dt className="text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
        {t('userCode')}
      </dt>
      <dd className="mt-1 flex items-center gap-2 text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
        {isLoading ? (
          <span className="h-4 w-20 animate-pulse rounded bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]" />
        ) : isError ? (
          <span className="text-red-600">{t('userCodeLoadFailed')}</span>
        ) : (
          <span className="font-mono">{userCode}</span>
        )}
        {canEdit && userCode ? (
          <CmxButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={openDialog}
            aria-label={t('userCodeEdit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </CmxButton>
        ) : null}
      </dd>

      <CmxDialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('userCodeEditTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-2 px-1 py-2">
            <CmxInput
              label={t('userCode')}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (fieldError) setFieldError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              error={fieldError ?? undefined}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={30}
            />
            <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('userCodeHelp')}
            </p>
          </div>
          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" loading={mutation.isPending} disabled={mutation.isPending} onClick={submit}>
              {tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
