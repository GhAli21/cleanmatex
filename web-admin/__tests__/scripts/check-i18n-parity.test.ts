import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const {
  validateLocaleCatalogs,
} = require('../../scripts/check-i18n-parity.js') as {
  validateLocaleCatalogs: (messagesDir: string) => {
    errors: string[];
    warnings: string[];
  };
}

describe('check-i18n-parity', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cmx-i18n-validator-'))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('passes when the locale trees and placeholders are aligned', async () => {
    await fs.mkdir(path.join(tempRoot, 'en', 'orders'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'ar', 'orders'), { recursive: true })

    const englishCommon = JSON.stringify({ save: 'Save {name}' }, null, 2)
    const arabicCommon = JSON.stringify({ save: 'حفظ {name}' }, null, 2)
    const englishDetail = JSON.stringify({ title: 'Order detail' }, null, 2)
    const arabicDetail = JSON.stringify({ title: 'تفاصيل الطلب' }, null, 2)

    await fs.writeFile(path.join(tempRoot, 'en', 'common.json'), englishCommon)
    await fs.writeFile(path.join(tempRoot, 'ar', 'common.json'), arabicCommon)
    await fs.writeFile(path.join(tempRoot, 'en', 'orders', 'detail.json'), englishDetail)
    await fs.writeFile(path.join(tempRoot, 'ar', 'orders', 'detail.json'), arabicDetail)

    expect(validateLocaleCatalogs(tempRoot)).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('fails when placeholder parity breaks between locales', async () => {
    await fs.mkdir(path.join(tempRoot, 'en'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'ar'), { recursive: true })

    await fs.writeFile(
      path.join(tempRoot, 'en', 'common.json'),
      JSON.stringify({ save: 'Save {name}' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'ar', 'common.json'),
      JSON.stringify({ save: 'حفظ' }, null, 2)
    )

    const { errors } = validateLocaleCatalogs(tempRoot)

    expect(errors).toEqual(
      expect.arrayContaining([
        'Placeholder mismatch for "common.save": en=["name"] ar=[]',
      ])
    )
  })

  it('fails when a namespace is both a file and a folder', async () => {
    await fs.mkdir(path.join(tempRoot, 'en', 'orders'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'ar', 'orders'), { recursive: true })

    await fs.writeFile(
      path.join(tempRoot, 'en', 'orders.json'),
      JSON.stringify({ title: 'Orders' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'en', 'orders', 'detail.json'),
      JSON.stringify({ title: 'Order detail' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'ar', 'orders.json'),
      JSON.stringify({ title: 'الطلبات' }, null, 2)
    )
    await fs.writeFile(
      path.join(tempRoot, 'ar', 'orders', 'detail.json'),
      JSON.stringify({ title: 'تفاصيل الطلب' }, null, 2)
    )

    const { errors } = validateLocaleCatalogs(tempRoot)

    expect(errors).toEqual(
      expect.arrayContaining([
        'Namespace collision detected. A namespace cannot be both a file and a folder: orders',
      ])
    )
  })
})
