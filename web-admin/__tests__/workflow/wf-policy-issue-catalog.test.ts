/**
 * Offline tenant pin for the HQ workflow policy-issue catalog.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const candidates = [
  join(__dirname, '../../../docs/features/Workflow_Order_Advance/generated/wf-policy-issue-catalog.json'),
  join(process.cwd(), 'docs/features/Workflow_Order_Advance/generated/wf-policy-issue-catalog.json'),
  join(process.cwd(), '../docs/features/Workflow_Order_Advance/generated/wf-policy-issue-catalog.json'),
];

const catalogPath = candidates.find((candidate) => existsSync(candidate));

interface CatalogFile {
  catalog_version: string;
  schema_version: number;
  issues: Array<{
    code: string;
    seed_must_pass: boolean;
    implementation_status: string;
    severity: string;
  }>;
}

describe('wf policy issue catalog pin', () => {
  it('is a versioned registry with seed_must_pass errors', () => {
    expect(catalogPath).toBeDefined();
    const catalog = JSON.parse(readFileSync(catalogPath as string, 'utf8')) as CatalogFile;
    expect(catalog.schema_version).toBe(1);
    expect(catalog.catalog_version).toMatch(/^\d+\.\d+\.\d+$/);
    const seedMustPass = catalog.issues.filter((row) => row.seed_must_pass);
    expect(seedMustPass.length).toBeGreaterThan(10);
    expect(seedMustPass.every((row) => row.implementation_status === 'emitted')).toBe(true);
    expect(seedMustPass.map((row) => row.code)).toEqual(
      expect.arrayContaining([
        'status_multiple_primary_owners',
        'stage_sequence_blank_status',
        'pickup_without_ready_release',
      ]),
    );
  });
});
