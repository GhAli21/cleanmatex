import * as fs from 'fs';
import type {
  FeatureFlagUsageRecord,
  PermissionUsageRecord,
  PlanLimitUsageRecord,
  SettingUsageRecord,
} from '../inventories/schema';
import { EXTRACTED_PATHS } from '../inventories/paths';
import {
  inferSurfaceFromRelativePath,
  normalizeRelativePath,
  type ExtractSurface,
} from '../inventories/surface';
import { provenance, slugId } from './normalize';

interface ExtractedPermissionsFile {
  extractedAt?: string;
  screens?: {
    file: string;
    route?: string;
    permission: string;
    component: string;
    line: number;
    surface?: ExtractSurface;
  }[];
  apis?: {
    file: string;
    method: string;
    route: string;
    permission: string;
    line: number;
    surface?: ExtractSurface;
  }[];
}

interface ExtractedFeatureFlagsFile {
  extractedAt?: string;
  usages?: Record<
    string,
    { path: string; line: number; context: string; surface?: ExtractSurface; pattern?: string }[]
  >;
}

interface ExtractedSettingsFile {
  extractedAt?: string;
  usages?: Record<string, { path: string; line: number; context: string }[]>;
}

interface ExtractedPlanLimitsFile {
  extractedAt?: string;
  usages?: {
    limitKey: string;
    file: string;
    line: number;
    context: string;
    surface?: ExtractSurface;
    pattern?: string;
  }[];
}

function toPermissionSurface(surface: ExtractSurface): PermissionUsageRecord['surface'] {
  if (surface === 'api') return 'api';
  if (surface === 'screen') return 'screen';
  return 'unknown';
}

function resolveSurface(filePath: string, explicit?: ExtractSurface): ExtractSurface {
  if (explicit) return explicit;
  return inferSurfaceFromRelativePath(normalizeRelativePath(filePath));
}

export function ingestExtractedJson(): {
  permissionUsages: PermissionUsageRecord[];
  featureFlagUsages: FeatureFlagUsageRecord[];
  settingUsages: SettingUsageRecord[];
  planLimitUsages: PlanLimitUsageRecord[];
  sources: string[];
} {
  const permissionUsages: PermissionUsageRecord[] = [];
  const featureFlagUsages: FeatureFlagUsageRecord[] = [];
  const settingUsages: SettingUsageRecord[] = [];
  const planLimitUsages: PlanLimitUsageRecord[] = [];
  const sources: string[] = [];

  if (fs.existsSync(EXTRACTED_PATHS.permissions)) {
    const rel = 'docs/platform/permissions/extracted-permissions.json';
    sources.push(rel);
    const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.permissions, 'utf-8')) as ExtractedPermissionsFile;

    for (const row of data.screens ?? []) {
      const file = normalizeRelativePath(row.file);
      const surface = resolveSurface(file, row.surface);
      permissionUsages.push({
        id: slugId('perm_screen', `${file}:${row.line}:${row.permission}`),
        kind: 'permission_usage',
        permissionCode: row.permission,
        surface: toPermissionSurface(surface),
        route: row.route,
        file,
        line: row.line,
        component: row.component,
        provenance: [
          provenance('extracted-permissions-json', rel, {
            extractedAt: data.extractedAt,
            line: row.line,
          }),
        ],
      });
    }

    for (const row of data.apis ?? []) {
      const file = normalizeRelativePath(row.file);
      permissionUsages.push({
        id: slugId('perm_api', `${file}:${row.line}:${row.permission}`),
        kind: 'permission_usage',
        permissionCode: row.permission,
        surface: 'api',
        route: row.route,
        file,
        line: row.line,
        provenance: [
          provenance('extracted-permissions-json', rel, {
            extractedAt: data.extractedAt,
            line: row.line,
          }),
        ],
      });
    }
  }

  if (fs.existsSync(EXTRACTED_PATHS.featureFlags)) {
    const rel = 'docs/platform/feature_flags/extracted-feature-flags-usage.json';
    sources.push(rel);
    const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.featureFlags, 'utf-8')) as ExtractedFeatureFlagsFile;

    for (const [flagKey, rows] of Object.entries(data.usages ?? {})) {
      for (const row of rows) {
        const file = normalizeRelativePath(row.path);
        featureFlagUsages.push({
          id: slugId('flag', `${file}:${row.line}:${flagKey}`),
          kind: 'feature_flag_usage',
          flagKey,
          surface: resolveSurface(file, row.surface),
          file,
          line: row.line,
          context: row.context,
          provenance: [
            provenance('extracted-feature-flags-json', rel, {
              extractedAt: data.extractedAt,
              line: row.line,
            }),
          ],
        });
      }
    }
  }

  if (fs.existsSync(EXTRACTED_PATHS.settings)) {
    const rel = 'docs/platform/settings/extracted-settings-usage.json';
    sources.push(rel);
    const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.settings, 'utf-8')) as ExtractedSettingsFile;

    for (const [settingCode, rows] of Object.entries(data.usages ?? {})) {
      for (const row of rows) {
        const file = normalizeRelativePath(row.path);
        settingUsages.push({
          id: slugId('setting', `${file}:${row.line}:${settingCode}`),
          kind: 'setting_usage',
          settingCode,
          surface: resolveSurface(file),
          file,
          line: row.line,
          context: row.context,
          provenance: [
            provenance('extracted-settings-json', rel, {
              extractedAt: data.extractedAt,
              line: row.line,
            }),
          ],
        });
      }
    }
  }

  if (fs.existsSync(EXTRACTED_PATHS.planLimits)) {
    const rel = 'docs/platform/plan_limits/extracted-plan-limits-usage.json';
    sources.push(rel);
    const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.planLimits, 'utf-8')) as ExtractedPlanLimitsFile;

    for (const row of data.usages ?? []) {
      const file = normalizeRelativePath(row.file);
      planLimitUsages.push({
        id: slugId('plan_limit', `${file}:${row.line}:${row.limitKey}`),
        kind: 'plan_limit_usage',
        limitKey: row.limitKey,
        surface: resolveSurface(file, row.surface),
        file,
        line: row.line,
        context: row.context,
        pattern: row.pattern,
        provenance: [
          provenance('extracted-plan-limits-json', rel, {
            extractedAt: data.extractedAt,
            line: row.line,
          }),
        ],
      });
    }
  }

  return { permissionUsages, featureFlagUsages, settingUsages, planLimitUsages, sources };
}
