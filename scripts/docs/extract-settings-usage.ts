#!/usr/bin/env npx tsx
/**
 * Extract settings usage from web-admin codebase.
 * Grep for getSettingValue, fn_stng_resolve, SETTING_CODES, setting codes
 * Output: SETTINGS_USAGE data (JSON)
 * Run: npm run docs:extract-settings (from web-admin)
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/settings');

interface SettingUsage {
  settingCode: string;
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
  /getSettingValue\s*\(\s*["']([^"']+)["']/g,
  /fn_stng_resolve[_\w]*\s*\(/g,
  /SETTING_CODES\.(\w+)/g,
  /["'](TENANT_CURRENCY|TENANT_DECIMAL_PLACES|TENANT_VAT_RATE|DEFAULT_PHONE_COUNTRY_CODE|SERVICE_PREF_\w+)["']/g,
];

function extractFromFile(filePath: string, content: string, relativePath: string) {
  const lines = content.split('\n');
  for (const pattern of PATTERNS) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      const code = m[1] || (pattern.source.includes('fn_stng') ? 'fn_stng_resolve' : 'unknown');
      const context = lines[lineNum - 1]?.trim?.()?.slice(0, 80) ?? '';
      const key = typeof code === 'string' ? code : 'fn_stng_resolve';
      if (!usages.has(key)) usages.set(key, []);
      usages.get(key)!.push({ path: relativePath, line: lineNum, context });
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

  const outPath = path.join(DOCS, 'extracted-settings-usage.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ extractedAt: new Date().toISOString(), usages: output }, null, 2), 'utf-8');

  console.log(`Extracted settings usage for ${usages.size} keys`);
  console.log(`Output: ${outPath}`);
}

main();
