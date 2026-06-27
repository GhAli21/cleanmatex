import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadLocaleMessages } from '@/lib/i18n/load-locale-messages'

describe('loadLocaleMessages', () => {
  const originalCwd = process.cwd()
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cmx-i18n-loader-'))
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('loads a split locale catalog into the expected merged tree', async () => {
    await fs.mkdir(path.join(tempRoot, 'messages', 'en', 'orders'), { recursive: true })
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en', 'common.json'),
      JSON.stringify({ save: 'Save' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en', 'orders', 'detail.json'),
      JSON.stringify({ title: 'Order detail' }, null, 2)
    )

    process.chdir(tempRoot)

    await expect(loadLocaleMessages('en')).resolves.toEqual({
      common: { save: 'Save' },
      orders: {
        detail: {
          title: 'Order detail',
        },
      },
    })
  })

  it('merges index.json into the folder namespace root', async () => {
    await fs.mkdir(path.join(tempRoot, 'messages', 'en', 'orders'), { recursive: true })
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en', 'orders', 'index.json'),
      JSON.stringify({ title: 'Orders', search: 'Search orders' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en', 'orders', 'detail.json'),
      JSON.stringify({ title: 'Order detail' }, null, 2)
    )

    process.chdir(tempRoot)

    await expect(loadLocaleMessages('en')).resolves.toEqual({
      orders: {
        title: 'Orders',
        search: 'Search orders',
        detail: {
          title: 'Order detail',
        },
      },
    })
  })

  it('falls back to the legacy monolith file when the split catalog is absent', async () => {
    await fs.mkdir(path.join(tempRoot, 'messages'), { recursive: true })
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en.json'),
      JSON.stringify({ common: { cancel: 'Cancel' } }, null, 2)
    )

    process.chdir(tempRoot)

    await expect(loadLocaleMessages('en')).resolves.toEqual({
      common: { cancel: 'Cancel' },
    })
  })

  it('falls back to the default locale when an unsupported locale is requested', async () => {
    await fs.mkdir(path.join(tempRoot, 'messages', 'en'), { recursive: true })
    await fs.writeFile(
      path.join(tempRoot, 'messages', 'en', 'common.json'),
      JSON.stringify({ loading: 'Loading' }, null, 2)
    )

    process.chdir(tempRoot)

    await expect(loadLocaleMessages('fr')).resolves.toEqual({
      common: { loading: 'Loading' },
    })
  })
})
