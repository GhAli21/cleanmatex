const { scanSource } = require('../../scripts/ui/check-design-system.js') as {
  scanSource: (src: string, file: string) => { rule: string; line: number; level: 'error' | 'warn' }[]
}

const FEATURE = 'src/features/x/ui/x-screen.tsx'
const rules = (src: string, file = FEATURE) => scanSource(src, file).map((f) => f.rule)

describe('check-design-system', () => {
  test.each([
    ['<button onClick={go}>', 'UI001'],
    ['<input value={v} />', 'UI001'],
    ['<select>', 'UI001'],
    ['<label htmlFor="a">', 'UI001'],
    ['<table className="w-full">', 'UI001'],
    ["alert('saved')", 'UI002'],
    ['window.confirm(msg)', 'UI002'],
    ["showSuccessToast('ok')", 'UI002'],
    ["const c = '#10b981'", 'UI003'],
    ['<div className="dark:bg-card" />', 'UI004'],
    ['<div className="z-[9999]" />', 'UI005'],
    ['<div className="bg-[#fff]" />', 'UI006'],
    ['<div className="text-[rgb(1,2,3)]" />', 'UI006'],
    ['const [pageSize, setPageSize] = useState(20)', 'UI007'],
  ])('%s -> %s', (src, rule) => {
    expect(rules(src)).toContain(rule)
  })

  test('clean token code passes', () => {
    expect(rules('<CmxButton className="bg-primary text-primary-foreground ms-2 z-50" />')).toEqual([])
    expect(rules('<div className="bg-[rgb(var(--cmx-primary-rgb))]" />')).toEqual([])
    expect(rules('const [pageSize, setPageSize] = useState(CMX_DEFAULT_PAGE_SIZE)')).toEqual([])
    expect(rules('<div className="sticky z-[1]" />')).toEqual([])
    expect(rules('<div className="z-[60]" />')).toContain('UI005')
    expect(rules("import { toast } from 'sonner'", 'src/ui/feedback/methods/toast-method.ts')).toEqual([])
  })

  test('src/ui may build raw elements and use hex; features may not', () => {
    expect(rules('<button type="button">', 'src/ui/primitives/cmx-button.tsx')).toEqual([])
    expect(rules("const c = '#fff'", 'src/ui/forms/cmx-hex-color-field.tsx')).toEqual([])
  })

  test('print and report files may use <table>', () => {
    expect(rules('<table>', 'src/features/orders/ui/orders-print-rprt.tsx')).toEqual([])
    expect(rules('<table>', 'app/dashboard/ready/[id]/print/[type]/page.tsx')).toEqual([])
    expect(rules('<button>', 'src/features/orders/ui/orders-print-rprt.tsx')).toContain('UI001')
  })

  test('ignore comment on the same or previous line, with a reason', () => {
    expect(rules('<input type="file" hidden /> {/* cmx-ds-ignore UI001: native file picker */}')).toEqual([])
    expect(rules('// cmx-ds-ignore UI003: garment colour from the DB\nconst c = "#ff0000"')).toEqual([])
    expect(rules('// cmx-ds-ignore UI001\n<input />')).toContain('UI001')
  })

  test('comments are not scanned', () => {
    expect(rules("// was '#10b981' before")).toEqual([])
  })

  test('English JSX text is a warning, not an error', () => {
    const found = scanSource('<p>Save changes</p>', FEATURE)
    expect(found).toEqual([expect.objectContaining({ rule: 'UI008', level: 'warn' })])
    expect(rules('<p>{t("save")}</p>')).toEqual([])
  })
})
