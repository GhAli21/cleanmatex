/**
 * Stored preference / UI accent colors — keep in sync with DB VARCHAR(20) on
 * color_hex / kind_bg_color (values are `#RRGGBB` uppercase, or NULL).
 */
export const COLOR_HEX_DB_MAX_LENGTH = 20 as const;

/** Canonical `#RRGGBB` uppercase length for storage conventions (excludes variants like rgba()). */
export const COLOR_HEX_CSS7_LENGTH = 7 as const;

/** Browser color picker + swatch fallback when value is blank or malformed. */
export const COLOR_HEX_PICKER_FALLBACK = '#6366F1';

/**
 * Accepted on API ingress before normalization to `#RRGGBB` uppercase.
 * Reuse in Zod; logic must agree with parseCssHexToFull (lib/utils/color-hex.ts).
 */
export const CSS_HEX_INPUT_PATTERN = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/** After normalization — DB / interchange contract. */
export const CSS_HEX6_STORAGE_PATTERN = /^#[0-9A-F]{6}$/;
