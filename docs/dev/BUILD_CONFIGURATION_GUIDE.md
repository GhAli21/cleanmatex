---
version: v1.0.0
last_updated: 2025-01-27
author: CleanMateX Development Team
---

# Build Configuration Guide

## Overview

This document provides a comprehensive guide to all configuration files that affect the `npm run build` process in the web-admin Next.js application. Understanding these files is crucial for debugging build issues, optimizing build performance, and maintaining code quality.

---

## Table of Contents

1. [Primary Configuration Files](#primary-configuration-files)
2. [Secondary Configuration Files](#secondary-configuration-files)
3. [Build Process Flow](#build-process-flow)
4. [Common Build Issues](#common-build-issues)
5. [Configuration Best Practices](#configuration-best-practices)

---

## Primary Configuration Files

### 1. `next.config.ts` - Next.js Build Configuration

**Location:** `web-admin/next.config.ts`

**Purpose:** Main configuration file that controls the Next.js build process, webpack bundling, and build-time optimizations.

**Key Settings:**

- **ESLint Integration:**
  ```typescript
  eslint: {
    ignoreDuringBuilds: true,  // Currently disabled to unblock deployment
  }
  ```
  - **Impact:** When `true`, ESLint errors won't fail the build
  - **Note:** This is a temporary setting. ESLint errors should be fixed incrementally.

- **TypeScript Integration:**
  ```typescript
  typescript: {
    ignoreBuildErrors: false,  // TypeScript errors will fail the build
  }
  ```
  - **Impact:** TypeScript compilation errors will block the build
  - **Best Practice:** Keep this as `false` to maintain type safety

- **Webpack Configuration:**
  - Excludes Node.js built-in modules from client bundles (fs, net, tls, etc.)
  - Excludes `ioredis` from client bundles (server-only package)
  - **Impact:** Prevents runtime errors when server-only code is imported in client components

- **Output File Tracing:**
  ```typescript
  outputFileTracingRoot: path.join(__dirname)
  ```
  - **Impact:** Controls which files are included in the production build

**When to Modify:**
- Adding new server-only dependencies
- Configuring build output settings
- Enabling/disabling build-time checks
- Customizing webpack behavior

---

### 2. `eslint.config.mjs` - ESLint Configuration

**Location:** `web-admin/eslint.config.mjs`

**Purpose:** Defines code quality rules, linting standards, and files to ignore during linting.

**Key Settings:**

- **Extends:**
  - `next/core-web-vitals` - Next.js recommended rules
  - `next/typescript` - TypeScript-specific rules

- **Ignored Paths:**
  - `node_modules/**`
  - `.next/**`
  - `out/**`
  - `build/**`
  - `next-env.d.ts`

- **Rule Severity:**
  Most rules are set to `"warn"` instead of `"error"` to allow builds to succeed:
  ```javascript
  "@typescript-eslint/no-explicit-any": "warn",
  "react/no-unescaped-entities": "warn",
  "prefer-const": "warn",
  "@typescript-eslint/no-require-imports": "warn",
  ```

**Impact on Build:**
- **Current State:** ESLint is ignored during builds (`ignoreDuringBuilds: true` in next.config.ts)
- **If Enabled:** Rules set to `"error"` would fail the build
- **Best Practice:** Gradually fix warnings and change them to errors, then re-enable ESLint during builds

**When to Modify:**
- Adding new linting rules
- Changing rule severity (warn → error)
- Adding new ignore patterns
- Enforcing stricter code quality standards

---

### 3. `tsconfig.json` - TypeScript Configuration

**Location:** `web-admin/tsconfig.json`

**Purpose:** Controls TypeScript compilation, type checking, module resolution, and path aliases.

**Key Settings:**

- **Compiler Options:**
  - `strict: true` - Enables strict type checking
  - `noEmit: true` - TypeScript only checks types, doesn't emit files (Next.js handles compilation)
  - `target: "ES2017"` - JavaScript target version
  - `moduleResolution: "bundler"` - Module resolution strategy for bundlers

- **Path Aliases:**
  ```json
  "paths": {
    "@/*": ["./*"],
    "@ui/*": ["./src/ui/*"],
    "@features/*": ["./src/features/*"]
  }
  ```
  - **Impact:** Enables absolute imports instead of relative paths
  - **Usage:** `import { Button } from '@ui/button'` instead of `import { Button } from '../../../src/ui/button'`

- **Include/Exclude:**
  - **Includes:** All `.ts`, `.tsx` files, `app/`, `src/`, `lib/` directories
  - **Excludes:** `node_modules`, `e2e`, test files (`.spec.ts`, `.test.ts`)

**Impact on Build:**
- **Type Errors:** Will fail the build if `ignoreBuildErrors: false` in next.config.ts
- **Path Aliases:** Must match Next.js path resolution
- **Strict Mode:** Catches more potential bugs at build time

**When to Modify:**
- Adding new path aliases
- Changing TypeScript strictness
- Including/excluding directories from type checking
- Updating target JavaScript version

---

### 4. `postcss.config.mjs` - PostCSS Configuration

**Location:** `web-admin/postcss.config.mjs`

**Purpose:** Configures CSS processing during the build, including Tailwind CSS.

**Key Settings:**

```javascript
const config = {
  plugins: ["@tailwindcss/postcss"],
};
```

**Impact on Build:**
- Processes all CSS files
- Applies Tailwind CSS transformations
- Generates optimized CSS for production

**When to Modify:**
- Adding new PostCSS plugins
- Configuring CSS optimization
- Adding CSS preprocessors (Sass, Less, etc.)

---

## Secondary Configuration Files

### 5. `package.json` - Build Scripts and Dependencies

**Location:** `web-admin/package.json`

**Purpose:** Defines build scripts and project dependencies.

**Key Settings:**

- **Build Script:**
  ```json
  "build": "next build"
  ```

- **Dependencies:**
  - Production dependencies affect bundle size
  - DevDependencies affect build tools and type definitions

**Impact on Build:**
- Script definition controls what command runs
- Missing dependencies cause build failures
- Version mismatches can cause compatibility issues

---

### 6. `jest.config.js` - Jest Configuration (Not Used in Build)

**Location:** `web-admin/jest.config.js`

**Purpose:** Configures Jest testing framework.

**Note:** This file does NOT affect the build process. It's only used when running tests (`npm test`).

---

## Build Process Flow

When you run `npm run build`, Next.js executes the following steps:

```
1. Type Checking (tsconfig.json)
   ├─ Compiles TypeScript files
   ├─ Validates types
   └─ Fails if errors found (unless ignoreBuildErrors: true)

2. ESLint (eslint.config.mjs) - Currently Disabled
   ├─ Lints code files
   ├─ Checks code quality rules
   └─ Would fail if errors found (currently ignored)

3. CSS Processing (postcss.config.mjs)
   ├─ Processes CSS files
   ├─ Applies Tailwind transformations
   └─ Generates optimized CSS

4. Webpack Bundling (next.config.ts)
   ├─ Bundles JavaScript/TypeScript
   ├─ Applies webpack configuration
   ├─ Excludes server-only modules from client
   └─ Generates optimized production bundles

5. Static Generation
   ├─ Pre-renders static pages
   └─ Generates HTML files

6. Output
   └─ Creates .next/ directory with production build
```

---

## Common Build Issues

### Issue 1: TypeScript Errors Blocking Build

**Symptoms:**
```
Error: Type error in file.tsx
```

**Solution:**
1. Fix the TypeScript error
2. Or temporarily set `typescript: { ignoreBuildErrors: true }` in next.config.ts (not recommended)

**Prevention:**
- Run `npm run typecheck` before committing
- Use strict TypeScript settings
- Fix type errors incrementally

---

### Issue 2: ESLint Errors (When Enabled)

**Symptoms:**
```
Error: ESLint error in file.tsx
```

**Solution:**
1. Fix the ESLint error
2. Or add rule to `eslint.config.mjs` to ignore/warn
3. Or set `eslint: { ignoreDuringBuilds: true }` in next.config.ts

**Prevention:**
- Run `npm run lint` before committing
- Gradually fix warnings
- Use ESLint auto-fix: `npm run lint -- --fix`

---

### Issue 3: Module Not Found Errors

**Symptoms:**
```
Module not found: Can't resolve 'module-name'
```

**Solution:**
1. Install missing dependency: `npm install module-name`
2. Check path aliases in `tsconfig.json` match imports
3. Verify webpack configuration in `next.config.ts`

---

### Issue 4: Server-Only Code in Client Components

**Symptoms:**
```
Error: Module 'fs' cannot be found
Error: ioredis is not defined
```

**Solution:**
1. Move server-only code to Server Components or API routes
2. Verify webpack fallbacks in `next.config.ts` exclude the module
3. Use `'use server'` directive for server actions

---

### Issue 5: Path Alias Not Resolving

**Symptoms:**
```
Cannot find module '@ui/button'
```

**Solution:**
1. Verify path alias in `tsconfig.json` matches the import
2. Check `baseUrl` is set correctly
3. Restart TypeScript server in IDE
4. Clear `.next` directory and rebuild

---

## Configuration Best Practices

### 1. TypeScript Configuration

✅ **Do:**
- Keep `strict: true` enabled
- Use path aliases for cleaner imports
- Keep `ignoreBuildErrors: false` to maintain type safety
- Exclude test files from compilation

❌ **Don't:**
- Disable strict mode
- Ignore TypeScript errors permanently
- Use `any` types without good reason

---

### 2. ESLint Configuration

✅ **Do:**
- Gradually fix warnings and convert to errors
- Use `next/core-web-vitals` and `next/typescript` presets
- Ignore build artifacts (`.next/`, `node_modules/`)
- Re-enable ESLint during builds once errors are fixed

❌ **Don't:**
- Keep ESLint disabled during builds permanently
- Ignore all rules
- Use `any` without warnings

---

### 3. Next.js Configuration

✅ **Do:**
- Exclude server-only modules from client bundles
- Configure webpack for your specific needs
- Use `outputFileTracingRoot` for monorepos
- Document custom webpack configurations

❌ **Don't:**
- Ignore TypeScript/ESLint errors permanently
- Include server-only code in client bundles
- Modify webpack config without understanding impact

---

### 4. PostCSS Configuration

✅ **Do:**
- Use Tailwind CSS plugin for styling
- Keep configuration minimal
- Document custom plugins

❌ **Don't:**
- Add unnecessary PostCSS plugins
- Duplicate Tailwind configuration

---

## Quick Reference

### Files That Affect Build

| File | Purpose | Can Block Build? |
|------|---------|------------------|
| `next.config.ts` | Next.js & webpack config | ✅ Yes (if misconfigured) |
| `tsconfig.json` | TypeScript config | ✅ Yes (type errors) |
| `eslint.config.mjs` | ESLint rules | ⚠️ Currently disabled |
| `postcss.config.mjs` | CSS processing | ✅ Yes (if misconfigured) |
| `package.json` | Dependencies | ✅ Yes (missing deps) |

### Build Commands

```bash
# Build for production
npm run build

# Type check only
npm run typecheck

# Lint only
npm run lint

# Build and check types
npm run typecheck && npm run build
```

### Disabling Checks (Temporary Only)

```typescript
// next.config.ts
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // ⚠️ Temporary only
  },
  typescript: {
    ignoreBuildErrors: true,  // ⚠️ Not recommended
  },
};
```

---

## Related Documentation

- [Next.js Configuration](https://nextjs.org/docs/app/api-reference/next-config-js)
- [TypeScript Configuration](https://www.typescriptlang.org/tsconfig)
- [ESLint Configuration](https://eslint.org/docs/latest/use/configure/)
- [PostCSS Configuration](https://postcss.org/docs/)
- [Webpack Configuration](https://webpack.js.org/configuration/)

---

## Changelog

### [v1.0.0] - 2025-01-27
- Initial documentation
- Comprehensive guide to all build configuration files
- Common issues and solutions
- Best practices

---

**Last Updated:** 2025-01-27  
**Maintained By:** CleanMateX Development Team

