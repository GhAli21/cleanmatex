---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

<!-- Local cost patch (2026-11-16): explicit cheap models for every dispatch
     (haiku/sonnet, never opus), sonnet final review, diagrams and
     rationalizations table removed, no forced worktree. Original:
     F:\jhapp\cleanmatex\docs\dev\claude_code\plugin-originals\. Re-apply from
     F:\jhapp\cleanmatex\docs\dev\claude_code\subagent-driven-development.SKILL.patched.md after plugin updates. -->

# Subagent-Driven Development

Execute the plan by dispatching a fresh implementer subagent per task, a task
review (spec compliance + code quality) after each, and one whole-branch
review at the end. Prefer superpowers:executing-plans (inline, cheaper)
unless your human partner wants a review gate on every task.

**Narration:** between tool calls, narrate at most one short line.

**Continuous execution:** Do not pause to check in between tasks.

**Rulings, not stalls.** Decide conflicts, ambiguities and plan defects. The
spec is the binding authority. Record every decision in the ledger as
`Ruling: <what you decided> — <why> — <what it costs if wrong>`, and keep
going.

Four things stop you, and only these: an irreversible or destructive
operation; a security-sensitive action; a side effect outside this working
tree that norms say you ask about first (merge, push to a shared branch,
publish); and a plan so broken that every path forward is a guess.

## Model Selection (mandatory — always pass `model` explicitly)

An omitted model inherits the session's (often Opus). Never dispatch on Opus.

| Role | Model |
|---|---|
| Implementer, plan contains the complete code / single-file mechanical fix | `haiku` |
| Implementer, prose spec or multi-file integration | `sonnet` |
| Task reviewer, re-reviewer | `sonnet` (`haiku` for a tiny mechanical diff) |
| Fix-loop rounds 4-5 escalation, "more capable model" re-dispatch | `sonnet` |
| Final whole-branch review | `sonnet` |

## Setup

Work in the current working tree and branch unless your human partner asks
for a worktree. Project rules (CLAUDE.md) override this skill.

- Run this skill's `bash scripts/sdd-workspace PLAN_FILE` (absolute path) —
  it prints the plan's git-ignored workspace (`<repo-root>/.superpowers/sdd/…`)
  for ledger, briefs, reports and review packages. Never touch another
  plan's directory.
- If `<workspace>/progress.md` exists, read
  [references/resuming.md](references/resuming.md) first.
- Otherwise create it with first line `# SDD ledger — plan: <plan file path>`.
  After compaction, trust the ledger and `git log` over your recollection.

Read the plan once, note Global Constraints, create a todo per task, read
the Spec if named. Before Task 1, read
[references/preflight.md](references/preflight.md) and run its conflict scan.

## The Task Loop

Several small same-shape edits: read [references/batching.md](references/batching.md) first.

Hand artifacts over as files — anything pasted into a dispatch or printed
back stays in your context. Never paste prior-task history into a dispatch.
While subagents run, keep doing local bookkeeping; when idle, wait in
bounded 5-10 minute stretches.

### 1. Dispatch the implementer

Record BASE (`git rev-parse HEAD`). Run `bash scripts/task-brief PLAN_FILE N`
(absolute path). The dispatch contains only: one line of context; the brief
path ("read this first — your requirements, exact values verbatim");
interfaces/decisions from earlier tasks; your resolution of ambiguities;
the report path (`…/task-N-report.md`) and report contract; a pointer to any
ledger finding parked in this area. The implementer never dispatches
subagents. Record its agent identity (fix rounds 1-3 resume it). Never run
implementers in parallel. Template: [implementer-prompt.md](implementer-prompt.md)

### 2. Handle the report

**DONE:** run `bash scripts/review-package PLAN_FILE BASE HEAD` (absolute
path; BASE as recorded, never `HEAD~1`) and dispatch the task reviewer.
**Any other status:** read [references/handling-reports.md](references/handling-reports.md).
Answer implementer questions fully.

### 3. Review the task

Give the reviewer: the brief, the report, the review package path, and the
plan's Global Constraints copied verbatim. Don't ask it to re-run tests the
implementer ran, don't add open-ended directives, and never pre-judge
findings ("do not flag…"). Both verdicts (spec + quality) are required.
"⚠️ Cannot verify from diff" items: read [references/cannot-verify.md](references/cannot-verify.md).
Template: [task-reviewer-prompt.md](task-reviewer-prompt.md)

### 4. The fix loop

Triggered by spec ❌, any Critical/Important finding, or a confirmed ⚠️ gap.
Read [references/fix-loop.md](references/fix-loop.md) before every round
(escalation model per the table above).

### 5. Complete the task

Append `Task <N>: complete (commits <base7>..<head7>, review clean)` (or
`<K> parked` after a tripped breaker) with your other bookkeeping, mark the
todo complete, move on. Never advance with open Critical/Important issues
that are neither fixed nor parked with a ruling.

## Final Review

When every task is complete, read [references/final-review.md](references/final-review.md)
and follow it, dispatching the reviewer on `sonnet`.
