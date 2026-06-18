# Claude Code Efficiency Guide — CleanMateX
**Version:** Compact v3  
**Goal:** reduce Claude Code session burn while keeping implementation quality.  
**Rule:** this file must stay under 200 lines. Put deep details in skills/docs.

## 1. Operating Model
Your usage pattern shows three expensive behaviors: subagent-heavy work, long 8+ hour sessions, and contexts above 150k tokens.

```text
Direct targeted work by default.
One scoped subagent only when explicitly requested.
Compact before context becomes expensive.
Clear between modules.
Use Sonnet for normal coding.
Use Opus only for architecture and complex financial logic.
```

## 2. Model Policy
| Work | Model |
|---|---|
| Normal coding, UI, API routes, TS fixes, tests | Sonnet |
| Build/test debugging | Sonnet |
| Documentation cleanup | Sonnet |
| Payment/voucher/settlement architecture | Opus |
| RLS/security architecture | Opus |
| Final review before risky DB/financial changes | Opus |

Rule: **Sonnet runs the factory. Opus designs the factory.**

## 3. Default Prompt Header
Use this for most Claude Code tasks:
```text
CleanMateX efficiency rules:
- Do not use subagents unless I explicitly say "use subagent".
- Do not spawn Explore, Plan, or general-purpose agents automatically.
- Do not scan the whole repo.
- Search narrowly inside the relevant module only.
- Do not read generated files, node_modules, .next, dist, coverage, or lock files unless required.
- Before editing, list the exact files you will touch.
- Modify only files required for this task.
- Keep output concise.
- If context becomes large, suggest /compact.
```

## 4. Context Commands
Use `/compact` when context reaches 60–70%, after exploration, before implementation, before testing, or after noisy output.
```text
/compact keep only the current task goal, approved decisions, changed files, open issues, test status, and next steps
```
Use `/clear` when switching feature/module, starting a new work session, finishing a major task, or when the session became long/noisy.
```text
One Claude Code session = one bounded task.
```

## 5. Subagent Policy
Default:
```text
No subagents unless explicitly requested.
```
Use direct work when file path is known, task affects 1–5 files, error points to a file/line, or the issue is localized.

Use **one scoped read-only subagent** only when the location is unknown, exploration would be noisy, multiple folders may be involved, and the scope can be limited.

Forbidden by default:
```text
- Multiple parallel agents
- Background agents
- Nested subagents
- Full-repo exploration
- “Find everything” prompts
- Agent edits without approval
```
Safe subagent prompt:
```text
Use one read-only Explore subagent.
Scope only: [folders]
Do not edit files.
Do not spawn nested agents.
Inspect maximum [N] files.
Return only relevant files, current behavior, recommended change, risks, and next step.
```

## 6. Task Prompts
Analysis:
```text
Do not edit yet. Analyze only the minimum required files. Return current behavior, required change, files to modify, risks, and implementation steps. Do not use subagents.
```
Implementation:
```text
Proceed with the approved plan. Modify only the listed files. Do not refactor unrelated code. Summarize changed files, tests/build command, and remaining risks.
```
Debugging:
```text
Debug this specific issue: [error]. Start from [file/path]. Search only related folders. Do not paste full logs. Show root cause and minimal fix.
```
Review:
```text
Review only these changed files: [files]. Check correctness, tenant isolation, security, financial impact, TS/build risk, and missing tests. Do not scan unrelated files.
```

## 7. CleanMateX Non-Negotiables
Universal:
```text
- Never reset Supabase without explicit user approval.
- Never use destructive DB commands without migration/rollback review.
- Every tenant-owned query must enforce tenant_org_id.
- Every org_* table must respect tenant isolation and RLS strategy.
- Bilingual EN/AR support is mandatory where UI text is added.
- RTL layout must not break Arabic UI.
- Do not change approved financial behavior silently.
```
Financial:
```text
- Payment, voucher, invoice, refund, settlement, wallet, advance, gift card, and overpayment logic is high-risk.
- Gateway payments are not completed until gateway confirmation/webhook.
- Manual exception refunds require permission and reason.
- DB changes require migration, rollback, seed, and verification SQL.
- Preserve auditability, idempotency, tenant isolation, and ledger traceability.
```

## 8. File/Search Efficiency
Good:
```text
Search only in web-admin/src/features/orders for payment_status usage.
Read only the calculateOrderFinancialSnapshot function.
Inspect only files related to the payment modal.
```
Bad:
```text
Search the whole repo for payment.
Read all order files.
Explain the entire financial system.
Find everything related and fix it.
```
Avoid unless required: `node_modules`, `.next`, `dist`, `build`, `coverage`, cache, generated files, lock files, large logs, SQL dumps.

## 9. Build/Test Output Rule
Before builds/tests:
```text
Run the command. If it fails, show only command, first relevant error, file/line, root cause, and proposed fix. Do not paste the full log.
```
For repeated failures: show only the new error compared to the previous run.

## 10. CLAUDE.md Policy
Keep `CLAUDE.md` at **50–80 lines max**. It should contain only critical project rules, efficiency rules, project structure, key skills, and financial safety warnings.

Do not put full PRDs, long architecture docs, migration templates, large examples, completed plans, or duplicated requirements in `CLAUDE.md`.
```text
CLAUDE.md should route Claude to the right place, not load the whole company manual.
```

## 11. Skills Policy
Each `SKILL.md` should be **100–200 lines max** with: when to use, critical rules, small patterns, and links to deeper docs.

Move heavy content to supporting files such as:
```text
.claude/skills/database/migration-guide.md
.claude/skills/database/examples.md
.claude/skills/database/rls-rules.md
```

## 12. Git Efficiency
Best practice: **small branch, small commits, few modified files**.

Avoid 30+ modified files, mixed UI/API/DB work, generated files in git status, and accidental lockfile changes.

Before review:
```text
git status --short
git diff --stat
```

## 13. Success Metrics
```text
Subagent-heavy usage: below 25%
8+ hour sessions: below 10%
Sessions over 150k context: below 10%
Average files read per task: 3–8
Average modified files per task: under 5
Full repo scans: zero unless explicitly approved
Parallel agents: zero unless explicitly approved
```

## 14. Final Rule
```text
Use Claude Code like a senior engineer with a strict task ticket, not like an unlimited research team.
```
Recommended location:
```text
docs/dev/claude-code-efficiency-guide.md
```
