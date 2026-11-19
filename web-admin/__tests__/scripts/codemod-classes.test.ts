const { transformSource, findRawClasses } = require('../../scripts/ui/codemod-classes.js') as {
  transformSource: (src: string) => { code: string; changed: number; unmapped: { token: string; line: number }[] }
  findRawClasses: (src: string) => { token: string; line: number }[]
}

const run = (cls: string) => transformSource(`<div className="${cls}" />`).code.slice(16, -4)
const code = (src: string) => transformSource(src).code

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

  test('text-white follows the fill it sits on', () => {
    expect(run('bg-blue-600 text-white')).toBe('bg-primary text-primary-foreground')
    expect(run('bg-red-600 text-white')).toBe('bg-destructive text-destructive-foreground')
    expect(run('bg-indigo-500 text-white')).toBe('bg-primary text-primary-foreground')
    expect(run('bg-slate-900 text-white hover:bg-slate-800')).toBe('bg-foreground text-background hover:bg-foreground/90')
    expect(run('bg-green-600 hover:bg-green-700 text-white')).toBe('bg-success hover:bg-success/90 text-on-solid')
    expect(run('bg-amber-500 text-white')).toBe('bg-warning text-warning-foreground')
    expect(run('bg-orange-600 hover:bg-orange-700 text-white')).toBe('bg-warning hover:bg-warning/90 text-warning-foreground')
    expect(run('bg-amber-50 text-white')).toBe('bg-warning-bg text-on-solid')
    expect(run('animate-spin h-4 w-4 text-white')).toBe('animate-spin h-4 w-4 text-on-solid')
    expect(run('text-white/80')).toBe('text-on-solid/80')
  })

  test('accent, status and neutral families are all decided', () => {
    expect(run('bg-purple-50 text-purple-700 border-purple-200')).toBe('bg-info-bg text-info-text border-info-border')
    expect(run('text-teal-600')).toBe('text-primary-text')
    expect(run('border-blue-500')).toBe('border-primary')
    expect(run('bg-sky-600 hover:bg-sky-700')).toBe('bg-primary hover:bg-primary-hover')
    expect(run('bg-cyan-300')).toBe('bg-info-border')
    expect(run('text-red-400 bg-lime-100')).toBe('text-danger-text bg-success-bg')
    expect(run('bg-blue-600 text-blue-100')).toBe('bg-primary text-primary-foreground/80')
    expect(run('bg-gray-300 bg-gray-500 bg-gray-800')).toBe('bg-border bg-muted-foreground bg-foreground')
    expect(run('text-gray-300 border-gray-400 border-gray-700')).toBe('text-muted-foreground border-muted-foreground border-foreground')
    expect(run('bg-gray-100 hover:bg-gray-200')).toBe('bg-muted hover:bg-border')
    expect(run('bg-green-50 hover:bg-green-100')).toBe('bg-success-bg hover:bg-success-border/50')
    expect(run('from-blue-400 to-blue-600')).toBe('from-primary/70 to-primary')
    expect(run('ring-slate-200 ring-offset-white')).toBe('ring-border ring-offset-background')
    expect(run('fill-gray-400 stroke-amber-500')).toBe('fill-muted-foreground stroke-warning')
    expect(run('decoration-sky-500')).toBe('decoration-primary')
    expect(run('border-l-4 border-l-blue-500 border-r-red-200')).toBe('border-s-4 border-s-primary border-e-danger-border')
  })

  test('a hover that maps to its own base class still shows a change', () => {
    expect(run('text-blue-600 hover:text-blue-700')).toBe('text-primary-text hover:text-primary-text/80')
    expect(run('text-gray-400 hover:text-gray-600')).toBe('text-muted-foreground hover:text-foreground')
    expect(run('bg-white hover:bg-white')).toBe('bg-card hover:bg-muted')
    expect(run('bg-gray-50 hover:bg-gray-100')).toBe('bg-muted hover:bg-border')
    expect(run('bg-blue-50 hover:bg-blue-50')).toBe('bg-info-bg hover:bg-info-border/50')
    expect(run('bg-blue-500 hover:bg-blue-600')).toBe('bg-primary hover:bg-primary-hover')
    expect(run('text-gray-900 hover:text-gray-800')).toBe('text-foreground hover:text-foreground/80')
    expect(run('text-gray-600 hover:text-gray-900')).toBe('text-muted-foreground hover:text-foreground')
  })

  test('gray 700 text stays strong; 600 and below is muted', () => {
    expect(run('text-gray-700 text-slate-600')).toBe('text-foreground text-muted-foreground')
  })

  test('Tailwind v3 *-opacity-N (gone in v4) folds into the colour; a modal backdrop becomes black', () => {
    expect(run('fixed inset-0 bg-gray-500 bg-opacity-75')).toBe('fixed inset-0 bg-black/75')
    expect(run('fixed inset-0 bg-black bg-opacity-50')).toBe('fixed inset-0 bg-black/50')
    expect(run('bg-blue-600 bg-opacity-20')).toBe('bg-primary/20')
    expect(run('border border-white border-opacity-20')).toBe('border border-on-solid/20')
    expect(run('border border-current border-opacity-20')).toBe('border border-current/20')
  })

  test('className leftovers become a plain string', () => {
    expect(code("<p className={'ms-3'} />")).toBe('<p className="ms-3" />')
    expect(code("<p className={`flex ${isRTL ? 'flex-row-reverse' : ''}`} />")).toBe('<p className="flex" />')
    expect(code('<p className={`a  ${x}`} />')).toBe('<p className={`a  ${x}`} />')
  })

  test('white surfaces: card, frosted card, or white on a fill', () => {
    expect(run('bg-white/80 backdrop-blur')).toBe('bg-card/80 backdrop-blur')
    expect(run('bg-white/20')).toBe('bg-on-solid/20')
    expect(run('border-white border-white/30')).toBe('border-card border-on-solid/30')
  })

  test('dark: palette classes are deleted; overlay black stays', () => {
    expect(run('bg-white dark:bg-gray-800 text-gray-900 dark:text-white')).toBe('bg-card text-foreground')
    expect(run('bg-black/50 dark:hidden')).toBe('bg-black/50 dark:hidden')
    expect(transformSource('"bg-black/50 to-black/60"').unmapped).toEqual([])
  })

  test('arbitrary --cmx token colours become the token class', () => {
    expect(run('text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))] border-[rgb(var(--cmx-border-rgb))]')).toBe(
      'text-muted-foreground border-border',
    )
  })
})

