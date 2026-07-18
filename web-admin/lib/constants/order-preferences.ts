/**
 * Order preference stage / ownership constants (DB-mirror codes).
 * Stage codes live on prefs_source / notes_followup.note_source.
 * Legacy PREFERENCE_SOURCES (manual, bundle, …) remain in service-preferences.ts.
 */

/** Where a preference row or follow-up note was written from (screen / process). */
export const PREFS_SOURCE_STAGE = {
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_PREPARE: 'ORDER_PREPARE',
  ORDER_PROCESSING: 'ORDER_PROCESSING',
  ORDER_UPDATE: 'ORDER_UPDATE',
} as const;

export type PrefsSourceStage =
  (typeof PREFS_SOURCE_STAGE)[keyof typeof PREFS_SOURCE_STAGE];

/** Same vocabulary for notes_followup.note_source. */
export const PREFS_NOTE_SOURCE = PREFS_SOURCE_STAGE;

export type PrefsNoteSource = PrefsSourceStage;

/** Who owns the preference line conceptually. */
export const PREFS_OWNER_TYPE = {
  CUSTOMER: 'CUSTOMER',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  /** Legacy packing override — prefer USER for new writes. */
  OVERRIDE: 'OVERRIDE',
} as const;

export type PrefsOwnerType =
  (typeof PREFS_OWNER_TYPE)[keyof typeof PREFS_OWNER_TYPE];

/** Structured API / service error when delete triple-guard fails. */
export const PREF_DELETE_NOT_ALLOWED = 'PREF_DELETE_NOT_ALLOWED' as const;

export const PREF_DELETE_REASON = {
  WRONG_SOURCE: 'WRONG_SOURCE',
  NOT_OWNER: 'NOT_OWNER',
  STILL_CONFIRMED: 'STILL_CONFIRMED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type PrefDeleteReason =
  (typeof PREF_DELETE_REASON)[keyof typeof PREF_DELETE_REASON];

/** Max length for a single follow-up note_text. */
export const PREFS_FOLLOWUP_NOTE_MAX_LEN = 2000;
