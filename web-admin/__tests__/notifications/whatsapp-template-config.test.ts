import {
  hasTwilioProductionTemplates,
  isTwilioProductionTemplateProvider,
  resolveTwilioProductionTemplate,
  validateTwilioProductionTemplateConfig,
} from '@lib/notifications/adapters/whatsapp-template-config'

const createdSid = `HX${'1'.repeat(32)}`
const readySid = `HX${'2'.repeat(32)}`
const row = {
  event_code: 'order.created',
  metadata: { variables: { order_number: 'ORD-001', estimated_ready_at: '3 October 2026' } },
}
const config = {
  content_templates: {
    'order.created': {
      content_sid: createdSid,
      content_variable_map: { order_number: '$order_number', estimated_ready_at: '$estimated_ready_at' },
    },
    'order.ready': {
      content_sid: readySid,
      content_variable_map: { order_number: '$order_number', location: 'Main Branch' },
    },
  },
}

describe('Twilio production template configuration', () => {
  it('resolves each event independently with only its configured variables', () => {
    expect(resolveTwilioProductionTemplate(row, config)).toEqual({
      contentSid: createdSid,
      contentVariables: { order_number: 'ORD-001', estimated_ready_at: '3 October 2026' },
    })
    expect(resolveTwilioProductionTemplate({ ...row, event_code: 'order.ready' }, config)).toEqual({
      contentSid: readySid,
      contentVariables: { order_number: 'ORD-001', location: 'Main Branch' },
    })
  })

  it('leaves providers without a catalog in legacy mode', () => {
    expect(resolveTwilioProductionTemplate(row, { sandbox_content_sid: createdSid })).toBeNull()
    expect(hasTwilioProductionTemplates()).toBe(false)
    expect(isTwilioProductionTemplateProvider('META_WHATSAPP', config)).toBe(false)
    expect(isTwilioProductionTemplateProvider('TWILIO_WHATSAPP', config)).toBe(true)
  })

  it.each([null, [], 'invalid', 1])('fails closed for malformed catalog %p', (catalog) => {
    expect(hasTwilioProductionTemplates({ content_templates: catalog })).toBe(true)
    expect(resolveTwilioProductionTemplate(row, { content_templates: catalog })).toEqual({
      errorMessage: expect.stringContaining('content_templates must be an object'),
    })
  })

  it.each(['payment.received', null])('fails for an unmapped event %p', (event_code) => {
    expect(resolveTwilioProductionTemplate({ ...row, event_code }, config)).toEqual({
      errorMessage: expect.stringContaining('No Twilio content_templates entry'),
    })
  })

  it.each([
    { content_sid: 'HXinvalid', content_variable_map: {} },
    { content_sid: createdSid },
    { content_sid: createdSid, content_variable_map: [] },
    { content_sid: createdSid, content_variable_map: { order_number: 1 } },
    { content_sid: createdSid, content_variable_map: { '': 'value' } },
  ])('rejects invalid entry %p', (entry) => {
    expect(resolveTwilioProductionTemplate(row, { content_templates: { 'order.created': entry } })).toEqual({
      errorMessage: expect.any(String),
    })
  })

  it.each([undefined, '', ' \n ', 42])('fails for missing or invalid dynamic value %p without event fallback', (value) => {
    expect(resolveTwilioProductionTemplate({
      ...row,
      metadata: { variables: { order_number: value, estimated_ready_at: '3 October 2026' } },
    }, config)).toEqual({ errorMessage: expect.stringContaining('metadata.variables.order_number') })
  })

  it('allows an explicitly static template and sanitizes populated variables', () => {
    expect(resolveTwilioProductionTemplate(row, {
      content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: {} } },
    })).toEqual({ contentSid: createdSid, contentVariables: {} })
    expect(resolveTwilioProductionTemplate({ ...row, metadata: { variables: { order_number: ' ORD-001\n' } } }, {
      content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: { number: '$order_number' } } },
    })).toEqual({ contentSid: createdSid, contentVariables: { number: 'ORD-001' } })
  })
})

describe('Twilio template configuration before provider activation', () => {
  it('accepts valid two-event catalogs and unchanged legacy config', () => {
    expect(validateTwilioProductionTemplateConfig(config)).toBeNull()
    expect(validateTwilioProductionTemplateConfig({ use_sandbox_template: false })).toBeNull()
    expect(validateTwilioProductionTemplateConfig({ content_templates: {} })).toBeNull()
  })

  it.each([null, [], 'invalid', 42])('rejects invalid provider JSON %p before activation', (value) => {
    expect(validateTwilioProductionTemplateConfig(value)).toEqual(expect.any(String))
  })

  it.each([
    { content_templates: null },
    { content_templates: { 'order.created': null } },
    { content_templates: { '': { content_sid: createdSid, content_variable_map: {} } } },
    { content_templates: { 'order.created': { content_sid: 'SM111', content_variable_map: {} } } },
    { content_templates: { 'order.created': { content_sid: createdSid } } },
    { content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: { number: 1 } } } },
    { content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: { number: '' } } } },
    { content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: { number: '$' } } } },
    { content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: { 'bad slot': '$order_number' } } } },
  ])('rejects unsafe catalog shape %p', (value) => {
    expect(validateTwilioProductionTemplateConfig(value)).toEqual(expect.any(String))
  })

  it('enforces the 100-variable provider limit', () => {
    const map = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`slot${index}`, 'value']))
    expect(validateTwilioProductionTemplateConfig({
      content_templates: { 'order.created': { content_sid: createdSid, content_variable_map: map } },
    })).toEqual(expect.stringContaining('at most 100 entries'))
  })
})