describe('codemod-classes: direction', () => {
  test.each([
    ['ml-2 mr-4 pl-3 pr-1', 'ms-2 me-4 ps-3 pe-1'],
    ['-ml-px md:pl-4', '-ms-px md:ps-4'],
    ['left-0 right-2', 'start-0 end-2'],
    ['rounded-l-md rounded-r-none rounded-tl-lg', 'rounded-s-md rounded-e-none rounded-ss-lg'],
    ['border-l border-r-0 border-l-2', 'border-s border-e-0 border-s-2'],
    ['border-r-transparent border-l-destructive', 'border-e-transparent border-s-destructive'],
    ['text-left sm:text-right', 'text-start sm:text-end'],
    ['float-left', 'float-start'],
  ])('%s -> %s', (from, to) => expect(run(from)).toBe(to))

  test('space-x stays (logical in Tailwind v4)', () => expect(run('space-x-2')).toBe('space-x-2'))

  test('rtl:/ltr: direction classes become logical without mirroring twice', () => {
    expect(run('text-left rtl:text-right')).toBe('text-start')
    expect(run('ml-2 rtl:ml-0 rtl:mr-2')).toBe('ms-2')
    expect(run('rtl:left-4')).toBe('rtl:end-4')
    expect(run('ltr:pr-1')).toBe('ltr:pe-1')
    expect(run('h-4 ltr:mr-2 rtl:ml-2')).toBe('h-4 me-2')
    expect(run('rounded-l-md rtl:rounded-l-none rtl:rounded-r-md')).toBe('rounded-s-md')
    expect(run('mb-2 rtl:text-right')).toBe('mb-2')
    expect(run('absolute right-2 rtl:left-2 rtl:right-auto')).toBe('absolute end-2')
    expect(run('text-center rtl:text-right')).toBe('text-center rtl:text-start')
  })

  test('rtl: row reversal is dropped (the page dir already mirrors rows)', () => {
    expect(run('flex gap-3 rtl:flex-row-reverse')).toBe('flex gap-3')
    expect(run('flex sm:flex-row rtl:sm:flex-row-reverse')).toBe('flex sm:flex-row')
    expect(run('space-x-2 rtl:space-x-reverse')).toBe('space-x-2')
    expect(run('divide-x rtl:divide-x-reverse')).toBe('divide-x')
    expect(run('flex flex-col rtl:flex-col-reverse')).toBe('flex flex-col rtl:flex-col-reverse')
  })
})

