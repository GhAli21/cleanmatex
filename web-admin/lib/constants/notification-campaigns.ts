/**
 * Notification campaign audiences and channels. Values mirror the DB CHECKs from migration 0818:
 * `ck_ntf_camp_audience` on org_ntf_campaigns_mst and `ck_ntf_ccons_channel` on org_ntf_cust_consent_dtl.
 */

export const CAMPAIGN_AUDIENCE = {
  STAFF: 'STAFF',
  CUSTOMERS: 'CUSTOMERS',
} as const;

export type CampaignAudience = (typeof CAMPAIGN_AUDIENCE)[keyof typeof CAMPAIGN_AUDIENCE];

/** Channels the DB allows per audience. Staff have no phone on record, so no SMS or WhatsApp for them. */
export const CAMPAIGN_CHANNELS_BY_AUDIENCE = {
  STAFF: ['IN_APP', 'PUSH', 'EMAIL'],
  CUSTOMERS: ['EMAIL', 'SMS', 'WHATSAPP'],
} as const satisfies Record<CampaignAudience, readonly string[]>;

/**
 * Event of every campaign send (sys_ntf_events_cd, MARKETING, not transactional). Its WhatsApp routes name
 * the marketing template a campaign picks (org_ntf_route_assign_cf.template_code, migration 0819).
 */
export const CAMPAIGN_SEND_EVENT = 'campaign.send';

/** Channels a customer can agree to marketing on (one org_ntf_cust_consent_dtl row each). */
export const MARKETING_CONSENT_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

export type MarketingConsentChannel = (typeof MARKETING_CONSENT_CHANNELS)[number];

/** Who recorded a consent decision (`ck_ntf_ccons_source`). */
export const MARKETING_CONSENT_SOURCE = {
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
  IMPORT: 'IMPORT',
} as const;
