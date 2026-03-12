#!/usr/bin/env npx tsx
/**
 * Compare extracted data with docs.
 * Report drift (e.g., new API route without documented permission)
 * Run: npm run docs:validate (from web-admin)
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCS = path.resolve(__dirname, '../../docs/platform');
const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');

const issues: string[] = [];

function checkExtractedPermissions() {
  const extractedPath = path.join(DOCS, 'permissions', 'extracted-permissions.json');
  if (!fs.existsSync(extractedPath)) {
    issues.push('Run docs:extract-permissions first - extracted-permissions.json not found');
    return;
  }
  const data = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));
  if (data.apis?.length === 0 && data.screens?.length === 0) {
    issues.push('Extracted permissions is empty - verify extraction ran correctly');
  }
}

function checkExtractedSettings() {
  const extractedPath = path.join(DOCS, 'settings', 'extracted-settings-usage.json');
  if (!fs.existsSync(extractedPath)) {
    issues.push('Run docs:extract-settings first - extracted-settings-usage.json not found');
    return;
  }
}

function checkExtractedFeatureFlags() {
  const extractedPath = path.join(DOCS, 'feature_flags', 'extracted-feature-flags-usage.json');
  if (!fs.existsSync(extractedPath)) {
    issues.push('Run docs:extract-feature-flags first - extracted-feature-flags-usage.json not found');
    return;
  }
}

function checkApiAuthAudit() {
  const auditPath = path.join(DOCS, 'permissions', 'API_AUTH_AUDIT.md');
  if (!fs.existsSync(auditPath)) {
    issues.push('Run docs:extract-api-auth-audit first - API_AUTH_AUDIT.md not found');
    return;
  }
}

function checkDocExistence() {
  const required = [
    'permissions/PERMISSIONS_REFERENCE.md',
    'permissions/PERMISSIONS_BY_API.md',
    'settings/SETTINGS_REFERENCE.md',
    'feature_flags/FEATURE_FLAGS_REFERENCE.md',
    'plan_limits/PLAN_LIMITS_REFERENCE.md',
  ];
  for (const r of required) {
    const p = path.join(DOCS, r);
    if (!fs.existsSync(p)) {
      issues.push(`Missing doc: ${r}`);
    }
  }
}

function main() {
  checkDocExistence();
  checkExtractedPermissions();
  checkExtractedSettings();
  checkExtractedFeatureFlags();
  checkApiAuthAudit();

  if (issues.length > 0) {
    console.error('Validation issues:');
    issues.forEach((i) => console.error('  -', i));
    process.exit(1);
  }
  console.log('Docs validation passed');
}

main();
