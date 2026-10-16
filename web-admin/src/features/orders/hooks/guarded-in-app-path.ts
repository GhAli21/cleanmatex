/** Same-origin in-app path for an ordinary left click, or null when the click should stay unguarded. */
export function guardedInAppPath(input: {
  href: string | null;
  target: string | null;
  hasDownload: boolean;
  currentHref: string;
  primaryUnmodifiedClick: boolean;
}): string | null {
  if (!input.primaryUnmodifiedClick) return null;
  if (!input.href) return null;
  if (input.target && input.target !== '_self') return null;
  if (input.hasDownload) return null;
  if (input.href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(input.href)) return null;

  let url: URL;
  try {
    url = new URL(input.href, input.currentHref);
  } catch {
    return null;
  }
  const current = new URL(input.currentHref);
  if (url.origin !== current.origin) return null;
  const next = `${url.pathname}${url.search}${url.hash}`;
  const here = `${current.pathname}${current.search}${current.hash}`;
  if (next === here) return null;
  return next;
}
