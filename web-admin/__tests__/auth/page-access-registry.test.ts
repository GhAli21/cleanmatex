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
          .replace(/\/page\.tsx$/, '')
          .replace(/\\/g, '/')

        routes.push(route || '/')
      }
    }
  }

  walk(path.join(baseDir, 'app', 'dashboard'))

  return routes
}

describe('page access registry coverage', () => {
  it('covers every dashboard page route with a contract', () => {
    const baseDir = process.cwd()
    const pageRoutes = collectPageRoutes(baseDir)
      .map((route) => route.startsWith('/dashboard') ? route : `/dashboard${route}`)
      .sort()

    const missingRoutes = pageRoutes.filter((route) => !getPageAccessContractByPath(route))

    expect(missingRoutes).toEqual([])
  })

  it('registers the same number of unique route patterns as page routes', () => {
    const baseDir = process.cwd()
    const pageRoutes = collectPageRoutes(baseDir)
    const uniquePatterns = new Set(getAllPageAccessContracts().map((contract) => contract.routePattern))

    expect(uniquePatterns.size).toBe(pageRoutes.length)
  })

  it('resolves representative dynamic routes', () => {
    expect(getPageAccessContractByPath('/dashboard/orders/123')?.routePattern).toBe('/dashboard/orders/[id]')
    expect(getPageAccessContractByPath('/dashboard/users/abc')?.routePattern).toBe('/dashboard/users/[userId]')
    expect(getPageAccessContractByPath('/dashboard/ready/1/print/thermal')?.routePattern).toBe(
      '/dashboard/ready/[id]/print/[type]'
    )
  })
})
