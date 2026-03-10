# CleanMateX Web Admin

`web-admin` is the primary admin application for CleanMateX. It is a Next.js 16 and React 19 codebase used for tenant-facing administration, operational workflows, settings, reporting surfaces, and internal platform management screens.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- `next-intl` for EN/AR localization
- React Hook Form and Zod for forms and validation
- TanStack Query and TanStack Table
- Supabase client integrations
- Prisma client generation in the build pipeline
- Jest and Playwright for testing

## Local Development

From this directory:

```bash
npm run dev
```

Default URL: `http://localhost:3000`

Before running the app, make sure shared local services are up from the repo root:

```powershell
.\scripts\dev\start-services.ps1
```

## Core Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run check:i18n
```

## Important Folders

- `app/`: App Router routes, layouts, pages, and route-level UI
- `src/ui/`: Cmx design system primitives and shared UI domains
- `lib/`: shared application services, DB utilities, helpers, and server logic
- `messages/`: translation messages for English and Arabic
- `docs/`: web-admin-specific guides and migration notes
- `prisma/`: Prisma-related assets used by this app

## UI Rules

This project uses the CleanMateX UI system, not ad hoc local component libraries.

- Use the Cmx UI domains: `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`
- Do not use `@ui/compat`
- Do not use `@/components/ui` or `@/components/ui/*`
- When adding UI code, follow the import guidance in `../CLAUDE.md`, `.cursor/rules/web-admin-ui-imports.mdc`, and `web-admin/.clauderc`
- After UI changes, run `npm run build`

## Localization

All user-facing text must support English and Arabic.

- Store messages in `messages/`
- Reuse existing message keys before adding new ones
- Validate parity with `npm run check:i18n`
- Ensure RTL support is preserved for Arabic flows

## Testing

Available test layers:

- `npm run test`: unit and component tests
- `npm run test:tenant-isolation`: tenant isolation-focused tests
- `npm run test:e2e`: Playwright end-to-end tests

## Related Documentation

- `../README.md`
- `../docs/README.md`
- `../CLAUDE.md`
- `src/ui/README.md`
- `docs/API_DOCUMENTATION.md`
- `prisma/README.md`

## Documentation Notes

The web-admin module contains several legacy or historical markdown files around Prisma and UI migration work. Treat them as supporting context, not as automatic source-of-truth, unless they match the current implementation and project guardrails.
