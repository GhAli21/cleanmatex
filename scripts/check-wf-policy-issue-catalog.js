#!/usr/bin/env node
/**
 * Tenant pin check for the HQ workflow policy-issue catalog.
 * Run from repo root: npm run check:wf-policy-issue-catalog
 */
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(
  __dirname,
  '..',
  'docs/features/Workflow_Order_Advance/generated/wf-policy-issue-catalog.json',
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(catalogPath)) {
  fail(`Missing catalog pin: ${catalogPath}`);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
if (catalog.schema_version !== 1) {
  fail(`Unsupported catalog schema_version: ${catalog.schema_version}`);
}
if (!/^\d+\.\d+\.\d+$/.test(catalog.catalog_version || '')) {
  fail('catalog_version must be semver');
}
if (!Array.isArray(catalog.issues) || catalog.issues.length === 0) {
  fail('catalog.issues must be a non-empty array');
}

const codes = catalog.issues.map((row) => row.code);
if (new Set(codes).size !== codes.length) {
  fail('Duplicate issue codes in catalog pin');
}

const required = [
  'code',
  'category',
  'severity',
  'gates',
  'path',
  'studio_tab',
  'message_key',
  'hint_key',
  'autofix',
  'seed_must_pass',
  'implementation_status',
];
for (const row of catalog.issues) {
  for (const field of required) {
    if (row[field] === undefined || row[field] === null) {
      fail(`Catalog row ${row.code || '?'} missing ${field}`);
    }
  }
}

const seedMustPass = catalog.issues.filter((row) => row.seed_must_pass);
if (seedMustPass.length === 0) {
  fail('seed_must_pass is empty; platform seeds would have no catalog gate');
}
for (const row of seedMustPass) {
  if (row.implementation_status !== 'emitted') {
    fail(`${row.code} is seed_must_pass but not emitted`);
  }
  if (row.severity !== 'error') {
    fail(`${row.code} is seed_must_pass but severity is ${row.severity}`);
  }
}

const requiredSeedCodes = [
  'stage_sequence_blank_status',
  'status_multiple_primary_owners',
  'status_owner_not_primary_module',
  'execution_status_not_in_stage_sequence',
  'initial_rule_status_not_in_stage_sequence',
  'initial_rule_status_without_owner',
  'execution_status_without_owner',
  'execution_without_channel',
  'confirm_pickup_not_on_pickup_handover',
  'pickup_without_ready_release',
];
const seedCodes = new Set(seedMustPass.map((row) => row.code));
for (const code of requiredSeedCodes) {
  if (!seedCodes.has(code)) {
    fail(`seed_must_pass missing required code ${code}`);
  }
}

console.log(
  `Tenant catalog pin ok: v${catalog.catalog_version}, ${catalog.issues.length} codes, ${seedMustPass.length} seed_must_pass.`,
);
