/**
 * Cross-tab session channel (BroadcastChannel).
 *
 * Tabs of one browser share a single session, so they must agree on activity and on sign-out:
 * - ACTIVITY: another tab saw real user activity, so this tab must not count itself as idle.
 * - LOGOUT: another tab signed out (or the session ended), so this tab must drop its state and go to /login.
 *
 * Safe on the server and in browsers without BroadcastChannel: everything degrades to a no-op.
 */

import { AUTH_SESSION_CHANNEL, type LoginReason } from '@/lib/constants/auth-session'

/** Messages exchanged between tabs. */
export type SessionChannelMessage =
  | { type: 'ACTIVITY'; at: number }
  | { type: 'LOGOUT'; reason: LoginReason | null }

/** Handle returned by {@link openSessionChannel}. */
export interface SessionChannelHandle {
  post: (message: SessionChannelMessage) => void
  close: () => void
}

const NOOP_HANDLE: SessionChannelHandle = { post: () => undefined, close: () => undefined }

/** True when the browser supports BroadcastChannel. */
function isSupported(): boolean {
  return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
}

/** Runtime check so a foreign/garbled message can never drive state. */
function isSessionMessage(data: unknown): data is SessionChannelMessage {
  if (!data || typeof data !== 'object') return false
  const type = (data as { type?: unknown }).type
  return type === 'ACTIVITY' || type === 'LOGOUT'
}

/**
 * Open the channel and subscribe.
 *
 * @param onMessage - Called for every valid message posted by ANOTHER tab (a tab never hears itself)
 * @returns Handle to post messages and to close the channel
 */
export function openSessionChannel(onMessage: (message: SessionChannelMessage) => void): SessionChannelHandle {
  if (!isSupported()) return NOOP_HANDLE

  const channel = new BroadcastChannel(AUTH_SESSION_CHANNEL)
  channel.onmessage = (event: MessageEvent) => {
    if (isSessionMessage(event.data)) onMessage(event.data)
  }
  return {
    post: (message) => {
      try {
        channel.postMessage(message)
      } catch {
        // Channel closed during teardown — nothing to tell anyone.
      }
    },
    close: () => channel.close(),
  }
}

/**
 * One-shot broadcast (opens a short-lived channel). Used by sign-out, which has no long-lived handle.
 *
 * @param reason - Login-page reason to show in the other tabs (null = plain sign-out)
 */
export function broadcastLogout(reason: LoginReason | null): void {
  if (!isSupported()) return
  const channel = new BroadcastChannel(AUTH_SESSION_CHANNEL)
  try {
    channel.postMessage({ type: 'LOGOUT', reason } satisfies SessionChannelMessage)
  } finally {
    channel.close()
  }
}
