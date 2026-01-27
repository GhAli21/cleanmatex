/**
 * Logout Tracker
 * Tracks logout events and reasons for analytics and security
 */

import { logger } from '@/lib/utils/logger'

export type LogoutReason = 
  | 'user'           // User-initiated logout
  | 'session_expired' // Session expired
  | 'security'        // Security-related logout (e.g., suspicious activity)
  | 'timeout'         // Inactivity timeout
  | 'unknown'         // Unknown reason

export interface LogoutEvent {
  userId: string
  tenantId?: string
  reason: LogoutReason
  timestamp: Date
  userAgent?: string
  ipAddress?: string
}

/**
 * Track logout event
 */
export function trackLogout(event: Omit<LogoutEvent, 'timestamp'>): void {
  const logoutEvent: LogoutEvent = {
    ...event,
    timestamp: new Date(),
  }

  // Log to server
  logger.info('Logout event tracked', {
    feature: 'auth',
    action: 'logout_tracked',
    userId: logoutEvent.userId,
    tenantId: logoutEvent.tenantId,
    reason: logoutEvent.reason,
    timestamp: logoutEvent.timestamp.toISOString(),
  })

  // Future: Send to analytics service
  // analytics.track('user_logged_out', logoutEvent)
}

