/** VAT return boxes: lines fill LINES boxes, totals add boxes with signs, nothing is counted silently. */
import { computeTaxReturn, type ReturnBoxDef, type ReturnBoxSource, type ReturnLineGroup } from '@/lib/tax/tax-return';

const box = (box_code: string, box_kind: string, display_order: number): ReturnBoxDef => ({
  box_code, box_kind, display_order, section_code: 'SALES', shows_amount: true, shows_tax: true, name: box_code, name2: null, is_verified: false,
});
const lines = (box_code: string, flow: string, category: string | null, rc: boolean | null, measure: string, emirate: string | null = null): ReturnBoxSource => ({
  box_code, source_kind: 'LINES', tax_flow_code: flow, tax_category_code: category, is_reverse_charge: rc, emirate_code: emirate,
  tax_measure: measure, source_box_code: null, sign: 1,
});
const from = (box_code: string, src: string, sign = 1): ReturnBoxSource => ({
  box_code, source_kind: 'BOX', tax_flow_code: null, tax_category_code: null, is_reverse_charge: null, emirate_code: null,
  tax_measure: null, source_box_code: src, sign,
});
const group = (flow: string, category: string, rc: boolean, taxable: string, tax: string, recoverable: string, emirate: string | null = null): ReturnLineGroup => ({
  tax_flow_code: flow, tax_category_code: category, is_reverse_charge: rc, emirate_code: emirate, taxable, tax, recoverable, line_count: 1,
});

const BOXES = [box('S1', 'LINES', 10), box('P1', 'LINES', 20), box('N1', 'LINES', 30), box('NET', 'TOTAL', 40), box('X', 'MANUAL', 50)];
const SOURCES = [
  lines('S1', 'OUTPUT', 'STANDARD', false, 'TAX'),
  lines('P1', 'INPUT', 'STANDARD', null, 'RECOVERABLE'),
  lines('N1', 'INPUT', 'STANDARD', true, 'TAX'),
  from('NET', 'S1'), from('NET', 'N1'), from('NET', 'P1', -1),
];

describe('computeTaxReturn', () => {
  const groups = [
    group('OUTPUT', 'STANDARD', false, '1000.000', '50.000', '0'),
    group('OUTPUT', 'STANDARD', false, '-100.000', '-5.000', '0'), // a credit note nets the sales
    group('INPUT', 'STANDARD', false, '200.000', '10.000', '10.000'),
    group('INPUT', 'STANDARD', true, '300.000', '15.000', '15.000'),
    group('WITHHOLDING', 'STANDARD', false, '400.000', '20.000', '0'),
  ];
  const { boxes, notOnReturn } = computeTaxReturn(BOXES, SOURCES, groups);
  const get = (c: string) => boxes.find((b) => b.box_code === c)!;

  it('sums matching lines, credit notes included', () => {
    expect(get('S1').amount.toFixed(3)).toBe('900.000');
    expect(get('S1').tax.toFixed(3)).toBe('45.000');
  });

  it('input boxes take the recoverable tax', () => {
    expect(get('P1').tax.toFixed(3)).toBe('25.000');
  });

  it('net = sales + reverse-charge due − recoverable', () => {
    expect(get('NET').tax.toFixed(3)).toBe('35.000');
  });

  it('manual boxes stay zero and lines no box takes are listed', () => {
    expect(get('X').tax.isZero()).toBe(true);
    expect(notOnReturn.map((g) => g.tax_flow_code)).toEqual(['WITHHOLDING']);
  });

  it('filters by emirate', () => {
    const r = computeTaxReturn([box('1b', 'LINES', 1)], [lines('1b', 'OUTPUT', 'STANDARD', false, 'TAX', 'DU')], [
      group('OUTPUT', 'STANDARD', false, '100', '5', '0', 'DU'),
      group('OUTPUT', 'STANDARD', false, '100', '5', '0', null),
    ]);
    expect(r.boxes[0].tax.toFixed(2)).toBe('5.00');
    expect(r.notOnReturn).toHaveLength(1);
  });
});
