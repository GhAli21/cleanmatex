/**
 * Tenant profile DTOs for the Settings → General and Settings → Branding pages.
 *
 * These shapes mirror the form state in:
 *   - app/dashboard/settings/general/page.tsx
 *   - app/dashboard/settings/branding/page.tsx
 *
 * The DB shape lives on `org_tenants_mst` (see migrations 0001, 0006, 0252).
 * Business hours have a different key/shape between DB and UI; conversion
 * happens in `lib/services/tenant-profile.service.ts` via `toDbHours` /
 * `fromDbHours`.
 */

// ---------- Business hours ----------

/**
 * UI-side business hours shape used by `BusinessHoursEditor`.
 * Keys are full lowercase day names. `closed: true` means the day is closed
 * (open/close strings are kept for editor-state stability across toggles).
 */
export interface UiBusinessHours {
  monday: UiDayHours;
  tuesday: UiDayHours;
  wednesday: UiDayHours;
  thursday: UiDayHours;
  friday: UiDayHours;
  saturday: UiDayHours;
  sunday: UiDayHours;
}

export interface UiDayHours {
  open: string; // HH:mm
  close: string; // HH:mm
  closed: boolean;
}

/**
 * DB-side business hours shape stored in `org_tenants_mst.business_hours`
 * (JSONB, default seeded in migration 0006). A `null` value for a day key
 * represents a closed day.
 */
export interface DbBusinessHours {
  mon?: DbDayHours | null;
  tue?: DbDayHours | null;
  wed?: DbDayHours | null;
  thu?: DbDayHours | null;
  fri?: DbDayHours | null;
  sat?: DbDayHours | null;
  sun?: DbDayHours | null;
}

export interface DbDayHours {
  open: string; // HH:mm
  close: string; // HH:mm
}

// ---------- General settings DTO ----------

export interface GeneralSettingsDto {
  businessName: string;
  businessNameAr: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  defaultLanguage: string;
  businessHours: UiBusinessHours;
  /**
   * True when the tenant already has at least one order, in which case
   * `currency` and `country` cannot be changed (financial integrity).
   * The UI uses this flag to disable the relevant fields and surface
   * the `settings.error.settingLocked` message.
   */
  isLocked: {
    currency: boolean;
    country: boolean;
  };
}

export interface GeneralSettingsInput {
  businessName: string;
  businessNameAr?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country: string;
  timezone: string;
  currency: string;
  defaultLanguage: string;
  businessHours: UiBusinessHours;
}

// ---------- Branding settings DTO ----------

export interface BrandingSettingsDto {
  logo: string; // URL or '' when no logo set
  primaryColor: string; // #RRGGBB
  secondaryColor: string;
  accentColor: string;
}

export interface BrandingSettingsInput {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}
