/**
 * WhatsAppTemplateEditor stories cover named, numbered, fixed-text, activation,
 * pending, validation, interactive-save, and Arabic RTL states without live API calls.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WhatsAppTemplateEditor } from '@features/notifications/ui/whatsapp-template-settings'
import type { NotificationProviderConfig } from '../model/whatsapp-template-settings'
/** Story fixtures keep locale loading independent of the server-only catalog loader. */
const englishNotifications = {
  "settings": {
    "templates": {
      "title": "Approved WhatsApp templates",
      "description": "Connect each notification event to its approved Twilio template. Account credentials stay in server configuration.",
      "twilioActive": "Twilio is the active WhatsApp provider.",
      "otherActive": "The active provider is {provider}. Saving will switch WhatsApp sending to Twilio for this organization.",
      "noProvider": "No active WhatsApp provider is configured. Saving will activate Twilio.",
      "channelHint": "Templates are saved separately from the WhatsApp channel switch. Enable the channel above when you are ready to send.",
      "configuredEvents": "Configured notification events",
      "addTemplate": "Add template",
      "event": "Notification event",
      "eventHint": "Use the exact notification event code, for example order.created. Each event needs its own approved template.",
      "sid": "Twilio Content SID",
      "sidHint": "Copy the HX identifier from your approved template in Twilio. This field is not your Account SID.",
      "variables": "Template variables",
      "variablesHint": "Copy each variable name or number exactly from Twilio. Map it to notification data or a fixed value. For order.created, available data includes order_number and estimated_ready_at.",
      "noVariables": "No variables. Use this only for a template containing fixed text.",
      "variableName": "Template variable name or number",
      "valueType": "Value type",
      "eventValue": "Notification data",
      "fixedValue": "Fixed text",
      "valueSource": "Data name or fixed text",
      "sourceHint": "For notification data, enter its name without a dollar sign, for example order_number. For fixed text, enter the text to send.",
      "removeVariable": "Remove variable",
      "addVariable": "Add variable",
      "saveActivate": "Save and activate Twilio",
      "liveHint": "Saving prepares live customer sending. Confirm the template is approved, server credentials and sender are ready, and customer WhatsApp consent is recorded. Existing sandbox recipient overrides must be cleared.",
      "removeTemplate": "Remove template",
      "removeTitle": "Remove this template mapping?",
      "removeDescription": "WhatsApp notifications for {event} will fail until another approved template is configured.",
      "discardTitle": "Discard unsaved template changes?",
      "discardDescription": "Your changes have not been saved. Continue to another template?",
      "invalidEvent": "Enter a valid event code, for example order.created.",
      "invalidSid": "Enter HX followed by 32 hexadecimal characters.",
      "invalidSlot": "Enter a variable name or a positive number exactly as shown in Twilio.",
      "invalidSource": "Enter a data name or nonempty fixed text. Fixed text cannot start with a dollar sign.",
      "duplicateSlot": "Each template variable must appear only once.",
      "validationSummary": "Review the highlighted template fields.",
      "loadFailed": "Could not load WhatsApp provider configuration. Retry or ask an administrator to check it.",
      "saveFailed": "Could not save the WhatsApp template. Your changes are still available to retry.",
      "saved": "WhatsApp template saved and Twilio activated."
    }
  }
}
const arabicNotifications = {
  "settings": {
    "templates": {
      "title": "قوالب واتساب المعتمدة",
      "description": "اربط كل حدث إشعار بقالب Twilio المعتمد له. تبقى بيانات اعتماد الحساب في إعدادات الخادم.",
      "twilioActive": "Twilio هو مزوّد واتساب النشط.",
      "otherActive": "المزوّد النشط هو {provider}. سيؤدي الحفظ إلى تحويل إرسال واتساب إلى Twilio لهذه المنشأة.",
      "noProvider": "لم يتم إعداد مزوّد واتساب نشط. سيؤدي الحفظ إلى تفعيل Twilio.",
      "channelHint": "يتم حفظ القوالب بشكل مستقل عن مفتاح قناة واتساب. فعّل القناة أعلاه عندما تكون جاهزاً للإرسال.",
      "configuredEvents": "أحداث الإشعارات التي تم إعدادها",
      "addTemplate": "إضافة قالب",
      "event": "حدث الإشعار",
      "eventHint": "استخدم رمز حدث الإشعار كما هو، مثل order.created. يحتاج كل حدث إلى قالب معتمد خاص به.",
      "sid": "معرّف محتوى Twilio",
      "sidHint": "انسخ المعرّف الذي يبدأ بـ HX من قالبك المعتمد في Twilio. هذا الحقل ليس معرّف الحساب.",
      "variables": "متغيرات القالب",
      "variablesHint": "انسخ اسم كل متغير أو رقمه من Twilio كما هو. اربطه ببيانات الإشعار أو بقيمة ثابتة. تتضمن بيانات order.created المتاحة order_number و estimated_ready_at.",
      "noVariables": "لا توجد متغيرات. استخدم هذا الخيار فقط لقالب يحتوي على نص ثابت.",
      "variableName": "اسم متغير القالب أو رقمه",
      "valueType": "نوع القيمة",
      "eventValue": "بيانات الإشعار",
      "fixedValue": "نص ثابت",
      "valueSource": "اسم البيانات أو النص الثابت",
      "sourceHint": "لبيانات الإشعار، أدخل الاسم دون علامة الدولار، مثل order_number. للنص الثابت، أدخل النص المطلوب إرساله.",
      "removeVariable": "إزالة المتغير",
      "addVariable": "إضافة متغير",
      "saveActivate": "حفظ وتفعيل Twilio",
      "liveHint": "يُعدّ الحفظ الإرسال الفعلي للعملاء. تأكد من اعتماد القالب وتجهيز بيانات اعتماد الخادم والمرسل وتسجيل موافقة العميل على واتساب. يجب إزالة تجاوزات مستلم بيئة الاختبار الحالية.",
      "removeTemplate": "إزالة القالب",
      "removeTitle": "هل تريد إزالة ربط هذا القالب؟",
      "removeDescription": "ستفشل إشعارات واتساب للحدث {event} حتى يتم إعداد قالب معتمد آخر.",
      "discardTitle": "هل تريد تجاهل تغييرات القالب غير المحفوظة؟",
      "discardDescription": "لم يتم حفظ تغييراتك. هل تريد المتابعة إلى قالب آخر؟",
      "invalidEvent": "أدخل رمز حدث صالحاً، مثل order.created.",
      "invalidSid": "أدخل HX متبوعاً بـ 32 محرفاً سداسي عشري.",
      "invalidSlot": "أدخل اسم المتغير أو رقماً موجباً كما يظهر في Twilio.",
      "invalidSource": "أدخل اسم البيانات أو نصاً ثابتاً غير فارغ. لا يمكن أن يبدأ النص الثابت بعلامة الدولار.",
      "duplicateSlot": "يجب أن يظهر كل متغير قالب مرة واحدة فقط.",
      "validationSummary": "راجع حقول القالب المحددة.",
      "loadFailed": "تعذر تحميل إعدادات مزوّد واتساب. أعد المحاولة أو اطلب من المسؤول مراجعتها.",
      "saveFailed": "تعذر حفظ قالب واتساب. ما زالت تغييراتك متاحة لإعادة المحاولة.",
      "saved": "تم حفظ قالب واتساب وتفعيل Twilio."
    }
  }
}

