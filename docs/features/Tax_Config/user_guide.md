# Tax Engine — User Guide

Back to [README.md](README.md). العربية أدناه.

## English

### For organization admins

**1. Confirm your tax setup** — sidebar › Settings › **Tax Setup**.

- Your organization starts with your country's **tax kit**: tax codes, rates and rules prepared by HQ. It shows *Tax setup is waiting for confirmation*.
- Until you confirm, **orders carry no tax**.
- Click **Review and confirm**. You see in plain words what your customers pay, whether your prices include tax, when invoices are issued, and worked examples.
- Enter your tax registration number (per branch if they differ) and any rate the kit asks for, then **Confirm tax setup**. *Not ready yet* lists what is still missing.
- Setup Health and the banner at the top of the app remind you until it is done.

**2. Everyday use** — nothing to do. Each order line gets its tax from the rules: the service's **item tax class** (standard, zero-rated, exempt…) and the customer decide it. If no rule covers a case, the order is refused with a message — it is never silently charged 0.

**3. Item tax class on products** — Catalog › product › **Item tax class**. Leave it empty for the default class.

**4. Advanced mode** (optional) — Tax Setup › turn on **Advanced mode** to see **Tax codes**, **Tax rules** and **Item tax classes**.

- Changing a code no order has used saves it in place; once used, a new version starts and old orders keep their rate.
- **Why this tax?** shows which rule is used for a case and which others also matched.
- Two rules that could tie are refused when you save.

**5. Purchases** — expenses, purchase orders and supplier invoices pick their tax from the purchase rules once the setup is confirmed. The recoverable part goes to Input VAT. On a supplier payment you can record **withholding tax**; the supplier is paid the amount minus the withheld part.

**6. Advances and gift cards** — money received in advance is taxed when received (if your kit says so) and netted when the order is invoiced. Gift cards: *multi-purpose* are taxed when used, *single-purpose* when sold.

**7. Tax periods** — Tax Setup › **Tax periods**. Add periods that match how often you file. **Close period** after filing: nothing new can be dated inside it. **Reopen** needs a reason.

**8. VAT return** — sidebar › Reports › **VAT Return**. Choose a tax period or custom dates. Each box shows its amount and tax, built from final tax lines; click a box to see its lines; **Export CSV**. Boxes marked *to confirm* have not yet been checked against the authority's current form — check the numbers on the portal before filing. *Not on the return* lists lines no box takes (for example a UAE branch without an emirate).

### For HQ staff

- **Tax Kits** — Master System Codes › **Tax Kits**. Open a kit to see its version: facts, codes, rules, worked examples.
  - **New draft from this version** → **Edit facts**, edit codes and examples → **Check examples** → **Compare with previous** → **Publish** (needs every example to pass and a date of today or later) or **Discard draft**.
  - Published versions cannot be changed. Mark facts verified once a person has checked them against the official source.
- **Starter Packages** — Master System Codes › **Starter Packages**: which kit, calendar and price mode each country starts with.
- **Organization › Tax kit** — apply a package (waiting for confirmation, or activated with a reason), or **Update kit now** to move the organization to the newest published version. This also runs every night by itself; the organization's status is kept and rows it changed itself are not overwritten.
- New organizations get their country's default package automatically, waiting for confirmation.

---

## العربية

### لمسؤولي المنشأة

**1. تأكيد الإعداد الضريبي** — القائمة › الإعدادات › **إعداد الضريبة**.

- تبدأ منشأتك بـ**الإعداد الضريبي الجاهز** لبلدك: رموز الضريبة ونسبها وقواعدها التي أعدّتها إدارة المنصة. وتظهر الحالة *الإعداد الضريبي بانتظار التأكيد*.
- **لا تُحتسب ضريبة على الطلبات** حتى تؤكد الإعداد.
- اضغط **المراجعة والتأكيد**. ستجد بلغة واضحة ما يدفعه عملاؤك، وهل أسعارك شاملة الضريبة، ومتى تصدر الفواتير، مع أمثلة محسوبة.
- أدخل رقم التسجيل الضريبي (لكل فرع إن اختلف) وأي نسبة يطلبها الإعداد، ثم **تأكيد الإعداد الضريبي**. تعرض *غير جاهز بعد* ما ينقص.
- تذكّرك صحة الإعداد والشريط أعلى التطبيق حتى يكتمل ذلك.

