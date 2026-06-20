#!/usr/bin/env npx tsx
/**
 * Extract plan limit enforcement usage from web-admin codebase.
 * Patterns: withLimitCheck, sys_plan_limits, usage-tracking, plan limit middleware
 * Run: npm run docs:extract-plan-limits
 */

import * as fs from 'fs';
import * as path from 'path';
import { inferSurfaceFromRelativePath, normalizeRelativePath, type ExtractSurface } from './inventories/surface';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/plan_limits');

interface PlanLimitUsageRow {
  limitKey: string;
  file: string;
  line: number;
  context: string;
  surface: ExtractSurface;
  pattern: string;
}

const usages: PlanLimitUsageRow[] = [];

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next', '__tests__'].includes(e.name)) {
        yield* walkDir(full);
      }
    } else if (['.ts', '.tsx'].some((x) => e.name.endsWith(x))) {
      yield full;
    }
  }
}

const PATTERNS: { re: RegExp; pattern: string; key: (m: RegExpExecArray) => string }[] = [
  {
    re: /withLimitCheck\s*\(\s*['"]([^'"]+)['"]/g,
    pattern: 'withLimitCheck',
    key: (m) => m[1],
  },
  {
    re: /withLimitCheck\s*\(\s*['"](order|user|branch)['"]/g,
    pattern: 'withLimitCheck',
    key: (m) => m[1],
  },
  {
    re: /from\s*\(\s*['"]sys_plan_limits['"]\s*\)/g,
    pattern: 'sys_plan_limits',
    key: () => 'sys_plan_limits',
  },
  {
    re: /checkPlanLimit\s*\(\s*['"]([^'"]+)['"]/g,
    pattern: 'checkPlanLimit',
    key: (m) => m[1],
  },
  {
    re: /enforcePlanLimit\s*\(\s*['"]([^'"]+)['"]/g,
    pattern: 'enforcePlanLimit',
    key: (m) => m[1],
  },
  {
    re: /PLAN_LIMIT_KEYS\.(\w+)/g,
    pattern: 'PLAN_LIMIT_KEYS',
    key: (m) => m[1].toLowerCase(),
  },
];

function extractFromFile(content: string, relativePath: string) {
  const rel = normalizeRelativePath(relativePath);
  const surface = inferSurfaceFromRelativePath(rel);
  const lines = content.split('\n');

  for (const { re, pattern, key } of PATTERNS) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      usages.push({
        limitKey: key(m),
        file: rel,
        line: lineNum,
        context: lines[lineNum - 1]?.trim?.()?.slice(0, 100) ?? '',
        surface,
        pattern,
      });
    }
  }
}

function main() {
  for (const dir of ['app', 'lib', 'src']) {
    const full = path.join(WEB_ADMIN, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of walkDir(full)) {
      extractFromFile(fs.readFileSync(file, 'utf-8'), path.relative(WEB_ADMIN, file));
    }
  }

  const outPath = path.join(DOCS, 'extracted-plan-limits-usage.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ extractedAt: new Date().toISOString(), schemaVersion: 1, usages }, null, 2),
    'utf-8'
  );

  console.log(`Extracted ${usages.length} plan limit usage rows`);
  console.log(`Output: ${outPath}`);
}

main();