describe('codemod-classes: isRTL ternaries', () => {
  test.each([
    ["`a ${isRTL ? 'text-right' : 'text-left'}`", '`a text-start`'],
    ["className={isRTL ? 'text-right' : 'text-left'}", 'className="text-start"'],
    ["`flex ${isRTL ? 'flex-row-reverse' : ''}`", '`flex `'],
    ["cn('x', isRTL ? 'ml-2' : 'mr-2')", "cn('x', 'me-2')"],
    ["`${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`", '`justify-between`'],
    ["`${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-2' : 'justify-end space-x-2'}`", '`justify-end space-x-2`'],
    ["`${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'}`", '`border-s-4 border-e-0`'],
    ["`${isRTL ? 'items-end' : 'items-start'}`", '`items-start`'],
    ["`${isRTL ? 'text-right' : 'text-center'}`", '`text-center`'],
    ["`${isRTL ? 'ml-1 rotate-180' : 'mr-1'}`", '`me-1 rtl:rotate-180`'],
    ["`${isRTL ? 'rotate-180' : ''}`", '`rtl:rotate-180`'],
    ["`grid ${isRTL ? 'sm:[direction:rtl]' : ''}`", '`grid `'],
    ["`space-y-2 ${isRTL ? 'space-y-reverse' : ''}`", '`space-y-2 `'],
    ["`${isRtl ? 'text-right' : 'text-left'}`", '`text-start`'],
    ["`${!isRTL ? 'text-left' : 'text-right'}`", '`text-start`'],
    ["return isRTL() ? 'text-right' : 'text-left'", "return 'text-start'"],
    ['`${isRTL\n  ? "pl-8"\n  : "pr-8"}`', '`pe-8`'],
    ["className={isRtl ? 'text-right' : undefined}", 'className={undefined}'],
    ["className={!isRtl ? 'pe-2 text-left' : null}", 'className="pe-2 text-start"'],
    ["className={isRtl ? 'pe-2 text-right' : null}", 'className={null}'],
  ])('%s -> %s', (from, to) => expect(code(from)).toBe(to))

  test.each([
    "dir={isRTL ? 'rtl' : 'ltr'}",
    "isRTL ? 'ar' : 'en'",
    "isRTL ? '←' : '→'",
    "`${!isRTL ? 'uppercase tracking-[0.14em]' : ''}`",
    "side={isRTL ? 'right' : 'left'}",
  ])('leaves a non-direction ternary alone: %s', (src) => expect(code(src)).toBe(src))

  test('does not cut into a wider condition', () => {
    const src = "const c = open || isRTL ? 'ml-2' : 'mr-2'"
    expect(code(src)).toBe(src)
  })

  test('isRTL && class', () => {
    expect(code("cn('a', isRTL && 'flex-row-reverse')")).toBe("cn('a')")
    expect(code("cn('a', isRTL && 'flex-row-reverse', className)")).toBe("cn('a', className)")
    expect(code("const x = isRTL && 'flex-row-reverse'")).toBe('const x = false')
    expect(code("`a ${isRTL && 'flex-row-reverse text-right'}`")).toBe('`a `')
    expect(code("cn(isRTL && 'rotate-180')")).toBe("cn('rtl:rotate-180')")
    expect(code("cn(isRTL && 'rtl')")).toBe("cn(isRTL && 'rtl')")
  })

  test('physical align values', () => {
    expect(code("<CmxCopyableCell value={v} align={isRTL ? 'right' : 'left'} />")).toBe('<CmxCopyableCell value={v} />')
    expect(code("style={{ textAlign: isRtl ? 'right' : 'left' }}")).toBe("style={{ textAlign: 'start' }}")
    expect(code("const textAlign = isRtl ? 'right' : 'left';")).toBe("const textAlign = isRtl ? 'right' : 'left';")
    const multi = [
      '<CmxCopyableCell',
      '  value={String((o as Record<string, unknown>).points ?? 0)}',
      "  align={isRTL ? 'right' : 'left'}",
      '/>',
    ].join('\n')
    expect(code(multi)).toBe(multi.replace("\n  align={isRTL ? 'right' : 'left'}", ''))
    const other = "<CmxCopyableCell value={v} />\n<Popover align={isRTL ? 'right' : 'left'} />"
    expect(code(other)).toBe(other)
  })

  test('removes isRTL, useRTL and locale once unused', () => {
    const src = [
      "import { useLocale } from 'next-intl'",
      "import { useRTL, useX } from '@/lib/hooks/use-rtl'",
      'function A() {',
      '  const locale = useLocale()',
      "  const isRtl = locale === 'ar'",
      "  return <p className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`} />",
      '}',
      'function B() {',
      '  const isRTL = useRTL()',
      "  return <p className={isRTL ? 'ml-2' : 'mr-2'} />",
      '}',
    ].join('\n')
    expect(code(src)).toBe(
      [
        "import { useX } from '@/lib/hooks/use-rtl'",
        'function A() {',
        '  return <p className="p-2 text-start" />',
        '}',
        'function B() {',
        '  return <p className="me-2" />',
        '}',
      ].join('\n'),
    )
  })

  test('keeps isRTL when it is still used', () => {
    const src = "const isRTL = useRTL()\nconst a = isRTL ? '←' : '→'\nconst b = isRTL ? 'ml-2' : 'mr-2'"
    expect(code(src)).toBe("const isRTL = useRTL()\nconst a = isRTL ? '←' : '→'\nconst b = 'me-2'")
  })
})

