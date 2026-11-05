# Label Printing User Guide (P4, Human-Friendly Codes)

Status: written 2026-10-31 with P4; updated the same day for the Labels & Tags settings screen (A-46..A-49). Migration `0685_add_settings_label_printing.sql` was applied 2026-10-31 (local + remote); the screens work once web-admin is deployed with `bwip-js`.
Plan: `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` §21 T4.x, decisions A-07, A-09, A-16, A-45..A-49.

العربية: انظر القسم الثاني أدناه.

---

## Part 1 — English

### 1. What prints

| Label | Where | Content |
|---|---|---|
| Order label | Order page → **Print label** | Branch, order number (text + CODE128 barcode), ready-by date (or "TBD"), item and piece counts, short customer name (optional), staff QR |
| Piece tags | Order page → **Print piece tags** | One tag per piece: piece code (text + CODE128), item name, "piece x of n", linked tag (if any), staff QR (optional) |
| Item labels | Intake / processing item labels | Line code (text + CODE128) |
| Receipt | Ready → print → receipt | Order number; CODE128 of the order number when the setting is on |

- Barcodes encode the code exactly as shown, hyphens included (for example `ORD-260101-0001-1-2`), so a scanner returns the same text you see.
- The staff QR holds `CMX1:ORD:<order number>` (piece tags: `CMX1:PEC:<piece code>`). It opens the record only inside CleanMateX for your own organization; a phone camera just shows the text.
- Labels never print the customer phone. The customer appears as first name + last initial (for example "Ahmed B.") and can be turned off.
- Codes are always printed left-to-right, also when the app is in Arabic; the rest of the label follows the app language.
- The customer receipt keeps its tracking QR as before.

### 2. Printing

1. Open the order and click **Print label** (or **Print piece tags**).
2. The browser print dialog opens (no pop-up window). Pick the label printer.
3. In the dialog set: paper size = your label stock, margins = none, scale = 100% (or "actual size"), headers and footers = off.
4. Print. One label is one page.

If an error toast appears: "could not load label data" = check the connection and try again; "no pieces" = the order has no active pieces yet; "print failed" = reload the page and retry.

### 3. Sizes and settings

Label printing is available to every organization (no feature flag to turn on).

Open **Settings → Labels & Tags** (needs the settings permission; saving needs settings update). At the top pick the scope:
- **All branches**: the organization default.
- **A branch**: changes for that branch only. Each field can be set to **Use default**, which takes the organization value (or the system value if the organization has none). Under each field you see what is in use now and where it comes from ("this branch", "all branches", "system default").

Finish or discard your changes before switching scope. Changes apply to the next label printed.

| Label | Option | Values | System default |
|---|---|---|---|
| Order label | Paper size | 4×6 in, A6, 80 mm, 58 mm | 4×6 in |
| Order label | QR code | Show / Hide | Show |
| Order label | Customer name (short) | Show / Hide | Show |
| Order label | Copies | 1–10 | 1 |
| Piece tag | Paper size | 58×30 mm, 50×25 mm, 80×40 mm | 58×30 mm |
| Piece tag | QR code | Show / Hide (use on 80×40 mm tags) | Hide |
| Piece tag | Copies (per piece) | 1–10 | 1 |
| Receipt | Order barcode (CODE128) | Show / Hide | Show |

80 mm order label = 80×120 mm, 58 mm = 58×90 mm roll labels.

The receipt barcode only prints when scanning is enabled for your organization (`human_codes_scan_labels`, also used for the scan button). Otherwise the screen shows "In use: Hide (scanning is off)" with a note.

### 4. Printer setup notes

- Thermal printers (203 dpi): use direct-thermal or thermal-transfer labels of the chosen size; set the driver's paper size to the same size. Keep darkness at the middle of the range; too dark blurs the bars.
- Do not shrink to fit: scaling below 100% can make CODE128 unreadable.
- Long codes on 50×25 mm tags are narrow; if a scanner struggles, use 58×30 mm.
- Office A4/A6 laser printers work for order labels (`A6`).
- After the first print, scan one label with your USB scanner (also with the keyboard set to Arabic): the order or piece must open (QA S6, S7, S13).

### 5. Known limits

- Every allowed size prints for every organization; there is no separate on/off per paper size.
- Bulk printing for many orders at once comes in a later phase.

---

## الجزء الثاني — العربية

### 1. ما الذي يُطبع

