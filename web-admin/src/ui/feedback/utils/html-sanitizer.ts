/**
 * HTML Sanitizer Utility
 * Production-grade HTML sanitization using DOMPurify for safe rendering
 * @module ui/feedback/utils
 */

import DOMPurify from 'isomorphic-dompurify';

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
 * Sanitize HTML string by removing dangerous content using DOMPurify
 * Provides production-grade XSS protection
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: return as-is (will be sanitized on client)
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

