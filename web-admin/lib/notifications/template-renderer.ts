/**
 * Notification Hub — template renderer (canonical render path).
 *
 * ONE implementation selects the current APPROVED template version for a template reference and performs
 * {{variable}} substitution. Events, campaigns and test sends all render through
 * {@link renderNotificationContent}; the three historical entry points below are thin wrappers that only
 * choose how the template is referenced, so the three paths cannot drift apart again (plan NTF-06).
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

/** Localized content produced by the renderer (EN primary, AR secondary). */
export interface RenderedContent {
  title:  string;
  title2: string | null;
  body:   string;
  body2:  string | null;
  metadata: Record<string, unknown>;
}

/** How a template is referenced: by the event it serves, or directly by its template code. */
export type TemplateRef =
  | { kind: 'event'; eventCode: string }
  | { kind: 'code'; templateCode: string };

/**
 * Replace {{key}} placeholders with values. Unknown keys are left as-is.
 * @param template Text containing placeholders.
 * @param vars Substitution values.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/** Identifier shown in logs and in the plain-text fallback. */
function refLabel(ref: TemplateRef): string {
  return ref.kind === 'event' ? ref.eventCode : ref.templateCode;
}

/** Plain-text content used when no APPROVED template exists at all. Keeps the bell and the outbox working. */
function plainFallback(ref: TemplateRef, variables: Record<string, string>): RenderedContent {
  const key = ref.kind === 'event' ? 'event_code' : 'template_code';
  const extra = { [key]: refLabel(ref), ...variables };
  return {
    title:    interpolate(`New notification: {{${key}}}`, extra),
    title2:   null,
    body:     interpolate(`You have a new notification for {{${key}}}.`, extra),
    body2:    null,
    metadata: {},
  };
}

/**
 * Canonical render: the newest APPROVED, active version of the referenced template for a channel.
 * A non-IN_APP channel without its own row falls back to the same template's IN_APP rendering; with no
 * template at all, plain text is produced. A database error is treated like a missing template (logged,
 * never thrown) so a notification failure cannot break the business operation that emitted it.
 *
 * @param ref Template reference (event code or template code).
 * @param channelCode Delivery channel being rendered for.
 * @param variables {{key}} substitution values.
 * @returns Localized content ready for the outbox or inbox.
 */
export async function renderNotificationContent(
  ref: TemplateRef,
  channelCode: string,
  variables: Record<string, string>,
): Promise<RenderedContent> {
  const supabase = createAdminSupabaseClient();

  // The template is joined through its master (event lookup) or addressed by code; everything else is shared.
  const joined = ref.kind === 'event'
    ? `
      rendered_body,
      rendered_body2,
      metadata,
      sys_ntf_template_ver_dtl!inner (
        subject,
        subject2,
        status,
        sys_ntf_templates_mst!inner (
          event_code
        )
      )
    `
    : `
      rendered_body,
      rendered_body2,
      metadata,
      sys_ntf_template_ver_dtl!inner (
        subject,
        subject2,
        status,
        template_code
      )
    `;

  const { data, error } = await supabase
    .from('sys_ntf_template_chan_dtl')
    .select(joined)
    .eq('channel_code', channelCode)
    .eq('sys_ntf_template_ver_dtl.status', 'APPROVED')
    .eq(
      ref.kind === 'event'
        ? 'sys_ntf_template_ver_dtl.sys_ntf_templates_mst.event_code'
        : 'sys_ntf_template_ver_dtl.template_code',
      refLabel(ref),
    )
    .eq('sys_ntf_template_ver_dtl.is_active', true)
    .order('sys_ntf_template_ver_dtl(version_number)', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('renderNotificationContent: DB error fetching template', {
      ref: refLabel(ref), refKind: ref.kind, channelCode, error: error.message, feature: 'notifications',
    });
  }

  if (!data && channelCode !== 'IN_APP') {
    // Fallback: the same template's IN_APP rendering when no channel-specific row exists.
    return renderNotificationContent(ref, 'IN_APP', variables);
  }

  if (!data) return plainFallback(ref, variables);

  const row = data as unknown as {
    rendered_body: string;
    rendered_body2: string | null;
    metadata: unknown;
    sys_ntf_template_ver_dtl: { subject: string | null; subject2: string | null };
  };
  const ver = row.sys_ntf_template_ver_dtl;
  return {
    title:    interpolate(ver.subject ?? refLabel(ref), variables),
    title2:   ver.subject2 ? interpolate(ver.subject2, variables) : null,
    body:     interpolate(row.rendered_body, variables),
    body2:    row.rendered_body2 ? interpolate(row.rendered_body2, variables) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Render the APPROVED template of an event for a channel (event emitter / outbox path).
 * @param eventCode sys_ntf_events_cd code the template serves.
 * @param channelCode Delivery channel.
 * @param variables Substitution values.
 */
export async function renderChannelTemplate(
  eventCode: string,
  channelCode: string,
  variables: Record<string, string>,
): Promise<RenderedContent> {
  return renderNotificationContent({ kind: 'event', eventCode }, channelCode, variables);
}

/**
 * Render the APPROVED template referenced directly by code (campaign path: org_ntf_campaigns_mst keeps a
 * template_code, not an event).
 * @param templateCode sys_ntf_templates_mst.template_code referenced by the campaign.
 * @param channelCode Delivery channel.
 * @param variables Substitution values.
 */
export async function renderTemplateByCode(
  templateCode: string,
  channelCode: string,
  variables: Record<string, string>,
): Promise<RenderedContent> {
  return renderNotificationContent({ kind: 'code', templateCode }, channelCode, variables);
}

/**
 * Render the APPROVED IN_APP template of an event (bell/inbox path).
 * @param eventCode sys_ntf_events_cd code the template serves.
 * @param variables Substitution values.
 */
export async function renderInAppTemplate(
  eventCode: string,
  variables: Record<string, string>,
): Promise<RenderedContent> {
  return renderNotificationContent({ kind: 'event', eventCode }, 'IN_APP', variables);
}
