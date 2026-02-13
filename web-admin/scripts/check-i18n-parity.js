#!/usr/bin/env node
/**
 * i18n Parity Check Script 
 * Compares keys between en.json and ar.json to ensure both locale files have the same structure.
 * Exits with non-zero code if mismatches found (for CI).
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const EN_FILE = path.join(MESSAGES_DIR, 'en.json');
const AR_FILE = path.join(MESSAGES_DIR, 'ar.json');

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes('--fix');

  if (!fs.existsSync(EN_FILE)) {
    console.error(`Error: ${EN_FILE} not found`);
    process.exit(1);
  }
  if (!fs.existsSync(AR_FILE)) {
    console.error(`Error: ${AR_FILE} not found`);
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf8'));
  const ar = JSON.parse(fs.readFileSync(AR_FILE, 'utf8'));

  const enKeys = new Set(getAllKeys(en));
  const arKeys = new Set(getAllKeys(ar));

  const inEnNotAr = [...enKeys].filter((k) => !arKeys.has(k)).sort();
  const inArNotEn = [...arKeys].filter((k) => !enKeys.has(k)).sort();

  let hasErrors = false;

  if (inEnNotAr.length > 0) {
    hasErrors = true;
    console.error(`\nKeys in en.json but missing in ar.json (${inEnNotAr.length}):`);
    inEnNotAr.forEach((k) => console.error(`  - ${k}`));
    if (fixMode) {
      console.error('\n--fix: Add these keys to ar.json with placeholder or translated values.');
    }
  }

  if (inArNotEn.length > 0) {
    hasErrors = true;
    console.error(`\nKeys in ar.json but missing in en.json (${inArNotEn.length}):`);
    inArNotEn.forEach((k) => console.error(`  - ${k}`));
    if (fixMode) {
      console.error('\n--fix: Add these keys to en.json or remove from ar.json.');
    }
  }

  if (!hasErrors) {
    console.log('i18n parity check passed: en.json and ar.json have matching keys.');
    process.exit(0);
  }

  console.error('\nRun "npm run check:i18n" to verify. Fix the above mismatches.');
  process.exit(1);
}

main();
