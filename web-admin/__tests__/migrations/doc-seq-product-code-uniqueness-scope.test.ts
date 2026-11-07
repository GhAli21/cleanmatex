import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/0714_hfc_product_code_scope.sql',
)

const migration = readFileSync(migrationPath, 'utf8')

describe('PRODUCT and STOCK_ITEM Human-Friendly Code uniqueness scope', () => {
  it('matches the approved tenant-and-service-category product contract', () => {
    expect(migration).toMatch(/doc_type_code IN \('PRODUCT', 'STOCK_ITEM'\)/)
    expect(migration).toMatch(
      /unique_with = ARRAY\['tenant_org_id', 'service_category_code'\]::TEXT\[\]/,
    )
  })

  it('changes registry metadata without altering product data or its constraint', () => {
    expect(migration).not.toMatch(/ALTER TABLE public\.org_product_data_mst/i)
    expect(migration).not.toMatch(/CREATE (?:UNIQUE )?INDEX/i)
    expect(migration).not.toMatch(/DROP CONSTRAINT/i)
  })
})
