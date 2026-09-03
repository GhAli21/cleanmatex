/**
 * Scroll and focus helpers for inline field validation outside React Hook Form.
 * @module ui/forms
 */

export interface CmxFocusFieldOptions {
  /** React Hook Form / CmxFieldShell field name (`data-cmx-field-name`). */
  name?: string;
  /** Explicit DOM id of the control to focus. */
  id?: string;
  /** Already-resolved element (skips lookup). */
  element?: HTMLElement | null;
  /** Scroll behavior when bringing the field into view. */
  scrollBehavior?: ScrollBehavior;
}

/**
 * Brings a field into view and moves keyboard focus to its primary control.
 * Works with CmxFieldShell, native inputs, and custom select triggers.
 */
export function cmxFocusField({
  name,
  id,
  element,
  scrollBehavior = 'smooth',
}: CmxFocusFieldOptions): void {
  if (typeof document === 'undefined') {
    return;
  }

  const target =
    element ??
    (id ? document.getElementById(id) : null) ??
    (name
      ? document.querySelector<HTMLElement>(`[name="${name}"]`) ??
        document.querySelector<HTMLElement>(
          `[data-cmx-field-name="${name}"] [data-cmx-select-trigger]`,
        ) ??
        document.querySelector<HTMLElement>(
          `[data-cmx-field-name="${name}"] input, [data-cmx-field-name="${name}"] textarea, [data-cmx-field-name="${name}"] button`,
        )
      : null);

  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: scrollBehavior, block: 'center' });

  if ('focus' in target && typeof target.focus === 'function') {
    window.setTimeout(() => target.focus(), 120);
  }
}
