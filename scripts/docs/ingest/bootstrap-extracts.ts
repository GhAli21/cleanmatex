import { execSync } from 'child_process';
import * as fs from 'fs';
import { EXTRACTED_PATHS, REPO_ROOT } from '../inventories/paths';

const BOOTSTRAP_TARGETS: { npmScript: string; outputPath: string }[] = [
  { npmScript: 'docs:extract-permissions', outputPath: EXTRACTED_PATHS.permissions },
  { npmScript: 'docs:extract-feature-flags', outputPath: EXTRACTED_PATHS.featureFlags },
  { npmScript: 'docs:extract-settings', outputPath: EXTRACTED_PATHS.settings },
  { npmScript: 'docs:extract-plan-limits', outputPath: EXTRACTED_PATHS.planLimits },
];

export function bootstrapMissingExtracts(): string[] {
  const ran: string[] = [];

  for (const { npmScript, outputPath } of BOOTSTRAP_TARGETS) {
    if (fs.existsSync(outputPath)) continue;

    console.log(`[bootstrap] Missing ${outputPath} — running ${npmScript}...`);
    execSync(`npm run ${npmScript}`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    ran.push(npmScript);
  }

  return ran;
}
