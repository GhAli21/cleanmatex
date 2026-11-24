import 'server-only';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { catalogReadClient } from '@/lib/supabase/catalog-read';
import { CAMPAIGN_SEND_EVENT } from '@/lib/constants/notification-campaigns';

/**
 * WhatsApp marketing templates a campaign can send (Background_Jobs STEP5_PLAN 4c, migration 0819).
 *
 * Meta allows WhatsApp marketing only through an approved MARKETING template. HQ makes one available to an
 * Organization by activating a `campaign.send` route for it (`org_ntf_route_assign_cf.template_code`, one per
 * language); HQ route activation already checked approval, account, sender and the MARKETING category. A
 * campaign picks one of those templates and fills its variables; HQ sends it through the route in each
 * customer's language and fills the provider slots from the outbox metadata (= the campaign's template_vars).
 */

export interface WhatsAppTemplateVariable {
  key: string;
  name: string;
  name2: string | null;
  required: boolean;
  example: string | null;
}

export interface WhatsAppMarketingTemplate {
  templateCode: string;
  name: string;
  name2: string | null;
  /** Languages with an ACTIVE route; a customer in another language is not sent the message. */
  languages: string[];
  /** Variables the routed template versions use (a key required by any of them is required). */
  variables: WhatsAppTemplateVariable[];
}

type RouteRow = { template_code: string | null; language_code: string; route_owner: string; provider_revision_id: string | null; private_revision_id: string | null };
type LocaleEmbed = { template_version_id: string } | { template_version_id: string }[] | null;
type RegistrationRow = { id: string; sys_ntf_tpl_locale_dtl: LocaleEmbed };

function versionOf(locale: LocaleEmbed): string | null {
  return (Array.isArray(locale) ? locale[0] : locale)?.template_version_id ?? null;
}

/**
 * Lists the WhatsApp marketing templates this Organization can use in a campaign.
 * @param tenantId Organization whose ACTIVE campaign routes are read.
 * @returns One entry per template, sorted by name; empty when HQ has activated none.
 * @throws Error when a lookup fails (the caller answers 500; an empty list would hide the failure).
 */
