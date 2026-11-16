---
name: executing-plans
description: Use when executing an implementation plan in the current session as the implementer yourself — your human partner chose inline execution, or no subagent tool is available
model: sonnet
---

<!-- Local cost patch (2026-11-16): runs on sonnet, sonnet final reviewer, no
     process diagram / rationalizations table, TDD sub-skill optional, no forced
     worktree. Re-apply from F:\jhapp\cleanmatex\docs\dev\claude_code\executing-plans.SKILL.patched.md after plugin updates. -->

# Executing Plans

Execute the plan yourself, task by task, in this session: no implementer
subagent per task, no reviewer per task. One fresh-context review of the
whole branch at the end.

**Core principle:** The plan already did the thinking. Execute it exactly,
prove each step with a test you watched fail and then pass, and leave a
record that survives your own forgetting.

**Narration:** between tool calls, narrate at most one short line — the
ledger and the tool results carry the record.

**Continuous execution:** Do not pause to check in between tasks. Execute
all tasks from the plan without stopping.

**Rulings, not stalls.** Conflicts, ambiguities, plan defects — decide them.
The spec is the binding authority, the plan is its argument, and your
judgment settles what neither answers. Record every decision in the ledger
as `Ruling: <what you decided> — <why> — <what it costs if wrong>`, and keep
going.

Four things stop you, and only these: an irreversible or destructive
operation; a security-sensitive action; a side effect outside this working
tree that norms say you ask about first (a merge, a push to a shared
branch, a publish); and a plan so broken that every path forward is a
guess. For those, stop and ask.

## When to Use

- You have a plan from superpowers:writing-plans and your human partner
  chose inline execution.
- Your harness has no subagent tool. Never fabricate a dispatch; run the
  plan here.

Prefer superpowers:subagent-driven-development only when your human
partner wants a review gate on every task.

## Setup

Work in the current working tree and branch unless your human partner
asks for a worktree. Project rules (CLAUDE.md) override this skill.

Conversation memory does not survive compaction. Track progress in a
ledger file, not only in todos.

- Each plan owns a workspace: run
  `../subagent-driven-development/scripts/sdd-workspace PLAN_FILE` by its
  absolute path — it prints the plan's git-ignored directory
  (`<repo-root>/.superpowers/sdd/<plan-basename>/`) for ledger, briefs and
  review packages.
- Check `<workspace>/progress.md`. If its first line names your plan file,
  tasks with a `Task <N>: complete` line are DONE — resume at the first
  task without one; trust the ledger and `git log` over your recollection.
  A ledger naming a different plan is not yours: start fresh.
- Create the ledger with first line `# SDD ledger — plan: <plan file path>`.

Read the plan once, note its Global Constraints, and create a todo per
task. If the plan names a Spec, read it; conflicts resolve against it.

Follow the plan's RED-GREEN steps. Load superpowers:test-driven-development
only if the plan's steps do not already spell out test-first order.

Before Task 1, for every task that consumes what an earlier task produces,
write one ledger row (producer, consumer, what you found) and rule on any
conflict. If tasks share nothing: `Pre-flight: no shared interfaces`.

## The Task Loop

Redirect long test output to a file in the workspace and read its tail;
read a brief, not the whole plan. Bookkeeping rides along with work — a
ledger append in the same call as the commit, never in a call of its own.

### 1. Take the task

Run `scripts/task-start PLAN_FILE N` (absolute path). It prints the brief
path and BASE. Read the brief; mark the todo in_progress.

### 2. Work the steps

Write and run each test step first; watch it fail. Every command step has
an `Expected:` line — compare real output:

- **Matches.** Next step.
- **The code is wrong.** Find the cause (superpowers:systematic-debugging
  if it isn't obvious); never patch the symptom.
- **The plan is wrong.** Make the smallest change that satisfies the spec
  and ledger `Task <N>: Ruling: <finding> — <decision and why>`.

Commit as the plan's commit steps say (unless project rules say the human
commits). BASE is the review range start, never `HEAD~1`.

### 3. Completion contract

Before a task's ledger line, with evidence in this session: every test the
brief names ran and you read the output; the final run passed; every
`Expected:` was compared; every deviation has a `Ruling:` line.

### 4. Complete the task

Run `scripts/task-done PLAN_FILE N BASE -- <test command>` (absolute path).
Only a passing run appends
`Task <N>: complete (commits <base7>..<head7>, tests: <command> → <result>)`.
Mark the todo complete and take the next task.

## Final Review

Run `../subagent-driven-development/scripts/review-package PLAN_FILE MERGE_BASE HEAD`
(absolute path) and review from the file it prints.

**With a subagent tool:** dispatch ONE reviewer with `model: "sonnet"`,
using superpowers:requesting-code-review's
[code-reviewer.md](../requesting-code-review/code-reviewer.md), passing the
package path, plan and spec paths, the plan's Review Focus section verbatim
if any, and a pointer to the ledger's `Ruling:` lines. Do not skip it.

**Without a subagent tool:** perform that review yourself as a separate
pass; ledger `Final review: self-review (no subagent tool)` and say so.

Re-grade findings by effect on a person using the software, then:

- **Critical / Important** → ONE fix pass: each fix gets a test that fails
  first, then the whole suite green. Ledger
  `Final: fixed <finding> — <test> RED→GREEN, suite <N>/<N>`. No re-review.
- **Minor** → ledger `Final: minor (deferred): <one-liner>`; do not fix.
- A finding you won't fix → `Final: Ruling: <finding> — <why> — <cost if wrong>`.

## Finish

In your final message list every ledger `Ruling:` line under "Rulings I
made" and every `minor (deferred)` line under "Deferred minors". Then delete
this plan's workspace directory (not siblings) and use
superpowers:finishing-a-development-branch.