/** Approved content identifiers are public fixtures; these stories never send messages. */
const approvedSid = 'HX9db4d9523a6a72c2f1dcf4de53038405'
const namedProvider: NotificationProviderConfig = {
  id: 'cb55f649-8990-4f6a-94d7-84a6bd62db00',
  provider_code: 'TWILIO_WHATSAPP',
  is_active: true,
  updated_at: '2026-10-02T08:00:00Z',
  config: {
    content_templates: {
      'order.created': {
        content_sid: approvedSid,
        content_variable_map: {
          order_number: '$order_number',
          estimated_ready_at: '$estimated_ready_at',
        },
      },
    },
  },
}

/** Only the editor's locale namespace is provided, independent of tenant/session data. */
const meta = {
  title: 'Features/Notifications/WhatsAppTemplateEditor',
  component: WhatsAppTemplateEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded', a11y: { test: 'error' } },
  decorators: [
    (Story, context) => {
      const rtl = context.parameters.direction === 'rtl' || context.globals.direction === 'rtl'
      const messages = rtl ? arabicNotifications : englishNotifications
      return (
        <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} timeZone="Asia/Muscat" messages={{
          notifications: { settings: { templates: messages.settings.templates } },
          common: { save: rtl ? 'حفظ' : 'Save', cancel: rtl ? 'إلغاء' : 'Cancel' },
        }}>
          <div dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl">
            <Story />
          </div>
        </NextIntlClientProvider>
      )
    },
  ],
  argTypes: {
    provider: { control: 'object', description: 'Existing Twilio provider and event template bindings.' },
    events: { control: 'object', description: 'Configured event codes shown as selection buttons.' },
    pending: { control: 'boolean', description: 'Disables editing while a save is in progress.' },
    onSave: { control: false, description: 'Receives validated form values or an explicit removal request.' },
  },
  args: { events: [], pending: false, onSave: fn().mockResolvedValue(undefined) },
} satisfies Meta<typeof WhatsAppTemplateEditor>

