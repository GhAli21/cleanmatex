/**
 * Validates Material Design Icons webfont class suffixes (e.g. mdi-tune) for safe DOM class use.
 */

const MDI_ICON_CLASS_SAFE = /^mdi-[a-z0-9-]+$/i;

export function isSafeMdiIconClass(
  icon: string | null | undefined
): icon is string {
  return typeof icon === 'string' && icon.length > 0 && MDI_ICON_CLASS_SAFE.test(icon);
}