describe('codemod-classes: safety', () => {
  test('ignores text outside string literals and words that only look like classes', () => {
    const src = '// bg-white text-left\nconst t = "left-aligned pr-review"'
    expect(code(src)).toBe(src)
  })

  test('keeps CRLF and reports line numbers', () => {
    const r = transformSource('const a = 1\r\nconst b = "ml-[3px]x"\r\nconst c = "bg-white"')
    expect(r.code).toBe('const a = 1\r\nconst b = "ml-[3px]x"\r\nconst c = "bg-card"')
    expect(r.changed).toBe(1)
    expect(code("const isRTL = useRTL()\r\nconst b = isRTL ? 'ml-2' : 'mr-2'\r\n")).toBe("const b = 'me-2'\r\n")
  })

  test('works inside template literals and cn() calls', () => {
    expect(code('cn(`p-2 ${a ? "ml-2" : "bg-gray-100"}`, "text-right")')).toBe('cn(`p-2 ${a ? "ms-2" : "bg-muted"}`, "text-end")')
  })

  test('findRawClasses lists what the guard rejects, allowing overlay black', () => {
    expect(findRawClasses('"bg-black/40 bg-white ml-2 text-foreground"').map((r) => r.token)).toEqual(['bg-white', 'ml-2'])
  })
})
