---
name: Session Management Best Practice
overview: Implement server-side route protection, CSRF on auth endpoints, session-expiry UX, optional "Remember me" (session vs persistent cookies), dashboard layout guard, and create/update documentation so the full session lifecycle follows best practices.
todos:
  - id: middleware
    content: Create root middleware (session refresh, protected-path redirect, CSRF cookie when missing)
    status: pending
  - id: csrf-auth-apis
    content: Add CSRF validation to login, register, reset-password APIs; send header from auth pages
    status: pending
  - id: session-expiry-ux
    content: On SIGNED_OUT (not user-initiated) redirect to /logout?reason=session_expired; login message for reason=session_expired
    status: pending
  - id: dashboard-layout-guard
    content: Dashboard layout redirect to login when !isAuthenticated
    status: pending
  - id: remember-me
    content: "Remember me: session-only vs persistent cookies in login flow (cookie options in login API + checkbox on login page)"
    status: pending
  - id: i18n-build
    content: Add i18n keys for session-expired messages; run check:i18n and npm run build
    status: pending
  - id: documentation
    content: Create or update session management and auth docs (session lifecycle, middleware, CSRF, Remember me)
    status: pending
isProject: false
---

# Session Management Best-Practice Implementation Plan

## Scope

- **Route protection**: Next.js root middleware (session refresh + redirect unauthenticated from `/dashboard`).
- **CSRF**: Validate on login/register/reset-password; send token from auth pages.
- **Session expiry**: Redirect to `/logout?reason=session_expired` when session is lost; show message on login.
- **Dashboard guard**: Layout redirect when not authenticated (defence in depth).
- **Remember me**: User choice — unchecked = session-only (log out when browser closes); checked = persistent (current behaviour).

---

## 1. Root middleware

**File**: [web-admin/middleware.ts](web-admin/middleware.ts) (create at project root).

