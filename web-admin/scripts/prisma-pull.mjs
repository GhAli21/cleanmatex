#!/usr/bin/env node
/**
 * Full Prisma introspect: db pull → post-pull patch → validate.
 *
 * If validate still fails after the patch: STOP. Print the errors and
 * the next-step policy. Do not retry this script in a loop.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function spawnPrisma(args, { inherit } = { inherit: false }) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : undefined,
    shell: process.platform === 'win32',
    env: process.env,
  })

  if (result.error) {
    console.error(`prisma-pull: failed to start npx prisma ${args.join(' ')}: ${result.error.message}`)
    return { ok: false, status: 1, result }
  }
  if (result.signal) {
    console.error(`prisma-pull: npx prisma ${args.join(' ')} killed by ${result.signal}`)
    return { ok: false, status: 1, result }
  }

  const status = result.status ?? 1
  return { ok: status === 0, status, result }
}

const pulled = spawnPrisma(['db', 'pull'], { inherit: true })
if (!pulled.ok) {
  console.error('prisma-pull: db pull failed. Stop. Do not run the post-pull patch on a failed pull.')
  process.exit(pulled.status)
}

const patched = spawnSync(process.execPath, ['scripts/prisma-patch-after-pull.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
  env: process.env,
})
if (patched.error) {
  console.error(`prisma-pull: failed to start post-pull patch: ${patched.error.message}`)
  process.exit(1)
}
if ((patched.status ?? 1) !== 0) {
  console.error('prisma-pull: post-pull patch failed. Stop.')
  process.exit(patched.status ?? 1)
}

const validated = spawnPrisma(['validate'], { inherit: false })
if (validated.result.stdout) process.stdout.write(validated.result.stdout)
if (validated.result.stderr) process.stderr.write(validated.result.stderr)

if (validated.ok) {
  process.exit(0)
}

console.error(`
prisma-pull: schema is still invalid AFTER the post-pull patch.

STOP.
- Do not run npm run prisma:pull again in a loop.
- Do not flip org_asm_tasks_mst / org_pck_packing_lists_mst on org_orders_mst from ? to [].
- Do not make tenant_org_id optional to silence SetNull warnings.
- Do not apply database migrations.

Report the validate errors to the user. Typical leftovers:
- A new ignored view/table (not cmx_effective_permissions) → extend prisma-patch-after-pull.mjs
- New 1:1 unique/FK column-order mismatch → new SQL migration (Prisma-safe FK rule), then ask the user to apply it
- SetNull warnings only → not a failure; if validate printed P1012, that is the real error
`)
process.exit(validated.status)