| الملصق | المكان | المحتوى |
|---|---|---|
| ملصق الطلب | صفحة الطلب ← **طباعة الملصق** | الفرع، رقم الطلب (نص + باركود CODE128)، موعد الجاهزية (أو "غير محدد")، عدد الأصناف والقطع، اسم العميل المختصر (اختياري)، رمز QR للموظفين |
| بطاقات القطع | صفحة الطلب ← **طباعة بطاقات القطع** | بطاقة لكل قطعة: رمز القطعة (نص + CODE128)، اسم الصنف، "القطعة x من n"، البطاقة المرتبطة إن وجدت، QR اختياري |
| ملصقات الأصناف | ملصقات الاستلام / المعالجة | رمز السطر (نص + CODE128) |
| الإيصال | جاهز ← طباعة ← الإيصال | رقم الطلب، وباركود CODE128 لرقم الطلب عند تفعيل الإعداد |

- الباركود يحمل الرمز كما يظهر تماماً مع الشرطات، فيقرأ الماسح النص نفسه الذي تراه.
- رمز QR للموظفين يحمل `CMX1:ORD:<رقم الطلب>` (بطاقات القطع: `CMX1:PEC:<رمز القطعة>`) ولا يفتح السجل إلا داخل CleanMateX لمنشأتك.
- لا يُطبع رقم هاتف العميل أبداً. يظهر الاسم الأول + الحرف الأول من اسم العائلة، ويمكن إخفاؤه.
- تُطبع الرموز دائماً من اليسار إلى اليمين حتى في الواجهة العربية.
- رمز تتبع الطلب على إيصال العميل باقٍ كما هو.

### 2. الطباعة

1. افتح الطلب واضغط **طباعة الملصق** (أو **طباعة بطاقات القطع**).
2. تفتح نافذة الطباعة في المتصفح (بدون نافذة منبثقة). اختر طابعة الملصقات.
3. اضبط: حجم الورق = حجم الملصق، الهوامش = بلا، المقياس = 100%، الرأس والتذييل = إيقاف.
4. اطبع. كل ملصق صفحة واحدة.

### 3. المقاسات والإعدادات

طباعة الملصقات متاحة لجميع المنشآت (لا حاجة لتفعيل أي ميزة).

افتح **الإعدادات ← الملصقات والبطاقات** (تحتاج صلاحية عرض الإعدادات، والحفظ يحتاج صلاحية تعديل الإعدادات). اختر النطاق في الأعلى:
- **جميع الفروع**: الإعداد الافتراضي للمنشأة.
- **فرع محدد**: تغييرات لهذا الفرع فقط. يمكن ضبط كل حقل على **استخدام الافتراضي** فيأخذ قيمة المنشأة (أو قيمة النظام إن لم تحدد المنشأة قيمة). تحت كل حقل تظهر القيمة المستخدمة حالياً ومصدرها ("هذا الفرع"، "كل الفروع"، "الافتراضي للنظام").

احفظ تغييراتك أو تجاهلها قبل تغيير النطاق. تُطبق التغييرات على الملصق التالي.

| الملصق | الخيار | القيم | افتراضي النظام |
|---|---|---|---|
| ملصق الطلب | مقاس الورق | 4×6 بوصة، A6، 80 مم، 58 مم | 4×6 بوصة |
| ملصق الطلب | رمز QR | تشغيل / إيقاف | تشغيل |
| ملصق الطلب | اسم العميل المختصر | تشغيل / إيقاف | تشغيل |
| ملصق الطلب | عدد النسخ | 1–10 | 1 |
| بطاقة القطعة | مقاس الورق | 58×30 مم، 50×25 مم، 80×40 مم | 58×30 مم |
| بطاقة القطعة | رمز QR | تشغيل / إيقاف (للبطاقات 80×40 مم) | إيقاف |
| بطاقة القطعة | عدد النسخ (لكل قطعة) | 1–10 | 1 |
| الإيصال | باركود رقم الطلب (CODE128) | تشغيل / إيقاف | تشغيل |

لا يُطبع باركود الإيصال إلا عند تفعيل المسح الضوئي لمنشأتك (`human_codes_scan_labels`، وهي نفسها التي تُظهر زر المسح)، وإلا تعرضه الشاشة متوقفاً مع "المسح غير مفعّل".

### 4. ملاحظات إعداد الطابعة

- الطابعات الحرارية (203 نقطة/بوصة): استخدم ملصقات بالمقاس المختار واضبط حجم الورق في التعريف بالمقاس نفسه، ودرجة السواد في المنتصف.
- لا تستخدم "ملاءمة الصفحة"؛ التصغير قد يجعل الباركود غير مقروء.
- بعد أول طباعة امسح ملصقاً بالماسح (ولوحة المفاتيح بالعربية أيضاً)؛ يجب أن يفتح الطلب أو القطعة.

### 5. حدود معروفة

- كل المقاسات المسموحة تُطبع لجميع المنشآت، ولا يوجد تفعيل منفصل لكل مقاس.
- الطباعة الجماعية لعدة طلبات دفعة واحدة ستأتي في مرحلة لاحقة.
