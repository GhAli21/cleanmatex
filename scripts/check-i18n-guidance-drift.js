#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

const ROOTS_TO_SCAN = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'web-admin/README.md',
  'web-admin/.clauderc',
  '.cursor/rules',
  '.codex/skills',
  '.codex/docs',
  '.claude/skills',
  '.claude/docs',
  '.agents/skills',
  'docs/dev/i18n_docs',
  'docs/features/_templates',
  'templates',
];

const FORBIDDEN_PATTERNS = [
  /web-admin\/messages\/en\.json/gu,
  /web-admin\/messages\/ar\.json/gu,
  /web-admin\/messages\/\{en,ar\}\.json/gu,
  /messages\/en\.json/gu,
  /messages\/ar\.json/gu,
  /messages\/\{en,ar\}\.json/gu,
  /platform-web\/messages/gu,
];

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized);

  return (
    normalized.startsWith('.cursor/plans/') ||
    normalized.startsWith('.claude/agent-references/') ||
    baseName.startsWith('OLD') ||
    normalized.includes('reference-original') ||
    normalized.endsWith('.png') ||
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.lnk')
  );
}

function collectFiles(targetPath) {
  const stats = fs.statSync(targetPath);

  if (stats.isFile()) {
    return [targetPath];
  }

  const files = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function main() {
  const findings = [];

  for (const root of ROOTS_TO_SCAN) {
    const absoluteRoot = path.join(REPO_ROOT, root);

    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    const files = collectFiles(absoluteRoot);

    for (const absoluteFilePath of files) {
      const relativePath = path.relative(REPO_ROOT, absoluteFilePath).replace(/\\/g, '/');

      if (shouldSkip(relativePath)) {
        continue;
      }

      const fileContents = fs.readFileSync(absoluteFilePath, 'utf8');
      const lines = fileContents.split(/\r?\n/u);

      lines.forEach((line, index) => {
        FORBIDDEN_PATTERNS.forEach((pattern) => {
          if (pattern.test(line)) {
            findings.push(`${relativePath}:${index + 1}: ${line.trim()}`);
          }
          pattern.lastIndex = 0;
        });
      });
    }
  }

  if (findings.length > 0) {
    console.error('Active i18n guidance still references the monolithic locale model:');
    findings.forEach((finding) => console.error(`  - ${finding}`));
    process.exit(1);
  }

  console.log('i18n guidance drift audit passed.');
}

main();
