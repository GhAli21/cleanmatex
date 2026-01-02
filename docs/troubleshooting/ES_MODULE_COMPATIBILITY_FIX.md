---
version: v1.0.0
last_updated: 2025-01-20
author: CleanMateX Team
---

# ES Module Compatibility Fix

## Issue

Error encountered in serverless/edge runtime environments:

```
Error: require() of ES Module /var/task/node_modules/@exodus/bytes/encoding-lite.js 
from /var/task/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.
```

## Root Cause

The `isomorphic-dompurify` package (used for HTML sanitization) depends on `jsdom`, which in turn depends on `html-encoding-sniffer@6.0.0`. This version of `html-encoding-sniffer` tries to `require()` an ES module (`@exodus/bytes/encoding-lite.js`), which is not supported in CommonJS environments (like serverless/edge runtimes).

## Solution

### 1. Client-Only HTML Sanitizer

The HTML sanitizer utility (`src/ui/feedback/utils/html-sanitizer.ts`) has been updated to:
- Use `'use client'` directive to ensure it only runs client-side
- Use dynamic imports for DOMPurify to avoid server-side bundling
- Provide a synchronous fallback (`sanitizeHtmlSync`) for backward compatibility

### 2. Next.js Webpack Configuration

Updated `next.config.ts` to externalize problematic packages on the server side:

```typescript
if (isServer) {
  config.externals.push({
    'isomorphic-dompurify': 'commonjs isomorphic-dompurify',
    'html-encoding-sniffer': 'commonjs html-encoding-sniffer',
    '@exodus/bytes': 'commonjs @exodus/bytes',
    'jsdom': 'commonjs jsdom',
  });
}
```

This prevents webpack from bundling these packages on the server, avoiding the ES module compatibility issue.

### 3. Updated Toast Method

The toast method (`src/ui/feedback/methods/toast-method.ts`) now uses `sanitizeHtmlSync` instead of the async version to maintain synchronous behavior.

## Files Modified

1. `web-admin/next.config.ts` - Added server-side externals
2. `web-admin/src/ui/feedback/utils/html-sanitizer.ts` - Made client-only with dynamic imports
3. `web-admin/src/ui/feedback/methods/toast-method.ts` - Updated to use sync version

## Testing

After these changes:
1. Build should complete without ES module errors
2. HTML sanitization should work client-side
3. Server-side rendering should not attempt to load DOMPurify

## Alternative Solutions (If Issue Persists)

If the issue persists, consider:

1. **Update Dependencies**: Update `isomorphic-dompurify` to a newer version that might have fixed this
2. **Use Alternative Library**: Consider using `dompurify` directly (client-only) instead of `isomorphic-dompurify`
3. **Server-Side Sanitization**: Use a different sanitization library for server-side (e.g., `sanitize-html`)

## References

- [Next.js Webpack Configuration](https://nextjs.org/docs/api-reference/next.config.js/custom-webpack-config)
- [ES Modules in Node.js](https://nodejs.org/api/esm.html)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)

---

**Status:** ✅ Fixed  
**Date:** 2025-01-20

