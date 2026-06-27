# Next.js Page Template Status

This template is deprecated for CleanMateX.

Do not use it as a source of truth for new work because it still predates the current:

- `web-admin` app structure
- Cmx-only UI rules
- cookie/header locale model
- folder-based locale catalogs under `web-admin/messages/en/**` and `web-admin/messages/ar/**`

Use these current sources instead:

- `AGENTS.md`
- `CLAUDE.md`
- `web-admin/.clauderc`
- `.cursor/rules/i18n.mdc`
- `.cursor/rules/frontendnextjsrules.mdc`
- `docs/dev/i18n_docs/README.md`

When creating or updating pages:

- keep routes under the current `app/` tree that exists in this repo
- use Cmx components only
- load text through `next-intl`
- add/update translations under `web-admin/messages/en/**` and `web-admin/messages/ar/**`
- run `npm run check:i18n`, `cd web-admin && npx eslint . --quiet`, and `npm run build`