export default meta
type Story = StoryObj<typeof meta>

/** A first-time organization starts with order.created data mappings and an empty SID. */
export const Default: Story = {}

/** Existing approved mapping using Twilio's named substitution slots. */
export const ActiveNamedVariables: Story = {
  args: { provider: namedProvider, events: ['order.created'] },
}

/** Numbered Twilio slots can combine event data with a literal value. */
export const NumberedAndFixedVariables: Story = {
  args: {
    provider: {
      ...namedProvider,
      config: {
        content_templates: {
          'order.created': {
            content_sid: approvedSid,
            content_variable_map: { '1': '$order_number', '2': '$estimated_ready_at', '3': 'Contact our support desk' },
          },
        },
      },
    },
    events: ['order.created'],
  },
}

/** Approved fixed text needs no event substitutions. */
export const FixedTextTemplate: Story = {
  args: {
    provider: {
      ...namedProvider,
      config: { content_templates: { 'order.created': { content_sid: approvedSid, content_variable_map: {} } } },
    },
    events: ['order.created'],
  },
}

/** Saving an inactive Twilio provider explicitly requests its activation. */
export const SaveAndActivate: Story = {
  args: { provider: { ...namedProvider, is_active: false }, events: ['order.created'] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save and activate Twilio' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      event: 'order.created', contentSid: approvedSid,
      mappings: [
        { slot: 'order_number', kind: 'variable', source: 'order_number' },
        { slot: 'estimated_ready_at', kind: 'variable', source: 'estimated_ready_at' },
      ],
    })
  },
}

/** Pending writes prevent overlapping changes to the template draft. */
export const Saving: Story = {
  args: { provider: namedProvider, events: ['order.created'], pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: /Twilio Content SID/ })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Add variable' })).toBeDisabled()
  },
}

/** Valid first-time configuration submits the expected SID and event-data mappings. */
export const ConfigureAndSave: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /Twilio Content SID/ }), approvedSid)
    await userEvent.click(canvas.getByRole('button', { name: 'Save and activate Twilio' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      event: 'order.created', contentSid: approvedSid,
      mappings: [
        { slot: 'order_number', kind: 'variable', source: 'order_number' },
        { slot: 'estimated_ready_at', kind: 'variable', source: 'estimated_ready_at' },
      ],
    })
  },
}

/** Invalid Content SIDs surface field validation without invoking the save callback. */
export const InvalidSid: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /Twilio Content SID/ }), 'AC-not-a-content-sid')
    await userEvent.click(canvas.getByRole('button', { name: 'Save and activate Twilio' }))
    await expect((await canvas.findAllByText(englishNotifications.settings.templates.invalidSid)).length).toBeGreaterThan(0)
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** Approved mappings remain legible with Arabic labels and reading direction. */
// RTL variant — verifies Arabic layout direction
export const RTL: Story = {
  name: 'RTL (Arabic)',
  args: { provider: namedProvider, events: ['order.created'] },
  globals: { direction: 'rtl' },
  parameters: { direction: 'rtl' },
}

/** Interactive controls allow inspection of an existing production-template mapping. */
export const Playground: Story = {
  args: { provider: namedProvider, events: ['order.created'] },
}
