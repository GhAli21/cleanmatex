#!/usr/bin/env npx tsx
/**
 * Extract feature flag checks from web-admin codebase.
 * Multi-surface tagging + RequireFeature, useFeature, usePlanFlags, FLAG_KEYS, canAccess, requireFeature
 * Run: npm run docs:extract-feature-flags
 */

import * as fs from 'fs';
import * as path from 'path';
import { inferSurfaceFromRelativePath, normalizeRelativePath, type ExtractSurface } from './inventories/surface';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/feature_flags');

interface FlagUsageRow {
  path: string;
  line: number;
  context: string;
  surface: ExtractSurface;
  pattern: string;
}

const usages = new Map<string, FlagUsageRow[]>();

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

type PatternDef = {
  re: RegExp;
  pattern: string;
  key: string | ((m: RegExpExecArray) => string);
};

const PATTERNS: PatternDef[] = [
  { re: /getFeatureFlags\s*\(/g, pattern: 'getFeatureFlags', key: 'getFeatureFlags' },
  { re: /canAccess\s*\(\s*[^,]+,\s*["']([^"']+)["']/g, pattern: 'canAccess', key: (m) => m[1] },
  { re: /requireFeature\s*\(\s*[^,]+,\s*["']([^"']+)["']/g, pattern: 'requireFeature', key: (m) => m[1] },
  { re: /requireFeature\s*\(\s*[^,]+,\s*FEATURE_FLAG_KEYS\.(\w+)/g, pattern: 'requireFeature', key: (m) => m[1].toLowerCase() },
  { re: /currentTenantCan\s*\(\s*["']([^"']+)["']/g, pattern: 'currentTenantCan', key: (m) => m[1] },
  { re: /useFeature\s*\(\s*FEATURE_FLAG_KEYS\.(\w+)/g, pattern: 'useFeature', key: (m) => m[1].toLowerCase() },
  { re: /useFeature\s*\(\s*["']([^"']+)["']/g, pattern: 'useFeature', key: (m) => m[1] },
  { re: /useFeatureOptional\s*\(\s*FEATURE_FLAG_KEYS\.(\w+)/g, pattern: 'useFeatureOptional', key: (m) => m[1].toLowerCase() },
  { re: /RequireFeature\s+[^>]*featureFlag=["']([^"']+)["']/g, pattern: 'RequireFeature', key: (m) => m[1] },
  { re: /RequireFeature\s+[^>]*featureFlag=\{FEATURE_FLAG_KEYS\.(\w+)\}/g, pattern: 'RequireFeature', key: (m) => m[1].toLowerCase() },
  { re: /featureFlag:\s*FLAG_KEYS\.(\w+)/g, pattern: 'FLAG_KEYS', key: (m) => m[1].toLowerCase() },
  { re: /featureFlag:\s*["']([^"']+)["']/g, pattern: 'featureFlag', key: (m) => m[1] },
  { re: /usePlanFlags\s*\(/g, pattern: 'usePlanFlags', key: 'usePlanFlags' },
  { re: /feature_flags\.(\w+)/g, pattern: 'feature_flags', key: (m) => m[1] },
];

function resolveFlagKey(raw: string): string {
  if (raw === 'getFeatureFlags' || raw === 'usePlanFlags') return raw;
  return raw.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/__+/g, '_');
}

function extractFromFile(_filePath: string, content: string, relativePath: string) {
  const rel = normalizeRelativePath(relativePath);
  const surface = inferSurfaceFromRelativePath(rel);
  const lines = content.split('\n');

  for (const { re, pattern, key } of PATTERNS) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      const rawKey = typeof key === 'function' ? key(m) : key;
      const useKey = resolveFlagKey(rawKey);
      const context = lines[lineNum - 1]?.trim?.()?.slice(0, 100) ?? '';

      if (!usages.has(useKey)) usages.set(useKey, []);
      usages.get(useKey)!.push({ path: rel, line: lineNum, context, surface, pattern });
    }
  }
}

function main() {
  for (const dir of ['app', 'lib', 'src', 'config']) {
    const full = path.join(WEB_ADMIN, dir);
    if (fs.existsSync(full)) {
      for (const file of walkDir(full)) {
        const content = fs.readFileSync(file, 'utf-8');
        const rel = path.relative(WEB_ADMIN, file);
        extractFromFile(file, content, rel);
      }
    }
  }

  const output: Record<string, FlagUsageRow[]> = {};
  for (const [k, v] of usages) {
    output[k] = v;
  }

  const outPath = path.join(DOCS, 'extracted-feature-flags-usage.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { extractedAt: new Date().toISOString(), schemaVersion: 2, usages: output },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Extracted feature flag usage for ${usages.size} keys`);
  console.log(`Output: ${outPath}`);
}

main();
