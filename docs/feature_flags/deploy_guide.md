---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Deploy Guide

No Vercel/platform setting changes in this work.

After deploy, compare Vercel Function invocations for `GET /api/feature-flags` before vs after on similar traffic. Expect roughly **one invocation per tenant session / 5 minutes**, plus explicit refreshes — not one per mounted gate.

Do **not** add public/CDN cache headers to this authenticated tenant endpoint.
