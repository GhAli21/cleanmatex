'use client';
import { useState, useEffect } from 'react';
import { getDeviceId } from './device-id';
import { subscribeVapid, unsubscribeVapid } from './vapid-subscribe';

/**
 *
 */
export function useVapidPush() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration('/sw.js').then(async (reg) => {
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    });
  }, []);

  async function subscribe() {
    setLoading(true);
    const ok = await subscribeVapid(getDeviceId());
    setSubscribed(ok);
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    await unsubscribeVapid(getDeviceId());
    setSubscribed(false);
    setLoading(false);
  }

  return { subscribed, loading, subscribe, unsubscribe };
}
