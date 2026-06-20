import * as fs from 'fs';
import type { FlagCatalogRecord } from '../inventories/schema';
import { FLAG_CATALOG_TS } from '../inventories/paths';
import { provenance, slugId, toRepoRelative } from './normalize';

export function ingestCatalogConstants(): { flagCatalog: FlagCatalogRecord[]; sources: string[] } {
  const content = fs.readFileSync(FLAG_CATALOG_TS, 'utf-8');
  const catalogStart = content.indexOf('export const FLAG_CATALOG');
  const catalogSection = catalogStart >= 0 ? content.slice(catalogStart) : content;
  const arrayStart = catalogSection.indexOf('[');
  const arrayEnd = catalogSection.indexOf('];', arrayStart);
  const arrayBody = arrayStart >= 0 && arrayEnd >= 0 ? catalogSection.slice(arrayStart + 1, arrayEnd) : '';

  const entryRe =
    /\{\s*flag_key:\s*['"]([^'"]+)['"]\s*,\s*flag_name:\s*['"]([^'"]+)['"]\s*,\s*plan_binding_type:\s*['"]([^'"]+)['"]\s*,\s*data_type:\s*['"]([^'"]+)['"][\s\S]*?\}/g;

  const flagCatalog: FlagCatalogRecord[] = [];
  let match: RegExpExecArray | null;

  while ((match = entryRe.exec(arrayBody)) !== null) {
    const block = match[0];
    const uiGroup = block.match(/ui_group:\s*['"]([^'"]+)['"]/)?.[1];
    const governanceCategory = block.match(/governance_category:\s*['"]([^'"]+)['"]/)?.[1];
    const rel = toRepoRelative(FLAG_CATALOG_TS);

    flagCatalog.push({
      id: slugId('flag_catalog', match[1]),
      kind: 'flag_catalog_entry',
      flagKey: match[1],
      flagName: match[2],
      planBindingType: match[3],
      dataType: match[4],
      governanceCategory,
      uiGroup,
      provenance: [provenance('flag-catalog-ts', rel)],
    });
  }

  return {
    flagCatalog,
    sources: [relPath()],
  };
}

function relPath(): string {
  return toRepoRelative(FLAG_CATALOG_TS);
}
