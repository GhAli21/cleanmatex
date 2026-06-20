import fs from 'fs'
import path from 'path'
import {
  getAllPageAccessContracts,
  getPageAccessContractByPath,
} from '@features/access/page-access-registry'

function collectPageRoutes(baseDir: string): string[] {
  const routes: string[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (entry.isFile() && entry.name === 'page.tsx') {
        const route = fullPath
          .replace(path.join(baseDir, 'app'), '')
          .replace(/[\\/]page\.tsx$/, '')
          .replace(/\\/g, '/')

        routes.push(route || '/')
      }
    }
  }

  walk(path.join(baseDir, 'app', 'dashboard'))

  return routes
}

function isStaticBeforeDynamic(staticRoute: string, dynamicRoute: string): boolean {
  const normalize = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value)
  const staticSegs = normalize(staticRoute).split('/').filter(Boolean)
  const dynamicSegs = normalize(dynamicRoute).split('/').filter(Boolean)
  if (staticSegs.length !== dynamicSegs.length) return false

  for (let i = 0; i < staticSegs.length; i++) {
    const sDyn = staticSegs[i].startsWith('[') && staticSegs[i].endsWith(']')
    const dDyn = dynamicSegs[i].startsWith('[') && dynamicSegs[i].endsWith(']')

    if (!sDyn && !dDyn && staticSegs[i] !== dynamicSegs[i]) {
      return false
    }

    if (!sDyn && dDyn) {
      return staticSegs.slice(0, i).every((seg, j) => seg === dynamicSegs[j])
    }
  }

  return false
}

const KNOWN_STATIC_ORDER_VIOLATIONS = new Set<string>()

describe('platform inventories — registry integrity', () => {
  it('has no duplicate routePattern values in the registry', () => {
    const contracts = getAllPageAccessContracts()
    const seen = new Set<string>()
    const duplicates: string[] = []

    for (const contract of contracts) {
      if (seen.has(contract.routePattern)) {
        duplicates.push(contract.routePattern)
      }
      seen.add(contract.routePattern)
    }

    expect(duplicates).toEqual([])
  })

  it('registers static routes before overlapping dynamic routes in registry order', () => {
    const contracts = getAllPageAccessContracts()
    const violations: string[] = []

    for (let i = 0; i < contracts.length; i++) {
      for (let j = i + 1; j < contracts.length; j++) {
        const earlier = contracts[i].routePattern
        const later = contracts[j].routePattern
        if (isStaticBeforeDynamic(later, earlier)) {
          violations.push(`${later}|${earlier}`)
        }
      }
    }

    const newViolations = violations.filter((v) => !KNOWN_STATIC_ORDER_VIOLATIONS.has(v))
    expect(newViolations).toEqual([])
  })

  it('covers every dashboard page route with a contract', () => {
    const baseDir = process.cwd()
    const pageRoutes = collectPageRoutes(baseDir)
      .map((route) => (route.startsWith('/dashboard') ? route : `/dashboard${route}`))
      .sort()

    const missingRoutes = pageRoutes.filter((route) => !getPageAccessContractByPath(route))

    expect(missingRoutes).toEqual([])
  })

  it('resolves representative dynamic routes', () => {
    expect(getPageAccessContractByPath('/dashboard/orders/123')?.routePattern).toBe('/dashboard/orders/[id]')
    expect(getPageAccessContractByPath('/dashboard/customers/account-receipt')?.routePattern).toBe(
      '/dashboard/customers/account-receipt'
    )
  })
})

describe('platform inventories — nav vs contract parity (warn until allowlist clean)', () => {
  it.todo('flags navigation vs contract permission mismatches via reconcile script output')
})
