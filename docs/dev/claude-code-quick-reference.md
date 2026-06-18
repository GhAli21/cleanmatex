# Claude Code Quick Reference Card — CleanMateX
**Purpose:** keep Claude Code efficient, scoped, and safe.  
**Rule:** direct targeted work first; subagents only when explicitly requested.

## 1. Usage Monitor
```text
0–30%   Healthy   → continue
30–60%  Moderate  → stay scoped
60–70%  High      → prepare /compact
70–80%  Very high → finish step, then /compact or /clear
80%+    Critical  → /compact if same task, /clear if switching
```

## 2. Default Prompt Header
```text
CleanMateX efficiency rules:
- Do not use subagents unless I explicitly say "use subagent".
- Do not scan the whole repo.
- Search narrowly inside the relevant module only.
- Read only required files/functions.
- Before editing, list the exact files you will touch.
- Modify only files required for this task.
- Keep output concise.
```

## 3. Model Choice
```text
Sonnet → normal coding, UI, API, tests, build fixes, docs cleanup.
Opus   → architecture, payment/voucher/settlement design, RLS/security, risky DB review.
```
Rule: **Sonnet runs the factory. Opus designs the factory.**

## 4. Agent Decision
| Task | Agent? | Better Action |
|---|---:|---|
| Exact file/path known | No | Direct read/edit |
| 1–5 files affected | No | Main conversation |
| Specific build/type error | No | Targeted debug |
| Unknown location | Maybe | One scoped read-only Explore agent |
| Noisy multi-folder research | Maybe | One scoped read-only Explore agent |
| Broad “find everything” | No | Narrow the task first |
| Implementation | Usually no | Main conversation after approved plan |

Default:
```text
No subagents unless explicitly requested.
```

## 5. Safe Subagent Prompt
```text
Use one read-only Explore subagent.
Scope only: [folders]
Do not edit files.
Do not spawn nested agents.
Inspect maximum [N] files.
Return only: relevant files, current behavior, recommended change, risks, and next step.
```
Forbidden unless explicitly approved:
```text
parallel agents, background agents, nested agents, full-repo exploration, agent edits
```

## 6. Task Templates
Analysis:
```text
Do not edit yet. Analyze only the minimum required files. Return current behavior, required change, files to modify, risks, and implementation steps. Do not use subagents.
```
Implementation:
```text
Proceed with the approved plan. Modify only the listed files. Do not refactor unrelated code. Summarize changed files, validation command, and remaining risks.
```
Debugging:
```text
Debug this specific issue: [error]. Start from [file/path]. Search only related folders. Do not paste full logs. Show root cause and minimal fix.
```
Review:
```text
Review only these changed files: [files]. Check correctness, tenant isolation, security, financial impact, TS/build risk, and missing tests. Do not scan unrelated files.
```

## 7. Context Commands
Compact when continuing the same task:
```text
/compact keep only the task goal, approved decisions, changed files, open issues, test status, and next steps
```
Clear when switching tasks/modules:
```text
/clear
```
Golden rule:
```text
One Claude Code session = one bounded task.
```

## 8. Good vs Bad Requests
Good:
```text
Search only in web-admin/src/features/orders for payment_status usage.
Read only calculateOrderFinancialSnapshot.
Fix the TypeScript error in this file only.
```
Bad:
```text
Search the whole repo for payment.
Explain the entire order system.
Find everything related and fix it.
Read all files in this module.
```

## 9. Build/Test Output Rule
```text
Run the command. If it fails, show only command, first relevant error, file/line, root cause, and proposed fix. Do not paste the full log.
```
For repeated failures:
```text
Show only the new error compared to the previous run.
```

## 10. CleanMateX Safety Rules
```text
- Never reset Supabase without explicit approval.
- Every tenant-owned query must enforce tenant_org_id.
- Every org_* table must respect tenant isolation and RLS.
- EN/AR and RTL support are mandatory for UI text/layout changes.
- Do not change approved financial behavior silently.
- DB changes require migration, rollback, seed, and verification SQL.
- Gateway payments are completed only after gateway confirmation/webhook.
- Payment, voucher, invoice, refund, settlement, wallet, advance, gift card, and overpayment logic is high-risk.
```

## 11. Git Hygiene
Before review:
```text
git status --short
git diff --stat
```
Keep changes small:
```text
small branch, small commits, few modified files
```
Avoid:
```text
30+ modified files, mixed UI/API/DB work, generated files, accidental lockfile changes
```

## 12. Success Targets
```text
Subagent-heavy usage: below 25%
8+ hour sessions: below 10%
Sessions above 150k context: below 10%
Average files read per task: 3–8
Average modified files per task: under 5
Full repo scans: zero unless approved
Parallel agents: zero unless approved
```

## 13. Final Reminder
```text
Use Claude Code like a senior engineer with a strict task ticket, not like an unlimited research team.
```
Full guide:
```text
docs/dev/claude-code-efficiency-guide.md
```
