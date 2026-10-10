/**
 * CustomerWhatsAppConsentEditor stories cover opt-in, read-only, pending,
 * missing-phone, explicit-save, revocation, and Arabic RTL states without live API calls.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CustomerWhatsAppConsentEditor } from './customer-whatsapp-consent-card'
/** Static fixtures avoid the production server-only locale loader in Storybook. */
const englishCustomers = {
  "whatsappConsent": {
    "title": "Customer WhatsApp notifications",
    "description": "Choose whether this customer agrees to receive order updates through WhatsApp. This setting applies only to this customer in your organization.",
    "optIn": "The customer has agreed to WhatsApp order notifications",
    "phone": "WhatsApp phone",
    "noPhone": "No phone number recorded",
    "phoneRequired": "Add a valid phone number with country code in the customer profile before enabling WhatsApp. You can still withdraw existing consent.",
    "readOnly": "You can view consent. Permission to update customers is required to change it.",
    "consentHint": "Enable this only after the customer explicitly agrees. Uncheck and save if they withdraw consent. Approved templates and an enabled WhatsApp channel are also required for delivery.",
    "saved": "Customer WhatsApp consent saved",
    "saveFailed": "Could not save customer WhatsApp consent. Your choice remains available to retry.",
    "loadFailed": "Could not load customer WhatsApp consent. Retry after checking the selected organization.",
    "languageTitle": "Notification language",
    "languageDescription": "Choose the language this customer's order notifications are sent in. Leave on the default to follow your organization's own configured language.",
    "languageLabel": "Preferred language",
    "languageUseDefault": "Use organization default",
    "languageEnglish": "English",
    "languageArabic": "Arabic",
    "languageSaved": "Customer notification language saved",
    "languageSaveFailed": "Could not save the customer's notification language. Your choice remains available to retry."
  }
}
const arabicCustomers = {
  "whatsappConsent": {
    "title": "إشعارات واتساب للعميل",
    "description": "اختر ما إذا كان هذا العميل يوافق على تلقي تحديثات الطلب عبر واتساب. يسري هذا الإعداد على هذا العميل فقط في منشأتك.",
    "optIn": "وافق العميل على تلقي إشعارات الطلب عبر واتساب",
    "phone": "رقم واتساب",
    "noPhone": "لم يتم تسجيل رقم هاتف",
    "phoneRequired": "أضف رقم هاتف صالحاً مع رمز الدولة في ملف العميل قبل تفعيل واتساب. يمكنك إلغاء الموافقة الحالية حتى دون وجود رقم صالح.",
    "readOnly": "يمكنك عرض الموافقة. يلزم إذن تحديث العملاء لتغييرها.",
    "consentHint": "فعّل هذا الخيار فقط بعد موافقة العميل الصريحة. ألغِ التحديد واحفظ إذا سحب العميل موافقته. يتطلب التسليم أيضاً قوالب معتمدة وقناة واتساب مفعّلة.",
    "saved": "تم حفظ موافقة العميل على واتساب",
    "saveFailed": "تعذر حفظ موافقة العميل على واتساب. ما زال اختيارك متاحاً لإعادة المحاولة.",
    "loadFailed": "تعذر تحميل موافقة العميل على واتساب. أعد المحاولة بعد التحقق من المنشأة المحددة.",
    "languageTitle": "لغة الإشعارات",
    "languageDescription": "اختر اللغة التي تُرسل بها إشعارات طلبات هذا العميل. اترك الإعداد الافتراضي لاستخدام اللغة المضبوطة في منشأتك.",
    "languageLabel": "اللغة المفضلة",
    "languageUseDefault": "استخدام لغة المنشأة الافتراضية",
    "languageEnglish": "الإنجليزية",
    "languageArabic": "العربية",
    "languageSaved": "تم حفظ لغة إشعارات العميل",
    "languageSaveFailed": "تعذر حفظ لغة إشعارات العميل. ما زال اختيارك متاحاً لإعادة المحاولة."
  }
}

/** Isolated consent examples use the real locale catalogs and never access a tenant API. */
const meta = {
  title: 'Features/Customers/CustomerWhatsAppConsentEditor',
  component: CustomerWhatsAppConsentEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded', a11y: { test: 'error' } },
  decorators: [(Story, context) => {
    const rtl = context.parameters.direction === 'rtl' || context.globals.direction === 'rtl'
    const messages = rtl ? arabicCustomers : englishCustomers
    return <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} timeZone="Asia/Muscat" messages={{
      customers: { whatsappConsent: messages.whatsappConsent },
      common: { save: rtl ? 'حفظ' : 'Save', cancel: rtl ? 'إلغاء' : 'Cancel' },
    }}>
      <div dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl"><Story /></div>
    </NextIntlClientProvider>
  }],
  argTypes: {
    consent: { control: 'object' },
    canEdit: { control: 'boolean' },
    pending: { control: 'boolean' },
    onSave: { control: false },
    languagePending: { control: 'boolean' },
    onSaveLanguage: { control: false },
  },
  args: {
    consent: { optedIn: false, phone: '+96890123456', updatedAt: '2026-10-02', preferredLanguage: null },
    canEdit: true, pending: false, onSave: fn().mockResolvedValue(undefined),
    languagePending: false, onSaveLanguage: fn().mockResolvedValue(undefined),
  },
} satisfies Meta<typeof CustomerWhatsAppConsentEditor>

export default meta
type Story = StoryObj<typeof meta>

/** Valid contact information permits an explicit new opt-in choice. */
export const Default: Story = {}
/** Previously saved agreement is shown without automatically writing another change. */
export const OptedIn: Story = { args: { consent: { ...meta.args.consent, optedIn: true } } }
/** Customer-read access exposes consent without editing permission. */
export const ReadOnly: Story = { args: { canEdit: false } }
/** Pending writes temporarily prevent duplicate consent changes. */
export const Saving: Story = { args: { pending: true } }
/** A missing contact phone prevents granting new WhatsApp consent. */
export const MissingPhone: Story = { args: { consent: { ...meta.args.consent, phone: null } } }
/** Revocation remains possible even when contact information is missing. */
export const RevocationWithoutPhone: Story = {
  args: { consent: { ...meta.args.consent, optedIn: true, phone: null } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('checkbox'))
    await expect(args.onSave).not.toHaveBeenCalled()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Save' })[0])
    await expect(args.onSave).toHaveBeenCalledWith(false)
  },
}
/** Changing the checkbox alone leaves persisted consent untouched until Save. */
export const ExplicitSave: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('checkbox'))
    await expect(args.onSave).not.toHaveBeenCalled()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Save' })[0])
    await expect(args.onSave).toHaveBeenCalledWith(true)
  },
}
/** Arabic reading direction retains usable consent controls and contact information. */
// RTL variant — verifies Arabic layout direction
export const RTL: Story = { parameters: { direction: 'rtl' }, globals: { direction: 'rtl' } }
