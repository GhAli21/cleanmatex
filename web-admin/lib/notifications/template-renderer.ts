/**
 * Notification Hub — template renderer.
 * Fetches the current APPROVED template version for an event and performs
 * simple {{variable}} substitution. No external dependency needed for Phase 1.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

export interface RenderedContent {
  title:  string;
  title2: string | null;
  body:   string;
  body2:  string | null;
  metadata: Record<string, unknown>;
}

/** Replace {{key}} placeholders with values. Unknown keys are left as-is. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/**
 * Fetch the APPROVED template for an event on a given channel and render it.
 * For EMAIL: tries EMAIL first, falls back to IN_APP content if no email template exists.
 * Falls back to a plain text notification when no template is found at all.
 */
export async function renderChannelTemplate(
  eventCode: string,
  channelCode: string,
  variables: Record<string, string>
): Promise<RenderedContent> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('sys_ntf_template_chan_dtl')
    .select(`
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
    `)
    .eq('channel_code', channelCode)
    .eq('sys_ntf_template_ver_dtl.status', 'APPROVED')
    .eq('sys_ntf_template_ver_dtl.sys_ntf_templates_mst.event_code', eventCode)
    .eq('sys_ntf_template_ver_dtl.is_active', true)
    .order('sys_ntf_template_ver_dtl(version_number)', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('renderChannelTemplate: DB error fetching template', {
      eventCode, channelCode, error: error.message, feature: 'notifications',
    });
  }

  if (!data && channelCode !== 'IN_APP') {
    // Fallback: use IN_APP template content for other channels when no channel-specific template exists
    return renderInAppTemplate(eventCode, variables);
  }

  if (!data) {
    return {
      title:    interpolate('New notification: {{event_code}}', { event_code: eventCode, ...variables }),
      title2:   null,
      body:     interpolate('You have a new notification for {{event_code}}.', { event_code: eventCode, ...variables }),
      body2:    null,
      metadata: {},
    };
  }

  const ver = data.sys_ntf_template_ver_dtl as { subject: string | null; subject2: string | null };
  return {
    title:    interpolate(ver.subject  ?? eventCode, variables),
    title2:   ver.subject2 ? interpolate(ver.subject2, variables) : null,
    body:     interpolate(data.rendered_body, variables),
    body2:    data.rendered_body2 ? interpolate(data.rendered_body2, variables) : null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Fetch the APPROVED IN_APP template for an event and render it with variables.
 * Falls back to a plain text notification when no template is found.
 */
export async function renderInAppTemplate(
  eventCode: string,
  variables: Record<string, string>
): Promise<RenderedContent> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('sys_ntf_template_chan_dtl')
    .select(`
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
    `)
    .eq('channel_code', 'IN_APP')
    .eq('sys_ntf_template_ver_dtl.status', 'APPROVED')
    .eq('sys_ntf_template_ver_dtl.sys_ntf_templates_mst.event_code', eventCode)
    .eq('sys_ntf_template_ver_dtl.is_active', true)
    .order('sys_ntf_template_ver_dtl(version_number)', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('renderInAppTemplate: DB error fetching template', {
      eventCode,
      error: error.message,
      feature: 'notifications',
    });
  }

  if (!data) {
    // Graceful fallback — emit a plain notification so the bell still works
    return {
      title:    interpolate('New notification: {{event_code}}', { event_code: eventCode, ...variables }),
      title2:   null,
      body:     interpolate('You have a new notification for {{event_code}}.', { event_code: eventCode, ...variables }),
      body2:    null,
      metadata: {},
    };
  }

  const ver = data.sys_ntf_template_ver_dtl as {
    subject: string | null;
    subject2: string | null;
  };

  return {
    title:    interpolate(ver.subject  ?? eventCode, variables),
    title2:   ver.subject2 ? interpolate(ver.subject2, variables) : null,
    body:     interpolate(data.rendered_body, variables),
    body2:    data.rendered_body2 ? interpolate(data.rendered_body2, variables) : null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}
