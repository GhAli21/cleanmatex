# Line pricing — user guide / دليل المستخدم

## English

**What changed.** Every line of an order now keeps its own figures: the price, any speed premium,
its discount, its share of an order discount, tax and the line total. The order total is the sum of
its lines, so the receipt, the order screen and an edited order always show the same numbers.

**Service speed.** On New Order pick the speed for the whole order (Standard, Express…) or for one
line, or use "Apply to all lines". A faster speed adds the premium set in Speed Pricing and moves the
ready-by time. With no matching rule, a faster speed costs the same as Standard.

**Speed Pricing** (sidebar: Catalog › Speed Pricing, `/dashboard/catalog/speed-pricing`). Each rule
says what a speed adds for a product, a service category or everything: a fixed amount, a percentage,
a multiplier or a set sell price, plus an optional turnaround in hours. The most specific active rule
wins; "Which rule applies?" shows the winner for a product. A rule an order already used cannot be
deleted: deactivate it.

**Line discount.** With the `orders:discount` permission, open a line's breakdown and enter an amount
or a percent with a reason. An amount larger than the line is refused, never cut down silently.
An order discount is shared across the lines (shown per line as "Share of order discount"; the amount after both discounts reads "After discounts").

**Price changed.** If a catalog price changes while a cart is open, the line shows the new price and
asks you to confirm before the order is saved. In Order Edit, Review lists every changed price.

**Tax categories.** Each line carries a tax category: Standard, Zero-rated, Exempt or Out of scope.
Tax comes from the organization's tax profiles (Settings › Tax Setup, `/dashboard/settings/tax`); there is no default VAT rate.
Whether prices include tax, and whether tax is rounded per line or per document, is set by HQ.

**Rounding.** The order total is exact to the currency's decimals. Cash rounding applies only to the
change handed back on a cash payment, never to the order total.

**Order Edit.** Line speed, line price, line and piece discount and custom lines can be changed in
Edit when the Edit policy allows it; otherwise the control is disabled with its reason. A line that
is already ready cannot change speed.

## العربية

**ما الذي تغيّر.** كل سطر في الطلب يحتفظ الآن بأرقامه: السعر، ورسوم السرعة إن وجدت، والخصم، وحصته من خصم
الطلب، والضريبة، وإجمالي السطر. إجمالي الطلب هو مجموع سطوره، لذلك يظهر الإيصال وشاشة الطلب والطلب بعد
التعديل بالأرقام نفسها دائماً.

**سرعة الخدمة.** في طلب جديد اختر السرعة للطلب كله (عادي، مستعجل…) أو لسطر واحد، أو استخدم «تطبيق على كل
السطور». السرعة الأعلى تضيف الرسوم المحددة في تسعير السرعة وتغيّر موعد الجاهزية. إذا لم تنطبق أي قاعدة، فإن
السرعة الأعلى تكلف نفس سعر الخدمة العادية.

**تسعير السرعة** (القائمة: الفهرس والتسعير › تسعير السرعة، `/dashboard/catalog/speed-pricing`). كل قاعدة
تحدد ما تضيفه السرعة لمنتج أو فئة خدمة أو للجميع: مبلغ ثابت أو نسبة أو معامل أو سعر بيع محدد، مع مدة
إنجاز اختيارية بالساعات. القاعدة الأكثر تحديداً هي التي تُطبَّق، و«أي قاعدة تنطبق؟» تعرض القاعدة الفائزة
لمنتج. القاعدة التي استُخدمت في طلب لا تُحذف: أوقفها بدلاً من ذلك.

**خصم السطر.** بصلاحية `orders:discount` افتح تفاصيل السطر وأدخل مبلغاً أو نسبة مع السبب. المبلغ الأكبر من
قيمة السطر يُرفض ولا يُقلَّص بصمت. خصم الطلب يُوزَّع على السطور ويظهر لكل سطر كـ«حصة خصم الطلب»، والمبلغ بعد الخصمين يظهر كـ«بعد الخصومات».

**تغيّر السعر.** إذا تغيّر سعر في الفهرس والسلة مفتوحة، يعرض السطر السعر الجديد ويطلب تأكيدك قبل حفظ
الطلب. وفي تعديل الطلب تعرض المراجعة كل سعر تغيّر.

**الفئات الضريبية.** لكل سطر فئة ضريبية: أساسية، أو نسبة صفرية، أو معفاة، أو خارج النطاق. الضريبة تأتي من ملفات
الضريبة للمنشأة (الإعدادات › إعداد الضريبة، `/dashboard/settings/tax`)، ولا توجد نسبة ضريبة افتراضية. أما هل الأسعار شاملة للضريبة
وهل تُقرَّب الضريبة لكل سطر أو للمستند، فتحدده إدارة المنصة.

**التقريب.** إجمالي الطلب دقيق حتى خانات العملة. التقريب النقدي يُطبَّق فقط على الباقي المُعاد في الدفع
النقدي، ولا يُطبَّق على إجمالي الطلب.

**تعديل الطلب.** يمكن تغيير سرعة السطر وسعره وخصم السطر أو القطعة والسطور المخصصة في التعديل إذا سمحت
سياسة التعديل، وإلا يظهر عنصر التحكم معطلاً مع السبب. السطر الجاهز لا تتغيّر سرعته.
