/**
 * Notification Hub — canonical builder (plan NTF-06).
 *
 * The one path that turns "a template reference + variables + the facts about channel and recipient" into
 * "rendered content + a delivery decision". Events, campaigns and test sends all call it, so they cannot
 * disagree about rendering, fallback, consent or quiet hours. Persistence (inbox, outbox, provider send)
 * stays with the callers' adapters; the builder performs no writes.
 */

import { decideDelivery, type DeliveryDecision, type DeliveryPolicyInput } from '@lib/notifications/delivery-policy';
import { renderNotificationContent, type RenderedContent, type TemplateRef } from '@lib/notifications/template-renderer';

/** Who is asking for the notification. */
export type NotificationSource = 'EVENT' | 'CAMPAIGN' | 'TEST';

/** Content used when there is no template at all (a campaign saved before a template was attached). */
export interface InlineContent {
  title: string;
  title2?: string | null;
  body: string;
  body2?: string | null;
}

/** Everything the builder needs. */
export interface BuildNotificationInput {
  source: NotificationSource;
  channel: string;
  /** Template to render; null renders {@link inline} instead. */
  template: TemplateRef | null;
  inline?: InlineContent;
  variables: Record<string, string>;
  /** Facts for the delivery decision (channel config, consent, transactional flag, priority, clock). */
  policy: Omit<DeliveryPolicyInput, 'bypassConsent'>;
  /** TEST source only: skip the marketing-consent requirement (documented test mode). Ignored otherwise. */
  testMode?: boolean;
}

/** Rendered content plus the decision, ready for the caller's adapter. */
export interface BuiltNotification {
  source: NotificationSource;
  channel: string;
  rendered: RenderedContent;
  decision: DeliveryDecision;
  /** True for test sends: adapters must flag the row so it never counts as customer traffic. */
  isTest: boolean;
}

/**
 * Renders content through the canonical renderer (template, or inline content when there is no template).
 * Batch callers (a campaign sends one message to many recipients) render once with this and then decide
 * per recipient with {@link decideDelivery}; single-recipient callers use {@link buildNotification}.
 *
 * @param input Template reference or inline content, channel and variables.
 * @returns Rendered localized content.
 * @throws Error when neither a template nor inline content is supplied.
 */
export async function renderBuiltContent(
  input: Pick<BuildNotificationInput, 'channel' | 'template' | 'inline' | 'variables'>,
): Promise<RenderedContent> {
  if (input.template) return renderNotificationContent(input.template, input.channel, input.variables);
  if (!input.inline) throw new Error('A template reference or inline content is required');
  return {
    title:    input.inline.title,
    title2:   input.inline.title2 ?? null,
    body:     input.inline.body,
    body2:    input.inline.body2 ?? null,
    metadata: {},
  };
}

/**
 * Builds a notification: renders it through the canonical renderer and decides delivery through the
 * canonical policy. A SKIP decision still returns the rendered content (useful for previews).
 *
 * @param input Source, channel, template reference or inline content, variables and policy facts.
 * @returns The rendered content, the delivery decision and the test flag.
 * @throws Error when neither a template nor inline content is supplied.
 */
export async function buildNotification(input: BuildNotificationInput): Promise<BuiltNotification> {
  const rendered = await renderBuiltContent(input);

  const decision = decideDelivery({
    ...input.policy,
    bypassConsent: input.source === 'TEST' && input.testMode === true,
  });

  return { source: input.source, channel: input.channel, rendered, decision, isTest: input.source === 'TEST' };
}
