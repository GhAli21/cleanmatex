'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, CreditCard } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxStatusBadge } from '@ui/feedback';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import type { GetMyActivePosSessionResult } from '@/lib/types/pos-session';

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string; errorCode?: string };

async function fetchMyActiveSession(branchId: string | null): Promise<GetMyActivePosSessionResult> {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  const response = await fetch(`/api/v1/pos-sessions/my-active?${params.toString()}`, {
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<GetMyActivePosSessionResult>;
  if (!response.ok && payload.errorCode === 'POS_SESSION_BRANCH_CONFLICT' && payload.data) {
    return payload.data;
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Failed to load POS session');
  }
  return payload.data as GetMyActivePosSessionResult;
}

export function PosSessionOrderBanner({ branchId }: { branchId: string | null }) {
  const t = useTranslations('posSessions');
  const query = useQuery({
    queryKey: ['pos-sessions', 'order-banner', branchId ?? 'none'],
    enabled: !!branchId,
    queryFn: () => fetchMyActiveSession(branchId),
    staleTime: 30_000,
  });

  if (!branchId) {
    return null;
  }

  if (query.isLoading) {
    return (
      <BannerShell tone="info">
        <CreditCard className="h-4 w-4" aria-hidden />
        <span>{t('banner.loading')}</span>
      </BannerShell>
    );
  }

  if (query.data?.type === 'BRANCH_CONFLICT') {
    return (
      <BannerShell tone="danger">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <span className="flex-1">{t('banner.branchConflict')}</span>
        <ManageButton label={t('banner.manage')} />
      </BannerShell>
    );
  }

  if (query.data?.type === 'ACTIVE') {
    const session = query.data.session;
    const isPaused = session.status === POS_SESSION_STATUS.PAUSED;
    return (
      <BannerShell tone={isPaused ? 'warning' : 'success'}>
        <CreditCard className="h-4 w-4" aria-hidden />
        <span className="flex-1">
          {isPaused
            ? t('banner.paused', { sessionNo: session.session_no })
            : t('banner.open', { sessionNo: session.session_no })}
        </span>
        <CmxStatusBadge
          label={session.status}
          variant={isPaused ? 'warning' : 'success'}
          size="sm"
        />
        <ManageButton label={t('banner.manage')} />
      </BannerShell>
    );
  }

  return (
    <BannerShell tone="info">
      <CreditCard className="h-4 w-4" aria-hidden />
      <span className="flex-1">{t('banner.none')}</span>
      <ManageButton label={t('banner.manage')} />
    </BannerShell>
  );
}

function ManageButton({ label }: { label: string }) {
  return (
    <CmxButton asChild variant="outline" size="sm">
      <Link href="/dashboard/internal_fin/pos-sessions">{label}</Link>
    </CmxButton>
  );
}

function BannerShell({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClass = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-red-200 bg-red-50 text-red-950',
    info: 'border-sky-200 bg-sky-50 text-sky-950',
  }[tone];

  return (
    <div className={`mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}
