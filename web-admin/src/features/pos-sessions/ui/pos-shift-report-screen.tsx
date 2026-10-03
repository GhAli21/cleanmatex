'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, FileText, Printer, RefreshCw } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { POS_SESSION_PERMISSIONS } from '@/lib/constants/permissions/pos-session-perm';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import {
  fetchPosShiftXReport,
  fetchPosShiftZReport,
  generatePosShiftZReport,
  posShiftXReportKey,
  posShiftZReportKey,
} from '@features/pos-sessions/api/pos-shift-report-api';
import { posSessionErrorKey } from '@features/pos-sessions/model/pos-session-flags';
import { PosSessionApiError } from '@features/pos-sessions/api/pos-session-api';
import { PosShiftReportRprt } from '@features/pos-sessions/ui/pos-shift-report-rprt';

type View = 'frozen' | 'live';

/**
 * Shift report of one POS session: the live X-report while the session runs, and — once it has
 * closed — its frozen Z-report (with an on-demand "Generate" for tenants that do not create it at
 * close). A closed session can still show today's live figures next to the frozen ones.
 */
export function PosShiftReportScreen({ sessionId }: { sessionId: string }) {
  const t = useTranslations('posShiftReport');
  const tCommon = useTranslations('common');
  const tSessions = useTranslations('posSessions');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const canGenerate = useHasPermissionCode(POS_SESSION_PERMISSIONS.REPORT_Z);
  const [view, setView] = useState<View>('frozen');

  const xQuery = useQuery({
    queryKey: posShiftXReportKey(sessionId),
    queryFn: () => fetchPosShiftXReport(sessionId),
  });
  const zQuery = useQuery({
    queryKey: posShiftZReportKey(sessionId),
    queryFn: () => fetchPosShiftZReport(sessionId),
  });

  const generate = useMutation({
    mutationFn: () => generatePosShiftZReport(sessionId, csrfToken),
    onSuccess: async () => {
      cmxMessage.success(t('generated'));
      await queryClient.invalidateQueries({ queryKey: posShiftZReportKey(sessionId) });
    },
    onError: (error) => {
      const key = error instanceof PosSessionApiError ? posSessionErrorKey(error.errorCode) : null;
      cmxMessage.error(key ? tSessions(`errors.${key}`) : error instanceof Error ? error.message : t('generateFailed'));
    },
  });

  const loading = xQuery.isLoading || zQuery.isLoading;
  const loadError = xQuery.error ?? zQuery.error;
  const x = xQuery.data;
  const z = zQuery.data ?? null;
  const finished =
    x?.session.status === POS_SESSION_STATUS.CLOSED || x?.session.status === POS_SESSION_STATUS.FORCE_CLOSED;

  // Frozen figures win whenever they exist; the live view is always one click away.
  const showingZ = Boolean(z) && view === 'frozen';
  const snapshot = showingZ && z ? z.snapshot : x;

  const openPrint = (layout: 'thermal' | 'a4') => {
    const kind = showingZ ? 'z' : 'x';
    window.open(
      `/dashboard/internal_fin/pos-sessions/${sessionId}/report/print?kind=${kind}&layout=${layout}`,
      '_blank',
      'noopener'
    );
  };

  const refresh = async () => {
    await Promise.all([xQuery.refetch(), zQuery.refetch()]);
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CmxButton variant="ghost" size="sm" onClick={() => router.push('/dashboard/internal_fin/pos-sessions')}>
            <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
            {tCommon('back')}
          </CmxButton>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FileText className="h-5 w-5" aria-hidden />
            {z && view === 'frozen' ? t('zTitle') : t('xTitle')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <CmxButton variant="outline" size="sm" loading={xQuery.isFetching} onClick={() => void refresh()}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden />
            {tCommon('refresh')}
          </CmxButton>
          <CmxButton variant="outline" size="sm" disabled={!snapshot} onClick={() => openPrint('thermal')}>
            <Printer className="me-2 h-4 w-4" aria-hidden />
            {t('printThermal')}
          </CmxButton>
          <CmxButton variant="outline" size="sm" disabled={!snapshot} onClick={() => openPrint('a4')}>
            <Printer className="me-2 h-4 w-4" aria-hidden />
            {t('printA4')}
          </CmxButton>
        </div>
      </div>

      {loading ? <p className="py-12 text-center text-sm text-gray-500">{tCommon('loading')}</p> : null}

      {!loading && loadError ? (
        <CmxSummaryMessage
          type="error"
          title={t('loadFailedTitle')}
          items={[loadError instanceof Error ? loadError.message : t('loadFailed')]}
        />
      ) : null}

      {!loading && !loadError && x ? (
        <>
          {!finished ? (
            <CmxSummaryMessage type="info" title={t('liveTitle')} items={[t('liveBody')]} />
          ) : null}

          {finished && !z ? (
            <CmxSummaryMessage
              type="warning"
              title={t('noZTitle')}
              items={[canGenerate ? t('noZBody') : t('noZNoPermission')]}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {z ? (
              <>
                <CmxButton size="sm" variant={view === 'frozen' ? 'primary' : 'outline'} onClick={() => setView('frozen')}>
                  {t('viewFrozen')}
                </CmxButton>
                <CmxButton size="sm" variant={view === 'live' ? 'primary' : 'outline'} onClick={() => setView('live')}>
                  {t('viewLive')}
                </CmxButton>
              </>
            ) : null}
            {finished && !z && canGenerate ? (
              <CmxButton size="sm" loading={generate.isPending} onClick={() => generate.mutate()}>
                {t('generate')}
              </CmxButton>
            ) : null}
          </div>

          {z && view === 'live' ? (
            <CmxSummaryMessage type="info" title={t('liveVsFrozenTitle')} items={[t('liveVsFrozenBody')]} />
          ) : null}

          <CmxCard>
            <CmxCardContent className="overflow-x-auto bg-gray-50 p-3 sm:p-6">
              {snapshot ? <PosShiftReportRprt snapshot={snapshot} zReport={showingZ ? z : null} layout="a4" /> : null}
            </CmxCardContent>
          </CmxCard>
        </>
      ) : null}
    </div>
  );
}
