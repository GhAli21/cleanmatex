/**
 * Generates FLAG_CATALOG from hq_ff_feature_flags_mst query result.
 * Run: node scripts/generate-flag-catalog.js
 * Paste the JSON array from Supabase MCP execute_sql into DB_DATA below.
 */
const DB_DATA = require('./flag-catalog-db.json');

function formatDefaultValue(val, dataType) {
  if (dataType === 'object') return '{}';
  if (dataType === 'string') return typeof val === 'string' ? `'${val.replace(/'/g, "\\'")}'` : "''";
  if (dataType === 'integer' || dataType === 'number' || dataType === 'float') return Number(val) ?? 0;
  return val === true ? 'true' : 'false';
}

const entries = DB_DATA.map((e) => {
  const dv = formatDefaultValue(e.default_value, e.data_type);
  const name = (e.flag_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `  { flag_key: '${e.flag_key}', flag_name: '${name}', plan_binding_type: '${e.plan_binding_type}', data_type: '${e.data_type}', default_value: ${dv} }`;
});

console.log('export const FLAG_CATALOG: FlagCatalogEntry[] = [');
console.log(entries.join(',\n'));
console.log('];');