- Edge-compatible Supabase client (request/response cookies); call `getUser()` and refresh session.
- **Protected paths**: e.g. `/dashboard`; redirect to `/login?redirect=<encoded current url>` if no user.
- **Public paths**: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/logout`, `/api/auth/*`, `/_next`, static.
- **CSRF**: For page requests, if CSRF cookie missing, set it via [lib/security/csrf.ts](web-admin/lib/security/csrf.ts) (`generateCSRFToken`, `setCSRFTokenInResponse`).

---

## 2. CSRF on auth endpoints

- **Login API** [web-admin/app/api/auth/login/route.ts](web-admin/app/api/auth/login/route.ts): Validate `X-CSRF-Token` header against cookie (`getCSRFTokenFromHeader`, `getCSRFTokenFromRequest`, `validateCSRFToken`); return 403 if invalid.
- **Register / reset-password APIs**: Same validation; 403 on failure.
- **Login page** [web-admin/app/(auth)/login/page.tsx](<web-admin/app/(auth)/login/page.tsx>): Fetch CSRF (e.g. `getCSRFToken()` or `useCSRFToken()`), send `X-CSRF-Token` on login; handle 403; show message when `?reason=session_expired`.
- **Register / forgot-password pages**: Send CSRF header on auth API calls; handle 403.

---

## 3. Session-expiry UX

- **Auth context** [web-admin/lib/auth/auth-context.tsx](web-admin/lib/auth/auth-context.tsx): In `onAuthStateChange`, on `SIGNED_OUT` and when not user-initiated (e.g. ref set in `signOut()`), redirect to `/logout?reason=session_expired`.
- **Login page**: When `searchParams.get('reason') === 'session_expired'`, show notice (e.g. "Your session expired. Please sign in again.").
- **Logout page / i18n**: Ensure `session_expired` reason shows friendly message; add keys in [web-admin/messages/en.json](web-admin/messages/en.json) and [web-admin/messages/ar.json](web-admin/messages/ar.json).

---

## 4. Dashboard layout guard

- [web-admin/app/dashboard/layout.tsx](web-admin/app/dashboard/layout.tsx): Use `useAuth()`; redirect to `/login?redirect=<path>` when `!isLoading && !isAuthenticated` (or reuse [lib/auth/with-auth.tsx](web-admin/lib/auth/with-auth.tsx) logic).

---

## 5. Remember me (session vs persistent)

**Goal**: Unchecked = session-only cookie (browser closes → logged out). Checked = persistent cookie (current behaviour).

**Mechanism**: Session cookies = no `Max-Age`/`Expires` (browser drops them when the browser session ends). Persistent = set `maxAge` (e.g. 7 days or match Supabase refresh behaviour).

**5.1 Login API**

- In [web-admin/app/api/auth/login/route.ts](web-admin/app/api/auth/login/route.ts):
  - Read `remember_me` from body (default `true` for backward compatibility).
  - Create Supabase server client with a **custom cookie `set()`** that receives the same `options` from Supabase but overrides persistence:
    - If `remember_me === false`: call `cookieStore.set({ name, value, ...options })` **without** `maxAge` (and without `expires`) so the cookie is a session cookie.
    - If `remember_me === true`: pass through options (keep default Supabase behaviour or set e.g. `maxAge: 60 * 60 * 24 * 7`).
  - Use this client for `signInWithPassword` so the cookies written during login have the chosen lifetime.

**Implementation detail**: The server `createClient` in the login route must be created per-request with a closure over `remember_me` (from request body), and the `cookies.set` adapter must omit `maxAge`/`expires` when `remember_me` is false. Reference: [lib/supabase/server.ts](web-admin/lib/supabase/server.ts) cookie adapter; duplicate/adjust only for the login route so other routes keep current behaviour.

**5.2 Login page**

- In [web-admin/app/(auth)/login/page.tsx](<web-admin/app/(auth)/login/page.tsx>):
  - Add state for "Remember me" (e.g. `rememberMe`, default `true`).
  - Bind the existing "Remember me" checkbox to this state.
  - Send `remember_me: boolean` in the login request body with the credentials.

**5.3 Middleware / other server clients**

- No change: middleware and other API routes keep using the standard server client (persistent cookies). Only the **login response** sets session vs persistent; once set, those cookies are used everywhere until they expire or the browser session ends.

---

## 6. File and change summary

| Item                                                                                             | Action                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [web-admin/middleware.ts](web-admin/middleware.ts)                                               | Create: session refresh, protected redirect, CSRF cookie.                                   |
| [web-admin/app/api/auth/login/route.ts](web-admin/app/api/auth/login/route.ts)                   | Add CSRF validation; add `remember_me` and custom cookie options for session vs persistent. |
| [web-admin/app/api/auth/register/route.ts](web-admin/app/api/auth/register/route.ts)             | Add CSRF validation.                                                                        |
| [web-admin/app/api/auth/reset-password/route.ts](web-admin/app/api/auth/reset-password/route.ts) | Add CSRF validation.                                                                        |
| [web-admin/app/(auth)/login/page.tsx](<web-admin/app/(auth)/login/page.tsx>)                     | CSRF header; session_expired message; Remember me state and body.                           |
| Register / forgot-password pages                                                                 | CSRF header; 403 handling.                                                                  |
| [web-admin/lib/auth/auth-context.tsx](web-admin/lib/auth/auth-context.tsx)                       | SIGNED_OUT → redirect /logout?reason=session_expired when not user-initiated.               |
| [web-admin/app/dashboard/layout.tsx](web-admin/app/dashboard/layout.tsx)                         | Redirect when unauthenticated.                                                              |
| [web-admin/messages/en.json](web-admin/messages/en.json) / ar.json                               | Session-expired and remember-me keys.                                                       |
| Documentation                                                                                    | Create or update docs (see section 7).                                                      |

---

## 7. Documentation (create or update)

**Goal**: Document the session management lifecycle, middleware behaviour, CSRF usage, and Remember me so developers and maintainers have a single reference.

**7.1 Create or update: Session management guide**

- **Location**: [docs/dev/session-management-guide.md](docs/dev/session-management-guide.md) (create) or extend [docs/security/AUTH_SECURITY_IMPLEMENTATION.md](docs/security/AUTH_SECURITY_IMPLEMENTATION.md) / [docs/features/001_auth_dev_prd/route-protection-guide.md](docs/features/001_auth_dev_prd/route-protection-guide.md).
- **Content**:
  - **Session lifecycle**: Login (API + setSession), token refresh (Supabase + onAuthStateChange), session expiry (SIGNED_OUT → redirect with reason), logout (API + signOut + cache invalidation).
  - **Route protection**: Root middleware (protected paths, public paths, redirect to `/login?redirect=...`); dashboard layout guard as defence in depth.
  - **CSRF**: When and where the token is set (middleware); which endpoints require `X-CSRF-Token`; how the login/register/reset-password pages send it; 403 handling.
  - **Remember me**: Meaning of the checkbox; session-only vs persistent cookies; where it is applied (login API cookie options).
  - **Logout reasons**: `user` | `session_expired` | `security` | `timeout` | `unknown`; where they are used (logout API, logout page, tracking).
- **Audience**: Developers and anyone changing auth or session behaviour.

**7.2 Update existing auth/security docs**

- **[docs/security/AUTH_SYSTEM_EVALUATION.md](docs/security/AUTH_SYSTEM_EVALUATION.md)** (if present): Add a short “Session management (post-hardening)” subsection noting middleware, CSRF on auth, session-expiry UX, and Remember me; or link to the new session-management guide.
- **[docs/security/AUTH_SECURITY_IMPLEMENTATION.md](docs/security/AUTH_SECURITY_IMPLEMENTATION.md)**: Add or update sections for root middleware (session refresh + protected routes), CSRF on auth endpoints, and Remember me (cookie behaviour).
- **[docs/features/001_auth_dev_prd/route-protection-guide.md](docs/features/001_auth_dev_prd/route-protection-guide.md)** or **route-protection-summary.md**: State that route protection is enforced by root middleware and dashboard layout; link to middleware.ts and session-management guide.

**7.3 Optional**

- **README or CLAUDE.md**: One-line pointer to session/auth docs (e.g. “Session lifecycle and route protection: docs/dev/session-management-guide.md”) so AI and new contributors find it.

**7.4 Implementation order**

- Write or update the session-management guide after middleware, CSRF, session-expiry, and Remember me are implemented (so the doc reflects final behaviour).
- Then update AUTH_SYSTEM_EVALUATION, AUTH_SECURITY_IMPLEMENTATION, and route-protection docs; finally add the optional pointer in README/CLAUDE.md.

---

## 8. Order of implementation

1. **Middleware** (session refresh, protected redirect, CSRF cookie).
2. **CSRF** on auth APIs and auth pages.
3. **Session-expiry** (SIGNED_OUT redirect, login message, i18n).
4. **Dashboard layout** redirect.
5. **Remember me** (login API cookie options, login page checkbox + body).
6. **i18n and build** (messages, check:i18n, npm run build).
7. **Documentation**: Create or update session-management guide; update AUTH_SYSTEM_EVALUATION, AUTH_SECURITY_IMPLEMENTATION, and route-protection docs; optional pointer in README/CLAUDE.md.
