/**
 * Customer verification codes (OTP). Docs: docs/features/Background_Jobs/STEP5_PLAN.md item 5.
 */

/** Channels a code can be sent on (sys_ntf_event_chan_map rows of customer.otp_generated, 0820/0822). */
export const OTP_CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

/** Notification event of the code message (sys_ntf_events_cd, 0820). */
export const OTP_EVENT_CODE = 'customer.otp_generated';

/** Phones a code can be sent to by SMS or WhatsApp: the GCC countries served (ISO 3166-1 alpha-2). Blocks SMS pumping. */
export const OTP_ALLOWED_COUNTRIES = ['OM', 'SA', 'AE', 'KW', 'BH', 'QA'] as const;

export const OTP_LIMITS = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  /** One code per phone per minute. */
  PHONE_COOLDOWN_SECONDS: 60,
  PHONE_PER_HOUR: 5,
  IP_PER_HOUR: 30,
  /** A verified code lets the caller create or upgrade the customer for this long. */
  VERIFICATION_TOKEN_MINUTES: 15,
} as const;

/** Error codes the send route returns; the screen shows a message per code. */
export const OTP_SEND_ERROR = {
  INVALID_PHONE: 'OTP_INVALID_PHONE',
  COUNTRY_NOT_ALLOWED: 'OTP_COUNTRY_NOT_ALLOWED',
  EMAIL_REQUIRED: 'OTP_EMAIL_REQUIRED',
  CHANNEL_OFF: 'OTP_CHANNEL_OFF',
  RATE_LIMITED: 'OTP_RATE_LIMITED',
} as const;
export type OtpSendErrorCode = (typeof OTP_SEND_ERROR)[keyof typeof OTP_SEND_ERROR];
