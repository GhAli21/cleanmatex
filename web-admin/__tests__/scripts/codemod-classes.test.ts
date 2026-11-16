const { transformSource, findRawClasses } = require('../../scripts/ui/codemod-classes.js') as {
  transformSource: (src: string) => { code: string; changed: number; unmapped: { token: string; line: number }[] }
  findRawClasses: (src: string) => { token: string; line: number }[]
}

const run = (cls: string) => transformSource(`<div className="${cls}" />`).code.slice(16, -4)

describe('codemod-classes: palette', () => {
  test.each([
    ['bg-white', 'bg-card'],
    ['bg-gray-50', 'bg-muted'],
    ['bg-slate-100', 'bg-muted'],
    ['text-gray-900', 'text-foreground'],
    ['text-slate-800', 'text-foreground'],
    ['text-gray-600', 'text-muted-foreground'],
    ['text-gray-400', 'text-muted-foreground'],
    ['border-gray-200', 'border-border'],
    ['border-slate-300', 'border-border'],
    ['ring-blue-500', 'ring-ring'],
    ['ring-cyan-500', 'ring-ring'],
    ['focus:border-blue-500', 'focus:border-ring'],
    ['text-blue-700', 'text-primary-text'],
    ['bg-blue-600', 'bg-primary'],
    ['bg-blue-50 border-blue-200', 'bg-info-bg border-info-border'],
    ['bg-green-50 text-green-800 border-green-200', 'bg-success-bg text-success-text border-success-border'],
    ['bg-red-100 text-red-700', 'bg-danger-bg text-danger-text'],
    ['bg-amber-50 text-yellow-800', 'bg-warning-bg text-warning-text'],
    ['bg-green-500', 'bg-success'],
    ['bg-red-500', 'bg-destructive'],
    ['placeholder-gray-400', 'placeholder:text-muted-foreground'],
  ])('%s -> %s', (from, to) => expect(run(from)).toBe(to))

  test('keeps variants, opacity and important', () => {
    expect(run('hover:bg-gray-50 md:text-gray-900 bg-red-50/50 !bg-white')).toBe(
      'hover:bg-muted md:text-foreground bg-danger-bg/50 !bg-card',
    )
  })

  test('blue text on a blue tint becomes info text', () => {
    expect(run('bg-blue-100 text-blue-800')).toBe('bg-info-bg text-info-text')
  })

  test('text-white only changes next to a primary or red fill', () => {
    expect(run('bg-blue-600 text-white')).toBe('bg-primary text-primary-foreground')
    expect(run('bg-red-600 text-white')).toBe('bg-destructive text-destructive-foreground')
    const r = transformSource('<div className="bg-indigo-500 text-white" />')
    expect(r.code).toBe('<div className="bg-indigo-500 text-white" />')
    expect(r.unmapped.map((u) => u.token)).toEqual(['bg-indigo-500', 'text-white'])
  })

  test('overlay black and dark: variants are left alone and reported', () => {
    const r = transformSource('const a = "bg-black/50 dark:bg-gray-800"')
    expect(r.code).toBe('const a = "bg-black/50 dark:bg-gray-800"')
    expect(r.unmapped.map((u) => u.token)).toEqual(['bg-black/50', 'dark:bg-gray-800'])
  })
})

describe('codemod-classes: direction', () => {
  test.each([
    ['ml-2 mr-4 pl-3 pr-1', 'ms-2 me-4 ps-3 pe-1'],
    ['-ml-px md:pl-4', '-ms-px md:ps-4'],
    ['left-0 right-2 rtl:left-auto', 'start-0 end-2 rtl:start-auto'],
    ['rounded-l-md rounded-r-none rounded-tl-lg', 'rounded-s-md rounded-e-none rounded-ss-lg'],
    ['border-l border-r-0 border-l-2', 'border-s border-e-0 border-s-2'],
    ['text-left sm:text-right', 'text-start sm:text-end'],
    ['float-left', 'float-start'],
  ])('%s -> %s', (from, to) => expect(run(from)).toBe(to))

  test('space-x stays (logical in Tailwind v4)', () => expect(run('space-x-2')).toBe('space-x-2'))

  test('an RTL ternary is reported, not flipped twice', () => {
    for (const src of [
      "cn(dir === 'rtl' ? 'pl-8' : 'pr-8')",
      '`${isRTL ? "mr-3" : "ml-3"}`',
      ['cn(', '  isRTL', "    ? 'left-0'", "    : 'right-0')"].join('\n'),
    ]) {
      const r = transformSource(src)
      expect(r.code).toBe(src)
      expect(r.unmapped).toHaveLength(2)
    }
  })
})

describe('codemod-classes: safety', () => {
  test('ignores text outside string literals and words that only look like classes', () => {
    const src = '// bg-white text-left\nconst t = "left-aligned pr-review"'
    expect(transformSource(src).code).toBe(src)
  })

  test('keeps CRLF and reports line numbers', () => {
    const r = transformSource('const a = 1\r\nconst b = "bg-teal-500"\r\nconst c = "bg-white"')
    expect(r.code).toBe('const a = 1\r\nconst b = "bg-teal-500"\r\nconst c = "bg-card"')
    expect(r.unmapped).toEqual([{ token: 'bg-teal-500', line: 2 }])
    expect(r.changed).toBe(1)
  })

  test('works inside template literals and cn() calls', () => {
    expect(transformSource('cn(`p-2 ${a ? "ml-2" : "bg-gray-100"}`, "text-right")').code).toBe(
      'cn(`p-2 ${a ? "ms-2" : "bg-muted"}`, "text-end")',
    )
  })

  test('findRawClasses lists what the guard rejects, allowing overlay black', () => {
    expect(findRawClasses('"bg-black/40 bg-white ml-2 text-foreground"').map((r) => r.token)).toEqual(['bg-white', 'ml-2'])
  })
})
