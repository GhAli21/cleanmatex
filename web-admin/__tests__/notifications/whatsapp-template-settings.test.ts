import { mergeTemplateBinding, templateFormValues, whatsappTemplateSchema } from '@features/notifications/model/whatsapp-template-settings'

const sid = 'HX0123456789abcdef0123456789abcdef'
const messages = { event: 'event', sid: 'sid', slot: 'slot', source: 'source', duplicate: 'duplicate' }

describe('WhatsApp template editor safety', () => {
  it('preserves unrelated provider options and sibling events when saving a binding', () => {
    const config = { from_phone: '+96812345678', content_templates: { 'order.ready': { content_sid: sid, content_variable_map: {} } } }
    const result = mergeTemplateBinding(config, { event: 'order.created', contentSid: sid, mappings: [{ slot: '1', kind: 'variable', source: 'order_number' }] })
    expect(result).toEqual({ from_phone: config.from_phone, content_templates: { ...config.content_templates, 'order.created': { content_sid: sid, content_variable_map: { '1': '$order_number' } } } })
    expect(config.content_templates).not.toHaveProperty('order.created')
  })

  it('removes only the selected binding and retains explicit template mode', () => {
    const result = mergeTemplateBinding({ other: true, content_templates: { 'order.created': {}, 'order.ready': {} } }, { event: 'order.created', remove: true })
    expect(result).toEqual({ other: true, content_templates: { 'order.ready': {} } })
  })

  it('does not overwrite malformed existing catalog data', () => {
    expect(() => mergeTemplateBinding({ content_templates: [] }, { event: 'order.created', remove: true })).toThrow()
  })

  it('loads named and numbered variables and leaves a new organization SID blank', () => {
    expect(templateFormValues('order.created', null).contentSid).toBe('')
    const values = templateFormValues('order.created', { content_templates: { 'order.created': { content_sid: sid, content_variable_map: { '1': '$order_number', label: 'Ready tomorrow' } } } })
    expect(values.mappings).toEqual([{ slot: '1', kind: 'variable', source: 'order_number' }, { slot: 'label', kind: 'literal', source: 'Ready tomorrow' }])
  })

  it('rejects invalid SIDs, duplicate variable names and ambiguous literal values', () => {
    const schema = whatsappTemplateSchema(messages)
    expect(schema.safeParse({ event: 'order.created', contentSid: 'AC123', mappings: [] }).success).toBe(false)
    expect(schema.safeParse({ event: 'order.created', contentSid: sid, mappings: [{ slot: '1', kind: 'variable', source: 'order_number' }, { slot: '1', kind: 'literal', source: '$ready' }] }).success).toBe(false)
    expect(schema.safeParse({ event: 'order.created', contentSid: sid, mappings: [{ slot: 'order_number', kind: 'variable', source: 'order_number' }] }).success).toBe(true)
  })
})
