# User Guide — Human-Friendly Codes

Detailed guides: labels [`USER_GUIDE_LABELS.md`](./USER_GUIDE_LABELS.md), scanning [`SCAN_AND_PIECE_CODES.md`](./SCAN_AND_PIECE_CODES.md). Diagrams: [`user_guide_mermaid.md`](./user_guide_mermaid.md).

## Part 1 — English

### 1. The codes you will see
- **Order number** — `ORD-20261031-0001`: date of the day in your organization's time zone, then the order of the day.
- **Sub-order** — `ORD-20261031-0001-S1`: part of an order that was split.
- **Piece code** — `ORD-20261031-0001-2-3`: line 2, piece 3 of that order.
- **Store credit note** — `SCN-2026-000001`. Older notes keep their old numbers.
- **Tag** — a pre-printed tag you link to a piece (letters, digits and `- _ . /`, up to 64).

Codes are made automatically and cannot be changed. They always read left-to-right, also in Arabic.

### 2. Find an order
- Type the full order number in the orders search box and press Enter: the order opens.
- Press **Ctrl+Shift+F** (Mac: Cmd+Shift+F) or the scan button in the top bar, then scan or type any order, piece or tag code (when your organization has scanning switched on).

### 3. Print
- On an order: **Print label** (order label with QR and barcode) or **Print piece tags**.
- Sizes and options: **Settings → Labels & Tags** (per branch, or "use default").
- Receipts show the order number as a barcode when that option is on.

### 4. Link a tag
On a piece choose **Link tag** and scan the tag. If the tag is already used by another piece you see which one; nothing changes. A tag is freed when the piece is removed or the order is delivered, closed or cancelled.

### 5. HQ users
- **Data → Code Types**: list of every code type with an example and a preview.
- **Data → Code Consistency**: should show 0 errors; use "Run again" to refresh.
- **Settings → General Config**: platform defaults (currency, time zone, language, country, fiscal year, VAT, support contacts, trial days). New tenants start with these values.

## الجزء الثاني — العربية

### 1. الرموز التي ستراها
- **رقم الطلب** — `ORD-20261031-0001`: تاريخ اليوم حسب المنطقة الزمنية لمؤسستك ثم تسلسل الطلب في اليوم.
- **طلب فرعي** — `ORD-20261031-0001-S1`: جزء من طلب تم تقسيمه.
- **رمز القطعة** — `ORD-20261031-0001-2-3`: السطر 2، القطعة 3 من الطلب.
- **إشعار رصيد المتجر** — `SCN-2026-000001`. الإشعارات القديمة تحتفظ بأرقامها.
- **بطاقة** — بطاقة مطبوعة مسبقاً تربطها بقطعة (حروف وأرقام و`- _ . /`، حتى 64 حرفاً).

تُنشأ الرموز تلقائياً ولا يمكن تعديلها، وتُعرض دائماً من اليسار إلى اليمين حتى في الواجهة العربية.

### 2. البحث عن طلب
- اكتب رقم الطلب كاملاً في مربع البحث واضغط Enter فيُفتح الطلب.
- اضغط **Ctrl+Shift+F** (ماك: Cmd+Shift+F) أو زر المسح في الشريط العلوي، ثم امسح أو اكتب رمز الطلب أو القطعة أو البطاقة (عند تفعيل المسح لمؤسستك).

### 3. الطباعة
- من صفحة الطلب: **طباعة الملصق** (ملصق الطلب مع QR وباركود) أو **طباعة بطاقات القطع**.
- المقاسات والخيارات: **الإعدادات ← الملصقات والبطاقات** (لكل فرع أو "استخدام الافتراضي").
- يظهر رقم الطلب كباركود في الإيصال عند تفعيل هذا الخيار.

### 4. ربط بطاقة
من القطعة اختر **ربط بطاقة** وامسح البطاقة. إذا كانت البطاقة مستخدمة لقطعة أخرى تظهر لك القطعة ولا يتغير شيء. تُحرَّر البطاقة عند حذف القطعة أو تسليم الطلب أو إغلاقه أو إلغائه.

### 5. مستخدمو الإدارة المركزية (HQ)
- **البيانات ← أنواع الرموز**: كل أنواع الرموز مع مثال ومعاينة.
- **البيانات ← اتساق الرموز**: يجب أن يظهر 0 أخطاء؛ استخدم "تشغيل مرة أخرى" للتحديث.
- **الإعدادات ← الإعدادات العامة**: القيم الافتراضية للمنصة (العملة، المنطقة الزمنية، اللغة، الدولة، السنة المالية، الضريبة، بيانات الدعم، أيام التجربة). تبدأ المؤسسات الجديدة بهذه القيم.
