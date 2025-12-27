/**
 * HTML Sanitizer Utility
 * Basic HTML sanitization for safe rendering
 * @module ui/feedback/utils
 */

/**
 * Allowed HTML tags for sanitization
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div',
  'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];

/**
 * Allowed HTML attributes
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  span: ['class'],
  div: ['class'],
  p: ['class'],
};

/**
 * Sanitize HTML string by removing dangerous content
 * This is a basic sanitizer - for production use, consider using DOMPurify
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: return as-is (will be sanitized on client)
    return html;
  }

  // Create a temporary DOM element
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script tags and event handlers
  const scripts = temp.querySelectorAll('script, style, iframe, object, embed, form');
  scripts.forEach((el) => el.remove());

  // Remove all elements not in allowed list
  const allElements = temp.querySelectorAll('*');
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.includes(tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }

    // Remove disallowed attributes
    const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || [];
    Array.from(el.attributes).forEach((attr) => {
      if (!allowedAttrs.includes(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    });

    // Remove event handlers (onclick, onerror, etc.)
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

/**
 * Check if a string contains HTML tags
 */
export function containsHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

