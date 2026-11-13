'use client'

/**
 * MembershipLockAction — lock or unlock the organization user on this screen.
 *
 * The lock signs the global user out of this organization only. Hidden without
 * `users:update`, and hidden on the signed-in user's own account.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CmxButton } from '@ui/primitives'
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback'
import { useAuth } from '@/lib/auth/auth-context'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import {
  fetchMembershipLock,
  MembershipLockApiError,
  updateMembershipLock,
} from '../api/membership-lock-api'

interface MembershipLockActionProps {
  /** Global user id (users/[userId] URL segment). */
  userId: string
}

/**
 * @param props - Component props
 * @param props.userId - Global user id of the organization user being viewed
 */
export function MembershipLockAction({ userId }: MembershipLockActionProps) {
  const t = useTranslations('users.detail')
  const tCommon = useTranslations('common')
  const { user } = useAuth()
  const canEdit = useHasPermission('users', 'update')
  const queryClient = useQueryClient()
  const queryKey = ['membership-lock', userId] as const
  const [open, setOpen] = useState(false)

  const { data: locked, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchMembershipLock(userId),
    enabled: canEdit && user?.id !== userId,
  })

  const mutation = useMutation({
    mutationFn: (next: boolean) => updateMembershipLock(userId, next),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      cmxMessage.success(saved ? t('membershipLocked') : t('membershipUnlocked'))
      setOpen(false)
    },
    onError: (err: unknown) => {
      if (err instanceof MembershipLockApiError && err.code === 'SELF_LOCK') {
        cmxMessage.error(t('membershipLockSelf'))
      } else {
        cmxMessage.error(t('membershipLockFailed'))
      }
    },
  })

  if (!canEdit || user?.id === userId) return null

  const nextLocked = locked !== true

  return (
    <>
      <CmxButton
        type="button"
        variant={nextLocked ? 'destructive' : 'outline'}
        disabled={isLoading || isError || mutation.isPending}
        onClick={() => setOpen(true)}
      >
        {nextLocked ? t('membershipLock') : t('membershipUnlock')}
      </CmxButton>
      <CmxConfirmDialog
        open={open}
        title={nextLocked ? t('membershipLockTitle') : t('membershipUnlockTitle')}
        description={nextLocked ? t('membershipLockDescription') : t('membershipUnlockDescription')}
        confirmLabel={tCommon('confirm')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setOpen(false)}
        onConfirm={() => mutation.mutateAsync(nextLocked)}
      />
    </>
  )
}
