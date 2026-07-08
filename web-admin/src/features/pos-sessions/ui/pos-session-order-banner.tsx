'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, CreditCard } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxStatusBadge } from '@ui/feedback';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import { fetchMyActivePosSession, posSessionActiveQueryKey } from '@features/pos-sessions/api/pos-session-api';

export function PosSessionOrderBanner({ branchId }: { branchId: string | null }) {
  const t = useTranslations('posSessions');
  const query = useQuery({
    queryKey: posSessionActiveQueryKey(branchId, true),
    enabled: !!branchId,
    queryFn: () => fetchMyActivePosSession({ branchId, includeContext: true }),
    staleTime: 30_000,
  });

  if (!branchId) {
    return null;
  }

  if (query.isLoading || query.data?.type === 'NONE') {
    return null;
  }

  if (query.isError) {
    return (
      <BannerShell tone="danger">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <span className="flex-1">{t('messages.loadFailed')}</span>
        <ManageButton label={t('banner.manage')} />
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
    if (!isPaused) return null;
    return (
      <BannerShell tone="warning">
        <CreditCard className="h-4 w-4" aria-hidden />
        <span className="flex-1">
          {t('banner.paused', { sessionNo: session.session_no })}
        </span>
        <CmxStatusBadge
          label={session.status}
          variant="warning"
          size="sm"
        />
        <ManageButton label={t('banner.manage')} />
      </BannerShell>
    );
  }

  return null;
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
