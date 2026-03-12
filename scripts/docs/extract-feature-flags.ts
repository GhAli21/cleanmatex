#!/usr/bin/env npx tsx
/**
 * Extract feature flag checks from web-admin codebase.
 * Parse getFeatureFlags, canAccess, requireFeature, currentTenantCan, feature_flag
 * Output: FEATURE_FLAGS_USAGE data (JSON)
 * Run: npm run docs:extract-feature-flags (from web-admin)
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/feature_flags');

interface FlagUsage {
  flag: string;
  files: { path: string; line: number; context: string }[];
}

const usages = new Map<string, { path: string; line: number; context: string }[]>();

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next', '__tests__'].includes(e.name)) {
        yield* walkDir(full);
      }
    } else if (['.ts', '.tsx', '.js', '.jsx'].some((x) => e.name.endsWith(x))) {
      yield full;
    }
  }
}

const PATTERNS = [
  { re: /getFeatureFlags\s*\(/g, key: 'getFeatureFlags' },
  { re: /canAccess\s*\(\s*[^,]+,\s*["']([^"']+)["']/g, key: (m: RegExpExecArray) => m[1] },
  { re: /requireFeature\s*\(\s*[^,]+,\s*["']([^"']+)["']/g, key: (m: RegExpExecArray) => m[1] },
  { re: /currentTenantCan\s*\(\s*["']([^"']+)["']/g, key: (m: RegExpExecArray) => m[1] },
  { re: /feature_flags\.(\w+)/g, key: (m: RegExpExecArray) => m[1] },
  { re: /feature_flag\s*[=:]/g, key: 'feature_flag' },
];

function extractFromFile(filePath: string, content: string, relativePath: string) {
  const lines = content.split('\n');
  for (const { re, key } of PATTERNS) {
    let m;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      const k = typeof key === 'function' ? key(m) : key;
      const context = lines[lineNum - 1]?.trim?.()?.slice(0, 80) ?? '';
      const useKey = k || 'unknown';
      if (!usages.has(useKey)) usages.set(useKey, []);
      usages.get(useKey)!.push({ path: relativePath, line: lineNum, context });
    }
  }
}

function main() {
  for (const dir of ['app', 'lib', 'src']) {
    const full = path.join(WEB_ADMIN, dir);
    if (fs.existsSync(full)) {
      for (const file of walkDir(full)) {
        const content = fs.readFileSync(file, 'utf-8');
        const rel = path.relative(WEB_ADMIN, file);
        extractFromFile(file, content, rel);
      }
    }
  }

  const output: Record<string, { path: string; line: number; context: string }[]> = {};
  for (const [k, v] of usages) {
    output[k] = v;
  }

  const outPath = path.join(DOCS, 'extracted-feature-flags-usage.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ extractedAt: new Date().toISOString(), usages: output }, null, 2), 'utf-8');

  console.log(`Extracted feature flag usage for ${usages.size} keys`);
  console.log(`Output: ${outPath}`);
}

main();