**2. الاستخدام اليومي** — لا شيء عليك. يأخذ كل سطر في الطلب ضريبته من القواعد: **الفئة الضريبية للصنف** (عادية، صفرية، معفاة…) والعميل يحددانها. إذا لم تغطِّ أي قاعدة الحالة يُرفض الطلب مع رسالة، ولا تُحتسب صفراً دون تنبيه.

**3. الفئة الضريبية على المنتجات** — الكتالوج › المنتج › **الفئة الضريبية للصنف**. اتركها فارغة لاستخدام الفئة الافتراضية.

**4. الوضع المتقدم** (اختياري) — إعداد الضريبة › فعّل **الوضع المتقدم** لتظهر **رموز الضريبة** و**القواعد الضريبية** و**الفئات الضريبية للأصناف**.

- تعديل رمز لم يُستخدم في أي طلب يُحفظ مكانه؛ وبعد استخدامه يبدأ إصدار جديد وتحتفظ الطلبات القديمة بنسبتها.
- **لماذا هذه الضريبة؟** تعرض القاعدة المطبقة على حالة ما والقواعد الأخرى التي طابقت.
- تُرفض عند الحفظ قاعدتان قد تتساويان.

**5. المشتريات** — بعد التأكيد تأخذ المصروفات وأوامر الشراء وفواتير الموردين ضريبتها من قواعد المشتريات. ويُسجَّل الجزء القابل للاسترداد في ضريبة المدخلات. وعند الدفع للمورد يمكنك تسجيل **ضريبة الاستقطاع**، فيُدفع للمورد المبلغ ناقص الجزء المستقطع.

**6. الدفعات المقدمة وبطاقات الهدايا** — تُحتسب ضريبة المبلغ المقدم عند استلامه (إذا نص الإعداد على ذلك) وتُسوّى عند إصدار فاتورة الطلب. بطاقات الهدايا: *متعددة الأغراض* تُحتسب ضريبتها عند الاستخدام، و*أحادية الغرض* عند البيع.

**7. الفترات الضريبية** — إعداد الضريبة › **الفترات الضريبية**. أضف فترات تطابق دورية تقديم إقرارك. **إغلاق الفترة** بعد التقديم يمنع تسجيل أي جديد بتاريخ داخلها. و**إعادة الفتح** تتطلب سبباً.

**8. الإقرار الضريبي** — القائمة › التقارير › **الإقرار الضريبي**. اختر فترة ضريبية أو تواريخ مخصصة. تعرض كل خانة مبلغها وضريبتها من سطور الضريبة النهائية؛ اضغط الخانة لرؤية سطورها؛ **تصدير CSV**. الخانات الموسومة *للتأكيد* لم تُراجع بعد مقابل النموذج الحالي للجهة الضريبية، فتحقق من أرقامها على البوابة قبل التقديم. وتعرض *غير مدرجة في الإقرار* السطور التي لا تأخذها أي خانة (مثل فرع في الإمارات بلا إمارة محددة).

### لفريق إدارة المنصة

- **الإعدادات الضريبية الجاهزة** — رموز النظام الرئيسية › **الإعدادات الضريبية الجاهزة**. افتح إعداداً لترى إصداره: المعلومات والرموز والقواعد والأمثلة المحلولة.
  - **مسودة جديدة من هذا الإصدار** ← **تعديل المعلومات** وتعديل الرموز والأمثلة ← **تشغيل الأمثلة** ← **مقارنة بالسابق** ← **نشر** (يتطلب نجاح كل الأمثلة وتاريخ سريان اليوم أو بعده) أو **حذف المسودة**.
  - لا يمكن تعديل الإصدارات المنشورة. علّم المعلومات كموثقة بعد أن يراجعها شخص مقابل المصدر الرسمي.
- **الباقات المبدئية** — رموز النظام الرئيسية › **الباقات المبدئية**: الإعداد الضريبي والتقويم وطريقة الأسعار التي يبدأ بها كل بلد.
- **المنشأة › الإعداد الضريبي** — طبّق باقة (بانتظار التأكيد، أو مفعّلة مع ذكر السبب)، أو **تحديث الإعداد الآن** لنقل المنشأة إلى أحدث إصدار منشور. ويجري هذا تلقائياً كل ليلة؛ تبقى حالة المنشأة كما هي ولا تُستبدل الصفوف التي غيّرتها بنفسها.
- تحصل المنشآت الجديدة تلقائياً على الباقة الافتراضية لبلدها، بانتظار التأكيد.
