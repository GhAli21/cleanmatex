#!/usr/bin/env node
/**
 * Restore Prisma-legal bits that `prisma db pull` always strips.
 *
 * Always:
 *   @@ignore on model cmx_effective_permissions
 *   @ignore on cmx_effective_permissions[] back-relations
 *     (expression unique is not Prisma-usable)
 *
 * Safety net until 0553 is applied everywhere:
 *   1:1 unique column order must match @relation(fields)
 *   nameless funding 1:1 unique only when the mapped unique is absent
 *
 * Usage: node scripts/prisma-patch-after-pull.mjs
 * Wired: npm run prisma:pull
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma')

if (!fs.existsSync(schemaPath)) {
  console.error(`prisma-patch-after-pull: missing ${schemaPath}`)
  process.exit(1)
}

const original = fs.readFileSync(schemaPath, 'utf8')
let next = original
const applied = []

const fieldLine =
  /^([ \t]*)cmx_effective_permissions([ \t]+)cmx_effective_permissions\[\](.*)$/

next = next
  .split('\n')
  .map((line) => {
    const match = line.match(fieldLine)
    if (!match) return line

    const indent = match[1]
    const mid = match[2]
    let rest = match[3] ?? ''
    const ignoreCount = (rest.match(/@ignore\b/g) ?? []).length

    if (ignoreCount === 1) return line

    if (ignoreCount > 1) {
      rest = rest.replace(/([ \t]*@ignore\b)+/g, ' @ignore')
      applied.push('dedupe cmx_effective_permissions[] @ignore')
      return `${indent}cmx_effective_permissions${mid}cmx_effective_permissions[]${rest}`.replace(
        /[ \t]+$/g,
        '',
      )
    }

    applied.push('cmx_effective_permissions[] @ignore')
    return `${indent}cmx_effective_permissions${mid}cmx_effective_permissions[] @ignore${rest}`.replace(
      /[ \t]+$/g,
      '',
    )
  })
  .join('\n')

const modelStart = next.indexOf('model cmx_effective_permissions {')
if (modelStart >= 0) {
  const modelEnd = next.indexOf('\n}', modelStart)
  if (modelEnd >= 0) {
    const block = next.slice(modelStart, modelEnd)
    const ignoreHits = block.match(/^[ \t]*@@ignore\b/gm) ?? []
    if (ignoreHits.length === 0) {
      const withSchema = /([ \t]*@@schema\()/
      if (withSchema.test(block)) {
        const patchedBlock = block.replace(withSchema, '  @@ignore\n$1')
        next = next.slice(0, modelStart) + patchedBlock + next.slice(modelEnd)
      } else {
        next = `${next.slice(0, modelEnd)}\n  @@ignore${next.slice(modelEnd)}`
      }
      applied.push('cmx_effective_permissions @@ignore')
    } else if (ignoreHits.length > 1) {
      let seen = false
      const patchedBlock = block
        .split('\n')
        .filter((line) => {
          if (!/^[ \t]*@@ignore\b/.test(line)) return true
          if (seen) return false
          seen = true
          return true
        })
        .join('\n')
      next = next.slice(0, modelStart) + patchedBlock + next.slice(modelEnd)
      applied.push('dedupe cmx_effective_permissions @@ignore')
    }
  }
}

const uniquePatches = [
  {
    from: '@@unique([tenant_org_id, account_id], map: "uq_ofba_acct")',
    to: '@@unique([account_id, tenant_org_id], map: "uq_ofba_acct")',
    label: 'uq_ofba_acct field order',
  },
  {
    from: '@@unique([tenant_org_id, posting_log_id], map: "uq_ofps_log")',
    to: '@@unique([posting_log_id, tenant_org_id], map: "uq_ofps_log")',
    label: 'uq_ofps_log field order',
  },
]

for (const patch of uniquePatches) {
  if (next.includes(patch.from)) {
    next = next.replace(patch.from, patch.to)
    applied.push(patch.label)
  }
}

const mappedFundingUnique =
  '@@unique([fin_voucher_trx_line_id, tenant_org_id], map: "uq_svft_vch_line_tenant")'
const namelessFundingLine = /^[ \t]*@@unique\(\[fin_voucher_trx_line_id, tenant_org_id\]\)[ \t]*\r?$/m
const namelessFundingBlock = /^[ \t]*@@unique\(\[fin_voucher_trx_line_id, tenant_org_id\]\)[ \t]*\r?\n/gm
const fundingAnchor = '@@unique([tenant_org_id, idempotency_key], map: "uq_svft_idem")'

if (next.includes(mappedFundingUnique)) {
  const cleaned = next.replace(namelessFundingBlock, '')
  if (cleaned !== next) {
    next = cleaned
    applied.push('remove duplicate nameless uq_svft composite unique')
  }
} else if (!namelessFundingLine.test(next) && next.includes(fundingAnchor)) {
  next = next.replace(
    fundingAnchor,
    `${fundingAnchor}\n  @@unique([fin_voucher_trx_line_id, tenant_org_id])`,
  )
  applied.push('uq_svft composite 1:1 unique')
}

if (next === original) {
  console.log('prisma-patch-after-pull: schema already patched')
  process.exit(0)
}

fs.writeFileSync(schemaPath, next, 'utf8')
console.log(`prisma-patch-after-pull: applied ${applied.join(', ')}`)
