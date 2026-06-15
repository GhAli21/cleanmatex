/**
 * Notification Hub — shared types.
 * Values mirror the DB CHECK constraints and lookup tables exactly.
 * DB-mirror rule: constants must match sys_ntf_channel_cd codes and
 * org_ntf_outbox_dtl status CHECK values character-for-character.
 */

export const NOTIFICATION_CHANNEL = {
  IN_APP:     'IN_APP',
  EMAIL:      'EMAIL',
  SMS:        'SMS',
  WHATSAPP:   'WHATSAPP',
  PUSH:       'PUSH',
  WEB_SOCKET: 'WEB_SOCKET',
} as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_PRIORITY = {
  LOW:      'LOW',
  NORMAL:   'NORMAL',
  HIGH:     'HIGH',
  URGENT:   'URGENT',
  CRITICAL: 'CRITICAL',
} as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITY)[keyof typeof NOTIFICATION_PRIORITY];

export const OUTBOX_STATUS = {
  QUEUED:           'QUEUED',
  PROCESSING:       'PROCESSING',
  SENT:             'SENT',
  DELIVERED:        'DELIVERED',
  READ:             'READ',
  FAILED_TEMPORARY: 'FAILED_TEMPORARY',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  SKIPPED:          'SKIPPED',
  CANCELLED:        'CANCELLED',
} as const;
export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

export const SKIP_REASON = {
  NO_MARKETING_CONSENT: 'NO_MARKETING_CONSENT',
  QUOTA_EXCEEDED:       'QUOTA_EXCEEDED',
  CHANNEL_DISABLED:     'CHANNEL_DISABLED',
  FEATURE_FLAG_OFF:     'FEATURE_FLAG_OFF',
  QUIET_HOURS_CANCELLED:'QUIET_HOURS_CANCELLED',
} as const;
export type SkipReason = (typeof SKIP_REASON)[keyof typeof SKIP_REASON];

/** The payload that business modules pass to emitNotificationEvent(). */
export interface NotificationEvent {
  /** Event code from sys_ntf_events_cd.code, e.g. 'order.created' */
  code: string;
  tenantOrgId: string;
  /** IDs of the users who should receive this notification. Resolved externally by the caller or by recipient-resolver. */
  recipientUserIds: string[];
  /** e.g. 'order' */
  sourceEntityType?: string;
  /** UUID of the business entity (order, payment, …) */
  sourceEntityId?: string;
  /** Handlebars variable substitutions: { order_number: 'ORD-123', branch_name: 'Main' } */
  variables: Record<string, string>;
  priority?: NotificationPriority;
  /** Deep-link shown as a CTA button in the bell dropdown */
  actionUrl?: string;
  actionLabel?: string;
  actionLabel2?: string;
}

/** Result returned by the in-app adapter for each recipient. */
export interface InAppResult {
  recipientUserId: string;
  success: boolean;
  inboxId?: string;
  skipped?: boolean;
  skipReason?: SkipReason;
  error?: string;
}

/** Lightweight rendered notification row (returned from in-app read queries). */
export interface NotificationRow {
  id: string;
  tenant_org_id: string;
  recipient_user_id: string;
  event_code: string;
  category_code: string | null;
  title: string;
  title2: string | null;
  body: string;
  body2: string | null;
  channel_code: string;
  priority: NotificationPriority;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  action_label: string | null;
  action_label2: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
}
