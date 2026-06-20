export type DriftKind =
  | 'missing_contract'
  | 'orphan_contract'
  | 'duplicate_route_pattern'
  | 'static_after_dynamic'
  | 'nav_contract_permission_mismatch'
  | 'nav_contract_feature_flag_mismatch'
  | 'nav_missing_contract';

export type DriftSeverity = 'error' | 'warn';

export interface DriftItem {
  id: string;
  kind: DriftKind;
  severity: DriftSeverity;
  message: string;
  path?: string;
  details?: Record<string, string | string[] | boolean | number>;
}

export interface KnownExceptionsFile {
  schemaVersion: number;
  description?: string;
  exceptions: { id: string; reason: string; addedAt?: string }[];
}

export interface ReconcileResult {
  driftItems: DriftItem[];
  generatedAt: string;
  counts: {
    errors: number;
    warnings: number;
    total: number;
  };
}