export async function listWhatsAppMarketingTemplates(tenantId: string): Promise<WhatsAppMarketingTemplate[]> {
  const admin = createAdminSupabaseClient();
  const catalog = catalogReadClient();
  const fail = (what: string, message: string) => new Error(`WhatsApp marketing template ${what} lookup failed: ${message}`);

  const { data: routeData, error: routeError } = await admin
    .from('org_ntf_route_assign_cf')
    .select('template_code, language_code, route_owner, provider_revision_id, private_revision_id')
    .eq('tenant_org_id', tenantId)
    .eq('event_code', CAMPAIGN_SEND_EVENT)
    .eq('channel_code', 'WHATSAPP')
    .eq('route_state', 'ACTIVE')
    .eq('is_active', true);
  if (routeError) throw fail('route', routeError.message);
  const routes = ((routeData ?? []) as RouteRow[]).filter((r) => r.template_code);
  if (routes.length === 0) return [];

  // Route revision → registration → locale → template version, whose variables the provider slots bind.
  const platformRevisionIds = routes.map((r) => r.provider_revision_id).filter((id): id is string => Boolean(id));
  const privateRevisionIds = routes.map((r) => r.private_revision_id).filter((id): id is string => Boolean(id));
  const versionByRevision = new Map<string, string>();
  if (platformRevisionIds.length > 0) {
    const { data, error } = await catalog
      .from('sys_ntf_prov_tmpl_rev_dtl')
      .select('id, sys_ntf_prov_tmpl_reg_mst!inner(id, sys_ntf_tpl_locale_dtl!inner(template_version_id))')
      .in('id', platformRevisionIds);
    if (error) throw fail('platform revision', error.message);
    for (const rev of (data ?? []) as unknown as { id: string; sys_ntf_prov_tmpl_reg_mst: RegistrationRow | RegistrationRow[] }[]) {
      const reg = Array.isArray(rev.sys_ntf_prov_tmpl_reg_mst) ? rev.sys_ntf_prov_tmpl_reg_mst[0] : rev.sys_ntf_prov_tmpl_reg_mst;
      const version = reg ? versionOf(reg.sys_ntf_tpl_locale_dtl) : null;
      if (version) versionByRevision.set(rev.id, version);
    }
  }
  if (privateRevisionIds.length > 0) {
    const { data: revs, error: revError } = await admin
      .from('org_ntf_ptrev_dtl')
      .select('id, registration_id')
      .eq('tenant_org_id', tenantId)
      .in('id', privateRevisionIds);
    if (revError) throw fail('private revision', revError.message);
    const regIds = [...new Set((revs ?? []).map((r) => r.registration_id))];
    const { data: regs, error: regError } = regIds.length === 0 ? { data: [], error: null } : await admin
      .from('org_ntf_ptreg_mst')
      .select('id, sys_ntf_tpl_locale_dtl!inner(template_version_id)')
      .eq('tenant_org_id', tenantId)
      .in('id', regIds);
    if (regError) throw fail('private registration', regError.message);
    const versionByReg = new Map(((regs ?? []) as unknown as RegistrationRow[]).map((reg) => [reg.id, versionOf(reg.sys_ntf_tpl_locale_dtl)]));
    for (const rev of revs ?? []) {
      const version = versionByReg.get(rev.registration_id);
      if (version) versionByRevision.set(rev.id, version);
    }
  }

  const versionIds = [...new Set(versionByRevision.values())];
  const codes = [...new Set(routes.map((r) => r.template_code as string))];
  const [templatesResult, variablesResult] = await Promise.all([
    catalog.from('sys_ntf_templates_mst').select('template_code, name, name2').in('template_code', codes),
    versionIds.length === 0 ? Promise.resolve({ data: [], error: null }) : catalog
      .from('sys_ntf_tpl_var_dtl')
      .select('template_version_id, variable_key, display_name, display_name2, is_required, is_collection, ordinal, example_value')
      .in('template_version_id', versionIds)
      .eq('is_active', true)
      .order('ordinal', { ascending: true }),
  ]);
  if (templatesResult.error) throw fail('template', templatesResult.error.message);
  if (variablesResult.error) throw fail('variable', variablesResult.error.message);

  type VarRow = { template_version_id: string; variable_key: string; display_name: string | null; display_name2: string | null; is_required: boolean; is_collection: boolean; example_value: string | null };
  const varsByVersion = new Map<string, VarRow[]>();
  for (const v of (variablesResult.data ?? []) as VarRow[]) {
    if (v.is_collection) continue; // a campaign fills one text value per variable
    varsByVersion.set(v.template_version_id, [...(varsByVersion.get(v.template_version_id) ?? []), v]);
  }

  const result: WhatsAppMarketingTemplate[] = [];
  for (const t of (templatesResult.data ?? []) as { template_code: string; name: string; name2: string | null }[]) {
    const own = routes.filter((r) => r.template_code === t.template_code);
    const variables = new Map<string, WhatsAppTemplateVariable>();
    for (const r of own) {
      const version = versionByRevision.get((r.route_owner === 'PRIVATE' ? r.private_revision_id : r.provider_revision_id) ?? '');
      for (const v of version ? varsByVersion.get(version) ?? [] : []) {
        const seen = variables.get(v.variable_key);
        variables.set(v.variable_key, {
          key: v.variable_key,
          name: v.display_name || v.variable_key,
          name2: v.display_name2,
          required: Boolean(seen?.required) || v.is_required,
          example: seen?.example ?? v.example_value,
        });
      }
    }
    result.push({
      templateCode: t.template_code, name: t.name, name2: t.name2,
      languages: [...new Set(own.map((r) => r.language_code))].sort(),
      variables: [...variables.values()],
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Outcome of checking a campaign's WhatsApp template choice. Flat shape: `error` set means refused. */
export interface WhatsAppCampaignTemplateCheck {
  error?: 'CAMPAIGN_TEMPLATE_NOT_AVAILABLE' | 'CAMPAIGN_TEMPLATE_VARS_MISSING';
  missing?: string[];
  /** Values to store: only the template's own variables, trimmed. */
  templateVars?: Record<string, string>;
}

/**
 * Checks that the template is one this Organization can send and every required variable has a value.
 * @param tenantId Organization creating the campaign.
 * @param templateCode Template chosen on the campaign.
 * @param values Variable values from the request (unknown keys are dropped).
 * @returns The values to store, or the reason the choice is refused.
 */
export async function checkWhatsAppCampaignTemplate(
  tenantId: string,
  templateCode: string | undefined,
  values: Record<string, string> | undefined,
): Promise<WhatsAppCampaignTemplateCheck> {
  const template = templateCode
    ? (await listWhatsAppMarketingTemplates(tenantId)).find((t) => t.templateCode === templateCode)
    : undefined;
  if (!template) return { error: 'CAMPAIGN_TEMPLATE_NOT_AVAILABLE' };
  const templateVars: Record<string, string> = {};
  for (const v of template.variables) {
    const value = values?.[v.key]?.trim();
    if (value) templateVars[v.key] = value;
  }
  const missing = template.variables.filter((v) => v.required && !templateVars[v.key]).map((v) => v.key);
  return missing.length > 0 ? { error: 'CAMPAIGN_TEMPLATE_VARS_MISSING', missing } : { templateVars };
}
