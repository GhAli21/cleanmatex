#!/usr/bin/env node
/**
 * i18n catalog validation script.
 *
 * Validates the split locale catalogs under web-admin/messages/{locale}/.
 * Fails on structure/key drift and warns on suspicious content that still
 * deserves human review before shipping.
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const LOCALES = ['en', 'ar'];
const MAX_FILE_BYTES = 30 * 1024;
const MAX_FILE_LINES = 500;
const INDEX_FILE_NAME = 'index';
const INTENTIONAL_SAME_VALUE_KEYS = new Set([
  'auth.login.emailPlaceholder',
  'b2b.customer',
  'billing.receiptVoucher.create.amountPlaceholder',
  'catalog.b2b',
  'catalog.preferences.preferenceColorPlaceholder',
  'catalog.preferences.rowNumberShort',
  'catalog.vip',
  'common.auditCard.notAvailable',
  'customers.types.b2b',
  'erpLite.exceptions.groupHeading',
  'erpLite.eyebrow',
  'erpLite.home.snapshot.none',
  'erpLite.postAudit.columns.attempt',
  'finance.vouchers.postPreview.lineNo',
  'help.support.email',
  'invoices.filters.b2b',
  'navigation.financeAndAccounting',
  'newOrder.orderSummary.paymentModalVersionOptions.v3',
  'newOrder.payment.actions.submitChargeOnly',
  'newOrder.payment.actions.submitWithUnpaid',
  'newOrder.payment.giftCard.amountPlaceholder',
  'newOrder.payment.manualDiscount.amountPlaceholder',
  'newOrder.payment.manualDiscount.percentPlaceholder',
  'notifications.campaigns.form.nameArPlaceholder',
  'orders.preparation.productNameArabicPlaceholder',
  'payments.create.amountPlaceholder',
  'payments.refund.amountPlaceholder',
  'payments.table.noReference',
  'reports.export.csv',
  'reports.export.excel',
  'reports.export.pdf',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonObject(filePath) {
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`Locale file must contain a JSON object: ${filePath}`);
  }

  return parsed;
}

function collectLeafEntries(node, prefix = '') {
  const entries = [];

  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      entries.push(...collectLeafEntries(value, fullKey));
      continue;
    }

    entries.push({ key: fullKey, value });
  }

  return entries;
}

function extractPlaceholders(value) {
  if (typeof value !== 'string') {
    return [];
  }

  const placeholders = new Set();
  const placeholderMatcher = /\{([a-zA-Z0-9_]+)(?:,[^}]*)?\}/g;
  let match;

  while ((match = placeholderMatcher.exec(value)) !== null) {
    placeholders.add(match[1]);
  }

  return [...placeholders].sort();
}

function listJsonFiles(rootDir, currentDir = rootDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listJsonFiles(rootDir, entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.relative(rootDir, entryPath).replace(/\\/g, '/'));
    }
  }

  return files.sort();
}

function namespaceSegmentsForFile(relativeFilePath) {
  const parsed = path.posix.parse(relativeFilePath);
  const directorySegments = parsed.dir ? parsed.dir.split('/').filter(Boolean) : [];
  const fileSegments = parsed.name === INDEX_FILE_NAME ? [] : [parsed.name];
  return [...directorySegments, ...fileSegments];
}

function collectNamespaceCollisions(rootDir, currentDir = rootDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const directoryNames = new Set(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );
  const fileBaseNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.parse(entry.name).name)
    .filter((name) => name !== INDEX_FILE_NAME);
  const collisions = [];

  for (const fileBaseName of fileBaseNames) {
    if (directoryNames.has(fileBaseName)) {
      const collisionPath = path
        .relative(rootDir, path.join(currentDir, fileBaseName))
        .replace(/\\/g, '/');
      collisions.push(collisionPath);
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    collisions.push(...collectNamespaceCollisions(rootDir, path.join(currentDir, entry.name)));
  }

  return collisions.sort();
}

function collectLocaleCatalog(localeDir) {
  if (!fs.existsSync(localeDir)) {
    throw new Error(`Locale directory not found: ${localeDir}`);
  }

  const files = listJsonFiles(localeDir);
  const leaves = new Map();
  const warnings = [];

  for (const relativeFilePath of files) {
    const absoluteFilePath = path.join(localeDir, relativeFilePath);
    const namespaceSegments = namespaceSegmentsForFile(relativeFilePath);
    const namespaceRoot = namespaceSegments.join('.');

    const stats = fs.statSync(absoluteFilePath);
    const fileContents = fs.readFileSync(absoluteFilePath, 'utf8');
    const lineCount = fileContents.split(/\r?\n/u).length;

    if (stats.size > MAX_FILE_BYTES || lineCount > MAX_FILE_LINES) {
      warnings.push(
        `Oversized namespace file: ${relativeFilePath} (${stats.size} bytes, ${lineCount} lines)`
      );
    }

    const jsonObject = readJsonObject(absoluteFilePath);
    const leafEntries = collectLeafEntries(jsonObject, namespaceRoot);

    for (const entry of leafEntries) {
      if (leaves.has(entry.key)) {
        throw new Error(
          `Duplicate locale key "${entry.key}" detected in ${relativeFilePath} and ${leaves.get(entry.key).file}`
        );
      }

      leaves.set(entry.key, {
        file: relativeFilePath,
        value: entry.value,
      });
    }
  }

  const collisions = collectNamespaceCollisions(localeDir);

  if (collisions.length > 0) {
    throw new Error(
      `Namespace collision detected. A namespace cannot be both a file and a folder: ${collisions.join(', ')}`
    );
  }

  return {
    files,
    leaves,
    warnings,
  };
}

function findMissingValues(sourceMap, targetMap) {
  return [...sourceMap.keys()].filter((key) => !targetMap.has(key)).sort();
}

function validateLocaleCatalogs(messagesDir = MESSAGES_DIR) {
  const localeCatalogs = new Map();
  const warnings = [];
  const errors = [];

  for (const locale of LOCALES) {
    try {
      const localeDir = path.join(messagesDir, locale);
      localeCatalogs.set(locale, collectLocaleCatalog(localeDir));
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  const [enCatalog, arCatalog] = LOCALES.map((locale) => localeCatalogs.get(locale));

  const enFiles = new Set(enCatalog.files);
  const arFiles = new Set(arCatalog.files);

  const missingEnFiles = [...arFiles].filter((file) => !enFiles.has(file)).sort();
  const missingArFiles = [...enFiles].filter((file) => !arFiles.has(file)).sort();

  if (missingArFiles.length > 0) {
    errors.push(`Files present in en but missing in ar: ${missingArFiles.join(', ')}`);
  }

  if (missingEnFiles.length > 0) {
    errors.push(`Files present in ar but missing in en: ${missingEnFiles.join(', ')}`);
  }

  const missingArKeys = findMissingValues(enCatalog.leaves, arCatalog.leaves);
  const missingEnKeys = findMissingValues(arCatalog.leaves, enCatalog.leaves);

  if (missingArKeys.length > 0) {
    errors.push(`Keys present in en but missing in ar: ${missingArKeys.join(', ')}`);
  }

  if (missingEnKeys.length > 0) {
    errors.push(`Keys present in ar but missing in en: ${missingEnKeys.join(', ')}`);
  }

  for (const [key, enEntry] of enCatalog.leaves.entries()) {
    const arEntry = arCatalog.leaves.get(key);

    if (!arEntry) {
      continue;
    }

    const enPlaceholders = extractPlaceholders(enEntry.value);
    const arPlaceholders = extractPlaceholders(arEntry.value);

    if (JSON.stringify(enPlaceholders) !== JSON.stringify(arPlaceholders)) {
      errors.push(
        `Placeholder mismatch for "${key}": en=${JSON.stringify(enPlaceholders)} ar=${JSON.stringify(arPlaceholders)}`
      );
    }

    if (typeof enEntry.value === 'string' && typeof arEntry.value === 'string') {
      const trimmedEn = enEntry.value.trim();
      const trimmedAr = arEntry.value.trim();

      if (trimmedEn.length === 0 || trimmedAr.length === 0) {
        warnings.push(`Empty translation value for "${key}"`);
      }

      if (trimmedEn === trimmedAr && !INTENTIONAL_SAME_VALUE_KEYS.has(key)) {
        warnings.push(`Same EN/AR value for "${key}"`);
      }

      if (
        /TODO|FIXME|TRANSLATE/iu.test(trimmedEn) ||
        /TODO|FIXME|TRANSLATE/iu.test(trimmedAr)
      ) {
        warnings.push(`Suspicious placeholder content for "${key}"`);
      }
    }
  }

  warnings.push(...enCatalog.warnings, ...arCatalog.warnings);

  return { errors, warnings };
}

function main() {
  const { errors, warnings } = validateLocaleCatalogs();

  if (warnings.length > 0) {
    console.warn('\nWarnings:');
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  if (errors.length > 0) {
    console.error('\nErrors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('i18n catalog check passed: locale trees, keys, and placeholders are aligned.');
}

if (require.main === module) {
  main();
}

module.exports = {
  collectLeafEntries,
  collectLocaleCatalog,
  extractPlaceholders,
  validateLocaleCatalogs,
};
