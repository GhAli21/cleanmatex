import * as path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const WEB_ADMIN = path.join(REPO_ROOT, 'web-admin');
export const DOCS_PLATFORM = path.join(REPO_ROOT, 'docs/platform');
export const INVENTORIES_DIR = path.join(DOCS_PLATFORM, 'inventories');

export const EXTRACTED_PATHS = {
  permissions: path.join(DOCS_PLATFORM, 'permissions/extracted-permissions.json'),
  featureFlags: path.join(DOCS_PLATFORM, 'feature_flags/extracted-feature-flags-usage.json'),
  settings: path.join(DOCS_PLATFORM, 'settings/extracted-settings-usage.json'),
  planLimits: path.join(DOCS_PLATFORM, 'plan_limits/extracted-plan-limits-usage.json'),
} as const;

export const INVENTORY_OUTPUT = path.join(INVENTORIES_DIR, 'platform-info-inventory.json');
/** Deploy/runtime copy read by web-admin Help UI API (Vercel does not ship repo-root docs/). */
export const WEB_ADMIN_INVENTORY_RUNTIME = path.join(WEB_ADMIN, 'data/platform/platform-info-inventory.json');
export const GENERATED_GATE_MATRIX = path.join(INVENTORIES_DIR, 'GENERATED_GATE_MATRIX.md');
export const GENERATED_PERMISSIONS = path.join(INVENTORIES_DIR, 'GENERATED_PERMISSIONS.md');
export const GENERATED_FEATURE_FLAGS = path.join(INVENTORIES_DIR, 'GENERATED_FEATURE_FLAGS.md');
export const GENERATED_FEATURE_FLAGS_BY_SCREEN = path.join(INVENTORIES_DIR, 'GENERATED_FEATURE_FLAGS_BY_SCREEN.md');
export const GENERATED_FEATURE_FLAGS_BY_API = path.join(INVENTORIES_DIR, 'GENERATED_FEATURE_FLAGS_BY_API.md');
export const GENERATED_FEATURE_FLAGS_BY_SERVICE = path.join(INVENTORIES_DIR, 'GENERATED_FEATURE_FLAGS_BY_SERVICE.md');
export const DRIFT_REPORT = path.join(INVENTORIES_DIR, 'DRIFT_REPORT.md');
export const GENERATED_UNDOCUMENTED = path.join(INVENTORIES_DIR, 'GENERATED_UNDOCUMENTED.md');
export const GENERATED_ORPHANS = path.join(INVENTORIES_DIR, 'GENERATED_ORPHANS.md');
export const KNOWN_EXCEPTIONS = path.join(INVENTORIES_DIR, 'KNOWN_EXCEPTIONS.json');

export const NAVIGATION_TS = path.join(WEB_ADMIN, 'config/navigation.ts');
export const FLAG_CATALOG_TS = path.join(WEB_ADMIN, 'lib/constants/feature-flags.ts');
export const ACCESS_CONTRACTS_DIR = path.join(WEB_ADMIN, 'src/features');
