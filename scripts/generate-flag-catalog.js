/**
 * Generates FLAG_CATALOG from hq_ff_feature_flags_mst query result.
 * Run: node scripts/generate-flag-catalog.js
 * Source: scripts/flag-catalog-db.json (from Supabase MCP execute_sql or extract-flag-catalog.js)
 */
const DB_DATA = require('./flag-catalog-db.json');

function formatDefaultValue(val, dataType) {
  if (dataType === 'object') return '{}';
  if (dataType === 'string') return typeof val === 'string' ? `'${String(val).replace(/'/g, "\\'")}'` : "''";
  if (dataType === 'integer' || dataType === 'number' || dataType === 'float') return Number(val) ?? 0;
  return val === true ? 'true' : 'false';
}

function esc(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const entries = DB_DATA.map((e) => {
  const dv = formatDefaultValue(e.default_value, e.data_type);
  const parts = [
    `flag_key: '${e.flag_key}'`,
    `flag_name: '${esc(e.flag_name)}'`,
    `plan_binding_type: '${e.plan_binding_type}'`,
    `data_type: '${e.data_type}'`,
    `default_value: ${dv}`,
  ];
  if (e.ui_group) parts.push(`ui_group: '${esc(e.ui_group)}'`);
  if (e.governance_category) parts.push(`governance_category: '${esc(e.governance_category)}'`);
  if (e.ui_display_order != null) parts.push(`ui_display_order: ${e.ui_display_order}`);
  // flag_name2 (Arabic) loaded from hq_ff_feature_flags_mst at runtime
  return `  { ${parts.join(', ')} }`;
});

const fs = require('fs');
const path = require('path');
const out = `export const FLAG_CATALOG: FlagCatalogEntry[] = [\n${entries.join(',\n')}\n];\n`;
fs.writeFileSync(path.join(__dirname, 'flag-catalog-ts.txt'), out, 'utf8');
console.log('Wrote', entries.length, 'entries to scripts/flag-catalog-ts.txt');
