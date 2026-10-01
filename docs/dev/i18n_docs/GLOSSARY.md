# Platform Glossary — EN/AR

Canonical terminology for the whole platform (both `cleanmatex` and `cleanmatexsaas`), not just
`web-admin`. One concept = one key = one approved term per language. Purpose: stop the same concept
being translated two different ways in different corners of the app (what already started happening
with "Tenant", translated as "مستأجر" in 35 files before this glossary existed).

## Files

- [glossary.en.json](./glossary.en.json) — `{ key: "Approved English term" }`
- [glossary.ar.json](./glossary.ar.json) — `{ key: "Approved Arabic term" }`

Both files share the exact same key set, always. A key present in one and missing in the other is a
bug — check both files whenever you add or rename a term.

## Using this glossary when writing locale keys

Check this glossary **before adding a new `messages/**` key and before editing the text of an existing
one** — not just at creation time. If the concept already has an approved term here, that term is what
the key's EN/AR value must say; an edit must not quietly drift away from it. And before adding any new
key at all, search for one that already covers the same concept and reuse it — avoid duplicate keys as
much as possible, even across different namespaces.

## Rules

1. **One key per concept, never per literal word.** The key is a stable, language-neutral identifier
   (snake_case, singular, e.g. `tenant`) — not a copy of the English term. If two different concepts
   would otherwise share an obvious word (e.g. an order's "status" vs. a drawer session's "status"),
   give them two distinct keys instead of reusing one.
2. **No duplicate keys.** Before adding a term, check both JSON files for an existing key covering the
   same concept. Reuse it; don't add a near-duplicate.
3. **The glossary term is what user-facing UI text must say** in `web-admin/messages/**` and
   `platform-web` (cleanmatexsaas), in both EN and AR. It does **not** rename code: DB table/column
   names, Prisma models, TypeScript identifiers (`tenant_org_id`, `TenantContext`,
   `getTenantIdFromSession`, etc.) stay exactly as they are — those are internal/infrastructure
   vocabulary, not display copy, and renaming them is a separate, much riskier refactor this glossary
   does not ask for.
4. Adding or changing a term here is a terminology decision, not a routine edit — note the *why* in
   the table below so it isn't re-litigated per file later.
5. After adding/changing a term, `npm run check:i18n` still governs the actual `messages/**` files;
   this glossary is the term-choice reference those files must follow, not a replacement for them.

## Terms

| Key | English | Arabic | Notes |
|---|---|---|---|
| `tenant` | Organization | المنشأة | Replaces "Tenant" (EN) / "مستأجر" (AR). Both carried a landlord/lessee connotation unsuited to a laundry-business owner reading admin UI. "Organization" / "المنشأة" are the terms Gulf commercial/ERP software uses for a registered business entity — matches what a CleanMateX tenant actually is. Decided 2026-10-01. Rollout to the 35 files currently using "مستأجر" (and the EN equivalent) is a separate follow-up, not done by adding this entry. |

## Adding a new term

1. Search both JSON files for an existing key for the concept — reuse it if found.
2. Pick a stable snake_case key (the concept, not the word).
3. Add the key to **both** `glossary.en.json` and `glossary.ar.json` in the same position/order.
4. Add a row to the table above with the *why*.
5. If existing `messages/**` strings already use the old term, that's a rollout task — list the affected
   files/keys in the PR description or a follow-up note; this file only fixes new copy going forward,
   it doesn't retroactively rewrite the catalog by itself.
