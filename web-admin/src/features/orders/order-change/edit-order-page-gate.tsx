'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSummaryMessage } from '@ui/feedback';
import { EditSharedWorkspace } from './edit-shared-workspace';
import {
  allowEditLeave,
  clearOrderEditTabSession,
  postOrderEditSession,
  readOrderEditTabSession,
  rememberOrderEditExpiry,
  safeOrderEditReturnPath,
  type OrderEditLeaveReason,
  type OrderEditTabSession,
} from './edit-page-session';

type Denial = 'direct' | 'expired' | 'inUse' | 'held' | 'missing';

interface LeaveRequest {
  reason: Extract<OrderEditLeaveReason, 'user_exit' | 'applied' | 'navigate_away'>;
  paymentsTab: boolean;
}

/**
 * Maps a server session code to the screen the cashier should see.
 * @param code - Code returned by the edit-session route.
 * @returns Denial copy key.
 */
function denialFor(code: string): Denial {
  if (code === 'EXPIRED' || code === 'MISSING') return 'expired';
  if (code === 'ALREADY_OPEN' || code === 'MISMATCH') return 'inUse';
  if (code === 'HELD_BY_OTHER') return 'held';
  return 'missing';
}

/**
 * Opens the editor only after this tab claims a session started by an Edit action.
 * Direct addresses, a second tab, and an expired lock stay outside the workspace.
 * @param root0 - Gate props.
 * @param root0.orderId - Order id from the route.
 */
export function EditOrderPageGate({ orderId }: { orderId: string }) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [phase, setPhase] = useState<'checking' | 'ready' | 'denied'>('checking');
  const [denial, setDenial] = useState<Denial>('direct');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const sessionRef = useRef<OrderEditTabSession | null>(null);
  const releasedRef = useRef(false);

  const deny = useCallback((next: Denial) => {
    releasedRef.current = true;
    sessionRef.current = null;
    clearOrderEditTabSession(orderId);
    setSessionToken(null);
    setDenial(next);
    setPhase('denied');
  }, [orderId]);

  const leave = useCallback(async (request: LeaveRequest) => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    const session = sessionRef.current ?? readOrderEditTabSession(orderId);
    if (session) {
      await postOrderEditSession(orderId, {
        action: 'end',
        token: session.token,
        reason: request.reason,
      });
    }
    clearOrderEditTabSession(orderId);
    sessionRef.current = null;
    allowEditLeave();
    router.replace(safeOrderEditReturnPath(orderId, session?.returnTo, request.paymentsTab));
  }, [orderId, router]);

  useEffect(() => {
    let active = true;
    const local = readOrderEditTabSession(orderId);
    if (!local) {
      // Session storage is unavailable during render. Defer so the effect does not set state synchronously.
      queueMicrotask(() => {
        if (!active) return;
        setDenial('direct');
        setPhase('denied');
      });
      return () => {
        active = false;
      };
    }
    sessionRef.current = local;
    void (async () => {
      const result = await postOrderEditSession(orderId, { action: 'claim', token: local.token });
      if (!active || releasedRef.current) return;
      if (!result.ok || !result.expiresAt) {
        if (result.code === 'NETWORK' || result.code === 'UNKNOWN' || result.code === 'INTERNAL_ERROR') {
          setDenial('missing');
          setPhase('denied');
          return;
        }
        deny(denialFor(result.code));
        return;
      }
      rememberOrderEditExpiry(orderId, result.expiresAt);
      sessionRef.current = { ...local, expiresAt: result.expiresAt };
      setSessionToken(local.token);
      setPhase('ready');
    })();
    return () => {
      active = false;
    };
  }, [deny, orderId]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const beat = async () => {
      const session = sessionRef.current;
      if (!session || releasedRef.current || document.visibilityState === 'hidden') return;
      const result = await postOrderEditSession(orderId, { action: 'heartbeat', token: session.token });
      if (releasedRef.current) return;
      if (!result.ok || !result.expiresAt) {
        if (result.code === 'NETWORK' || result.code === 'UNKNOWN' || result.code === 'INTERNAL_ERROR') return;
        deny(denialFor(result.code));
        return;
      }
      rememberOrderEditExpiry(orderId, result.expiresAt);
      sessionRef.current = { ...session, expiresAt: result.expiresAt };
    };
    const timer = window.setInterval(() => { void beat(); }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deny, orderId, phase]);

  useEffect(() => {
    const onHide = (event: PageTransitionEvent) => {
      if (event.persisted || releasedRef.current) return;
      const session = sessionRef.current;
      if (!session) return;
      releasedRef.current = true;
      void postOrderEditSession(orderId, {
        action: 'end',
        token: session.token,
        reason: 'unload',
        expectedExpiresAt: session.expiresAt,
      }, true);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (releasedRef.current || document.visibilityState === 'hidden') return;
      const session = sessionRef.current;
      if (!session) return;
      releasedRef.current = true;
      void postOrderEditSession(orderId, {
        action: 'end',
        token: session.token,
        reason: 'navigate_away',
      }, true);
      clearOrderEditTabSession(orderId);
    };
  }, [orderId]);

  if (phase === 'checking') {
    return <p className="p-6 text-start">{tCommon('loading')}</p>;
  }

  if (phase === 'denied') {
    const title = denial === 'direct'
      ? t('lifecycle.deniedDirectTitle')
      : denial === 'expired'
        ? t('lifecycle.deniedExpiredTitle')
        : denial === 'inUse'
          ? t('lifecycle.deniedInUseTitle')
          : denial === 'held'
            ? t('lifecycle.deniedHeldTitle')
            : t('workspace.loadFailed');
    const body = denial === 'direct'
      ? t('lifecycle.deniedDirectBody')
      : denial === 'expired'
        ? t('lifecycle.deniedExpiredBody')
        : denial === 'inUse'
          ? t('lifecycle.deniedInUseBody')
          : denial === 'held'
            ? t('lifecycle.deniedHeldBody')
            : t('lifecycle.sessionLost');
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-6 text-start">
        <CmxSummaryMessage type="warning" title={title} items={[body]} />
        <div>
          <CmxButton
            type="button"
            variant="outline"
            onClick={() => router.replace(safeOrderEditReturnPath(orderId, null))}
          >
            {t('lifecycle.backToOrder')}
          </CmxButton>
        </div>
      </div>
    );
  }

  if (!sessionToken) return null;

  return (
    <EditSharedWorkspace
      orderId={orderId}
      sessionToken={sessionToken}
      onLeave={leave}
    />
  );
}
