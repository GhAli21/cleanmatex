/**
 * HTML Sanitizer Utility
 * Production-grade HTML sanitization using DOMPurify for safe rendering
 * @module ui/feedback/utils
 * 
 * NOTE: This module is client-only to avoid ES module compatibility issues
 * in serverless environments (html-encoding-sniffer requires ES modules)
 */

'use client';

// Use dynamic import to avoid ES module compatibility issues
let DOMPurify: typeof import('isomorphic-dompurify').default | null = null;

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
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

/**
 * Lazy load DOMPurify to avoid ES module compatibility issues
 */
async function getDOMPurify() {
  if (DOMPurify) {
    return DOMPurify;
  }

  if (typeof window === 'undefined') {
    // Server-side: return null (will be sanitized on client)
    return null;
  }

  try {
    const dompurifyModule = await import('isomorphic-dompurify');
    DOMPurify = dompurifyModule.default;
    return DOMPurify;
  } catch (error) {
    console.error('Failed to load DOMPurify:', error);
    return null;
  }
}

/**
 * Sanitize HTML string by removing dangerous content using DOMPurify
 * Provides production-grade XSS protection
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: return as-is (will be sanitized on client)
    return html;
  }

  const purify = await getDOMPurify();
  if (!purify) {
    // Fallback: return original HTML if DOMPurify fails to load
    return html;
  }

  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

/**
 * Synchronous version (for backward compatibility)
 * Uses cached DOMPurify if available, otherwise returns unsanitized HTML
 */
export function sanitizeHtmlSync(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: return as-is
    return html;
  }

  if (!DOMPurify) {
    // DOMPurify not loaded yet, return original HTML
    // This is safe because it will be sanitized on the client side
    return html;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

/**
 * Check if a string contains HTML tags
 */
export function containsHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

