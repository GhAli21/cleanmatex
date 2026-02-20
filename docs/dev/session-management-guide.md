# Session Management Guide

**Last updated:** 2026-02  
**Audience:** Developers changing auth or session behaviour

This guide describes the full session lifecycle, route protection, CSRF, and Remember me in the web-admin.

---

## Session lifecycle

1. **Login**  
   - Client calls `POST /api/auth/login` with email, password, optional `remember_me`, and `X-CSRF-Token`.  
   - API validates CSRF, rate limit, account lock; then `signInWithPassword`.  
   - Session is written to cookies (session-only if `remember_me === false`, persistent otherwise).  
   - Client receives session and calls `supabase.auth.setSession()`; auth context updates and redirects to `/dashboard`.

2. **Token refresh**  
   - Supabase client (and `proxy.ts` on each request) refreshes tokens when needed.  
   - Auth context listens to `onAuthStateChange` and updates on `TOKEN_REFRESHED`.

3. **Session expiry**  
   - When refresh fails or session is invalid, Supabase emits `SIGNED_OUT`.  
   - Auth context treats this as non–user-initiated and redirects to `/logout?reason=session_expired`.  
   - Logout page clears state and redirects to `/login?reason=session_expired`; login page shows a “session expired” message.

4. **Logout**  
   - User or app calls `signOut(reason)`.  
   - Client calls `POST /api/auth/logout` with `reason`, then `supabase.auth.signOut()`, clears state and cache, and redirects to `/login`.  
   - Logout reasons: `user` | `session_expired` | `security` | `timeout` | `unknown` (used for tracking and messaging).

---

## Route protection

- **Proxy** (`web-admin/proxy.ts`):  
  - Refreshes session (`getUser()`), then:  
  - Redirects unauthenticated users from protected paths to `/login?redirect=<path>`.  
  - Treats `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/logout`, `/auth/*`, `/public` as public.  
  - API routes are not redirected; they enforce auth in handlers.  
  - Next.js 16 uses `proxy.ts` (not `middleware.ts`) for this layer.

- **Dashboard layout** (`web-admin/app/dashboard/layout.tsx`):  
  - Client guard: if `!isLoading && !isAuthenticated`, redirects to `/login?redirect=<path>`.  
  - Defence in depth if someone reaches the dashboard without a valid session.

---

## CSRF

- **When the token is set**  
  - For every page request, `proxy.ts` sets a CSRF cookie when missing (so login/register get a token before auth).

- **Where it is required**  
  - `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/reset-password` require the `X-CSRF-Token` header and validate it against the cookie.  
  - Invalid or missing token → `403` with a message to refresh the page.

- **Client**  
  - Auth context calls `getCSRFToken()` (GET `/api/auth/csrf-token`) before login/register/reset-password and sends the token in `X-CSRF-Token`.  
  - On `403`, shows the error (e.g. “Invalid or missing CSRF token. Please refresh the page and try again.”).

---

## Remember me

- **Meaning**  
  - Checkbox on the login page: **checked** = persistent auth cookies (stay logged in after closing the browser); **unchecked** = session-only cookies (logged out when the browser is closed).

- **Where it is applied**  
  - Login API reads `remember_me` from the body (default `true`).  
  - It uses `createServerSupabaseClientForLogin(rememberMe)` so that when `remember_me === false`, auth cookies are set without `maxAge`/`expires` (session cookies).  
  - Only the login response sets this; middleware and other routes use the same cookies afterward until they expire or the browser session ends.

- **Login page**  
  - State `rememberMe` (default `true`) is bound to the “Remember me” checkbox; `signIn(email, password, rememberMe)` sends `remember_me` in the body.

---

## Logout reasons

Used in `POST /api/auth/logout` body, logout page `?reason=`, and `trackLogout()`:

| Reason           | When it is used                          |
|------------------|------------------------------------------|
| `user`           | User clicked logout                      |
| `session_expired`| Session invalid or refresh failed        |
| `security`       | Security-related logout                  |
| `timeout`        | Inactivity timeout                       |
| `unknown`        | Fallback                                 |

---

## Key files

| Area            | File(s) |
|-----------------|--------|
| Proxy / route   | `web-admin/proxy.ts` |
| Dashboard guard | `web-admin/app/dashboard/layout.tsx` |
| Auth context    | `web-admin/lib/auth/auth-context.tsx` |
| Login API       | `web-admin/app/api/auth/login/route.ts` |
| CSRF            | `web-admin/lib/security/csrf.ts`, `web-admin/lib/utils/csrf-token.ts` |
| Remember me     | `web-admin/lib/supabase/server.ts` (`createServerSupabaseClientForLogin`), login page + auth context |
