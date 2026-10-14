/**
 * Notification provider secrets and identities for the tenant app's direct (non-HQ) paths.
 *
 * Read from the Config Registry through the tenant resolver (lib/ops-config/tenant-config-resolver.ts):
 * each key applies its source policy; the seeded policy ENV_OVERRIDES_DB keeps a set environment
 * variable authoritative and uses the stored value as the fallback. Plain-stored secrets are readable
 * here; encrypted ones only when the environment holds the same value (the HQ master key never
 * reaches this host). A refused or missing value comes back undefined, so every caller fails closed
 * with its existing "not configured" handling.
 *
 * Server-only. Results must never be logged, returned to a browser or put in an error message.
 */
import { resolveTenantConfig } from '@lib/ops-config/tenant-config-resolver'

/**
 * Registry keys (mirroring `sys_ops_config_cf.config_key`) with the environment variable each one
 * used before the registry, which is also the fallback when the registry is unreadable.
 */
export const NTF_SECRET_KEYS = {
  TWILIO_ACCOUNT_SID: { key: 'ntf.app.twilio.account_sid', env: 'TWILIO_ACCOUNT_SID' },
  TWILIO_AUTH_TOKEN: { key: 'ntf.app.twilio.auth_token', env: 'TWILIO_AUTH_TOKEN' },
  TWILIO_PHONE_NUMBER: { key: 'ntf.app.twilio.phone_number', env: 'TWILIO_PHONE_NUMBER' },
  RESEND_API_KEY: { key: 'ntf.app.resend.api_key', env: 'RESEND_API_KEY' },
  RESEND_WEBHOOK_SECRET: { key: 'ntf.app.resend.webhook_secret', env: 'RESEND_WEBHOOK_SECRET' },
  META_WA_ACCESS_TOKEN: { key: 'ntf.app.meta.wa_access_token', env: 'META_WHATSAPP_ACCESS_TOKEN' },
  META_WA_PHONE_NUMBER_ID: { key: 'ntf.app.meta.wa_phone_number_id', env: 'META_WHATSAPP_PHONE_NUMBER_ID' },
  VAPID_PUBLIC_KEY: { key: 'ntf.app.vapid.public_key', env: 'VAPID_PUBLIC_KEY' },
  VAPID_PRIVATE_KEY: { key: 'ntf.app.vapid.private_key', env: 'VAPID_PRIVATE_KEY' },
  VAPID_SUBJECT: { key: 'ntf.app.vapid.subject', env: 'VAPID_SUBJECT' },
  ONESIGNAL_APP_ID: { key: 'ntf.app.onesignal.app_id', env: 'ONESIGNAL_APP_ID' },
  ONESIGNAL_REST_API_KEY: { key: 'ntf.app.onesignal.rest_api_key', env: 'ONESIGNAL_REST_API_KEY' },
  FCM_SERVICE_ACCOUNT: { key: 'ntf.app.fcm.service_account', env: 'FCM_SERVICE_ACCOUNT_JSON' },
  FCM_PROJECT_ID: { key: 'ntf.app.fcm.project_id', env: 'FCM_PROJECT_ID' },
  OUTBOX_SECRET: { key: 'ntf.app.outbox_secret', env: 'NOTIFICATIONS_OUTBOX_SECRET' },
  OUTBOX_WORKER_ID: { key: 'ntf.app.outbox_worker_id', env: 'NOTIFICATIONS_OUTBOX_WORKER_ID' },
} as const

type SecretEntry = (typeof NTF_SECRET_KEYS)[keyof typeof NTF_SECRET_KEYS]

const read = (entry: SecretEntry): Promise<string | undefined> => resolveTenantConfig(entry.key, entry.env)

/** Twilio account credentials of the direct path; fields are undefined when unset. */
export async function getTwilioCredentials(): Promise<{ accountSid?: string; authToken?: string }> {
  const [accountSid, authToken] = await Promise.all([
    read(NTF_SECRET_KEYS.TWILIO_ACCOUNT_SID),
    read(NTF_SECRET_KEYS.TWILIO_AUTH_TOKEN),
  ])
  return { accountSid, authToken }
}

/** Legacy Twilio sender number used by the old sms-sender helper. */
export async function getLegacyTwilioPhoneNumber(): Promise<string | undefined> {
  return read(NTF_SECRET_KEYS.TWILIO_PHONE_NUMBER)
}

/** Resend API key of the tenant app's direct email path. */
export async function getResendApiKey(): Promise<string | undefined> {
  return read(NTF_SECRET_KEYS.RESEND_API_KEY)
}

/** Resend (Svix) webhook signing secret. */
export async function getResendWebhookSecret(): Promise<string | undefined> {
  return read(NTF_SECRET_KEYS.RESEND_WEBHOOK_SECRET)
}

/** Meta Cloud API WhatsApp credentials of the direct path. */
export async function getMetaWhatsappCredentials(): Promise<{ accessToken?: string; phoneNumberId?: string }> {
  const [accessToken, phoneNumberId] = await Promise.all([
    read(NTF_SECRET_KEYS.META_WA_ACCESS_TOKEN),
    read(NTF_SECRET_KEYS.META_WA_PHONE_NUMBER_ID),
  ])
  return { accessToken, phoneNumberId }
}

/** Web-push VAPID key pair and subject. */
export async function getVapidConfig(): Promise<{ publicKey?: string; privateKey?: string; subject?: string }> {
  const [publicKey, privateKey, subject] = await Promise.all([
    read(NTF_SECRET_KEYS.VAPID_PUBLIC_KEY),
    read(NTF_SECRET_KEYS.VAPID_PRIVATE_KEY),
    read(NTF_SECRET_KEYS.VAPID_SUBJECT),
  ])
  return { publicKey, privateKey, subject }
}

/** OneSignal app id and REST API key. */
export async function getOneSignalConfig(): Promise<{ appId?: string; apiKey?: string }> {
  const [appId, apiKey] = await Promise.all([
    read(NTF_SECRET_KEYS.ONESIGNAL_APP_ID),
    read(NTF_SECRET_KEYS.ONESIGNAL_REST_API_KEY),
  ])
  return { appId, apiKey }
}

/** FCM service-account JSON (raw or base64 string) and project id. */
export async function getFcmConfig(): Promise<{ serviceAccountJson?: string; projectId?: string }> {
  const [serviceAccountJson, projectId] = await Promise.all([
    read(NTF_SECRET_KEYS.FCM_SERVICE_ACCOUNT),
    read(NTF_SECRET_KEYS.FCM_PROJECT_ID),
  ])
  return { serviceAccountJson, projectId }
}

/** Bearer secret pg_cron presents to the notification endpoints (must equal the Vault secret, 0616). */
export async function getOutboxSecret(): Promise<string | undefined> {
  return read(NTF_SECRET_KEYS.OUTBOX_SECRET)
}

/** Identifier this app instance writes into outbox claims. */
export async function getOutboxWorkerId(): Promise<string | undefined> {
  return read(NTF_SECRET_KEYS.OUTBOX_WORKER_ID)
}
