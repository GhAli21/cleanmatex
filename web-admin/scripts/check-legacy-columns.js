#!/usr/bin/env node
/**
 * Legacy Column Sanity Check — Phase 9, Order Fin v1.1
 *
 * Detects re-introduction of column names dropped from org_orders_mst in
 * migration 0335 (Canonical Semantics v4, 2026-06-04).
 *
 * Strategy: extract every Prisma call block that targets org_orders_mst using
 * balanced-brace parsing, then scan the block content for banned identifiers.
 * This eliminates false positives from other tables (org_ar_invoices_mst,
 * org_order_payment_transactions_dtl, etc.) that legitimately still use some
 * of these column names.
 *
 * Usage : node scripts/check-legacy-columns.js
 * CI    : npm run check:legacy
 * Exit  : 0 = clean  |  1 = violations found
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const SRC_ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'out', '.git', 'coverage', '.storybook', 'docs',
]);

// File-level exclusions — generated type files and test/story files never
// contain runtime Prisma calls that matter, so skip them for speed.
const SKIP_FILE_SUFFIXES = [
  '.d.ts', '.stories.tsx', '.stories.ts', '.test.tsx', '.test.ts',
  '.spec.tsx', '.spec.ts',
];
const SKIP_FILE_NAMES = new Set([
  'check-legacy-columns.js',
  'database.generated.ts',
  'database.ts',
]);

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);

// ── Banned column definitions ─────────────────────────────────────────────────

// All of these were dropped from org_orders_mst in migration 0335.
// Any occurrence inside a Prisma org_orders_mst call block is a violation.
const BANNED = [
  { id: 'vat_amount',               re: /\bvat_amount\b/g },
  { id: 'promo_discount_amount',    re: /\bpromo_discount_amount\b/g },
  { id: 'gift_card_applied_amount', re: /\bgift_card_applied_amount\b/g },
  { id: 'net_receivable_amount',    re: /\bnet_receivable_amount\b/g },
  { id: 'service_charge_type',      re: /\bservice_charge_type\b/g },
  // Match `subtotal` only as an object key (left of `:`), not as a value.
  // `subtotal_amount: subtotal` — the value `subtotal` has no `:` after it → not matched.
  // `subtotal: true`            — key usage                                 → matched.
  { id: 'subtotal (column key)', re: /\bsubtotal(?!_)\s*:/g },
  { id: 'paid_amount',              re: /\bpaid_amount\b/g },
];

// ── File scanner ──────────────────────────────────────────────────────────────

function shouldSkip(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILE_NAMES.has(base)) return true;
  return SKIP_FILE_SUFFIXES.some((s) => base.endsWith(s));
}

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }

  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

// ── Balanced-brace block extractor ────────────────────────────────────────────

// Matches any Prisma call on org_orders_mst, including:
//   prisma.org_orders_mst.findMany(
//   tx.org_orders_mst.findFirst(
//   (tx as PrismaClient).org_orders_mst.update(
const PRISMA_CALL_RE = /\borg_orders_mst\s*\.\s*\w+\s*\(/g;

/**
 * Find every Prisma org_orders_mst call in `content`, extract the balanced
 * `{...}` options block, and return each as { blockContent, callLine }.
 * @param content
 */
function extractOrgOrdersBlocks(content) {
  const blocks = [];
  const lines  = content.split('\n');

  // Map char index → 1-based line number (built lazily via cumulative lengths)
  const lineStarts = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1; // +1 for '\n'
  }
  function lineOf(idx) {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  }

  let m;
  PRISMA_CALL_RE.lastIndex = 0;
  while ((m = PRISMA_CALL_RE.exec(content)) !== null) {
    const callLine   = lineOf(m.index);
    const searchFrom = m.index + m[0].length; // skip past the opening `(`

    // Locate the first `{` — the options object start
    let i = searchFrom;
    while (i < content.length && content[i] !== '{') {
      if (content[i] === ')') break; // empty call — no block
      i++;
    }
    if (i >= content.length || content[i] !== '{') continue;

    const braceStart = i;
    let depth = 1;
    i++;
    while (i < content.length && depth > 0) {
      const c = content[i];
      if      (c === '{') depth++;
      else if (c === '}') depth--;
      // Skip string literals to avoid matching braces inside strings
      else if (c === '"' || c === "'" || c === '`') {
        const q = c;
        i++;
        while (i < content.length && content[i] !== q) {
          if (content[i] === '\\') i++; // escape
          i++;
        }
      }
      i++;
    }

    blocks.push({
      callLine,
      blockContent: content.slice(braceStart, i),
    });
  }

  return blocks;
}

// ── Violation collector ───────────────────────────────────────────────────────

function collectViolations(filePath, content) {
  if (!content.includes('org_orders_mst')) return [];

  const violations = [];
  const blocks     = extractOrgOrdersBlocks(content);
  if (blocks.length === 0) return [];

  for (const { callLine, blockContent } of blocks) {
    for (const rule of BANNED) {
      rule.re.lastIndex = 0;
      let hit;
      while ((hit = rule.re.exec(blockContent)) !== null) {
        // Get the line within the block where the match appears
        const blockLine = blockContent.slice(0, hit.index).split('\n').length;
        const absLine   = callLine + blockLine - 1;
        const snippet   = blockContent.split('\n')[blockLine - 1]?.trim() ?? '';

        violations.push({ file: filePath, line: absLine, rule: rule.id, snippet });
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const files   = walk(SRC_ROOT);
  const all     = [];
  const relBase = SRC_ROOT + path.sep;

  for (const f of files) {
    if (shouldSkip(f)) continue;
    let content;
    try { content = fs.readFileSync(f, 'utf8'); }
    catch { continue; }
    all.push(...collectViolations(f, content));
  }

  if (all.length === 0) {
    console.log(
      'Legacy column check passed: no dropped org_orders_mst columns found in source.'
    );
    process.exit(0);
  }

  console.error(`\nLegacy column check FAILED — ${all.length} violation(s) in org_orders_mst Prisma blocks:\n`);
  for (const v of all) {
    const rel = v.file.startsWith(relBase) ? v.file.slice(relBase.length) : v.file;
    console.error(`  ${rel}:${v.line}  [${v.rule}]`);
    console.error(`    ${v.snippet}`);
    console.error('');
  }
  console.error(
    'These columns were removed from org_orders_mst in migration 0335.\n' +
    'Replace with canonical column names (e.g. total_paid_amount, subtotal_amount,\n' +
    'total_amount, total_tax_amount). See:\n' +
    'docs/features/Order_Fin/Fix_29_05_2026/phase-09-legacy-reader-sanity.md'
  );
  process.exit(1);
}

main();
