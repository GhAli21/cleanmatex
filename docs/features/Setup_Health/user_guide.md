# Setup Health — User Guide

Back to [README.md](README.md). العربية أدناه.

## English

### For organization admins

**Where:** sidebar › Config And Settings › **Setup Health**. Admins only.

The page lists checks grouped by area (Business calendar, Service speeds, Accounting…). Each check shows:

- **OK**, **Needs attention**, **Not applicable** or **Could not check**
- how serious it is: **Blocker** (something does not work), **Warning** (works but incomplete), **Info** (good to know)
- in plain words, why it matters
- a **Fix** button that opens the screen to fix it — if you are allowed to open it. Otherwise: "Your provider sets this up. Please contact support."

Fix the problem in that screen, come back, and the list refreshes by itself.

**Dashboard home:** a "Setup health" tile shows how many blockers, warnings and infos you have. Click it to open the page.

**Red banner:** if a blocker that stops daily work fails, a red banner shows at the top of every page for all users. It cannot be closed; it goes away when the problem is fixed. Admins see an "Open Setup Health" link.

### For HQ staff

**Where:** Tenant Organizations › open an organization › **Setup Health** (after Overview). Needs `tenant_setup_health:view`.

You see four counters (Blockers, Warnings, Info, Could not check), the same checks as the organization plus HQ-only ones (for example *Public holiday dates are not confirmed yet*), each check's code, and **Fix** buttons that open the HQ screen. **Recheck** runs the checks again.

**Organizations list:** the **Setup** column shows the number of blockers (red) and warnings (amber), **OK**, or **Not checked**. Hover to see when it was last checked; click to open that organization's Setup Health. The **Setup Health** filter shows only organizations with **Has blockers** or **Blockers or warnings**, across all pages. The numbers update when someone opens the organization's Setup Health page, and every night. To update them now, click **Run Setup Checks** in the page header (or **Check Setup** in one organization's **⋯** menu, which opens the same dialog with that organization chosen). In the dialog choose *All active organizations* or *Selected organizations*, and *All checks* or *Selected checks* (grouped by area), then **Run checks**. The results list each organization with its blockers, warnings and the failing checks by name, with a link to its Setup Health page. Only a run of all checks updates the Setup column; a run of some checks leaves it unchanged, because the column always shows all checks.

## العربية

### لمسؤولي المنشأة

**المكان:** القائمة الجانبية › الإعدادات › **صحة الإعداد**. للمسؤولين فقط.

تعرض الصفحة الفحوصات مجمّعة حسب المجال (تقويم العمل، سرعات الخدمة، المحاسبة…). لكل فحص:

- الحالة: **سليم** أو **يحتاج إلى انتباه** أو **لا ينطبق** أو **تعذّر الفحص**
- درجة الأهمية: **مانع** (شيء لا يعمل)، **تحذير** (يعمل لكنه ناقص)، **معلومة**
- سبب أهميته بكلمات بسيطة
- زر **إصلاح** يفتح شاشة الإصلاح إن كانت لديك صلاحية فتحها، وإلا تظهر رسالة: "يقوم مزوّد الخدمة بإعداد هذا. يرجى التواصل مع الدعم."

أصلح المشكلة في تلك الشاشة ثم عُد، وستتحدث القائمة تلقائياً.

**الصفحة الرئيسية:** بطاقة "صحة الإعداد" تعرض عدد الموانع والتحذيرات والمعلومات. اضغطها لفتح الصفحة.

**الشريط الأحمر:** إذا فشل فحص مانع يوقف العمل اليومي، يظهر شريط أحمر أعلى كل صفحة لجميع المستخدمين. لا يمكن إغلاقه، ويختفي بعد إصلاح المشكلة. يرى المسؤولون رابط "فتح صحة الإعداد".

### لفريق إدارة المنصة

**المكان:** المنشآت › افتح منشأة › **صحة الإعداد** (بعد النظرة العامة). يتطلب صلاحية `tenant_setup_health:view`.

تظهر أربعة عدّادات (الموانع، التحذيرات، المعلومات، تعذّر الفحص)، ونفس فحوصات المنشأة إضافة إلى فحوصات خاصة بإدارة المنصة (مثل *مواعيد العطل الرسمية غير مؤكدة بعد*)، ورمز كل فحص، وأزرار **إصلاح** تفتح شاشة إدارة المنصة. زر **إعادة الفحص** يشغّل الفحوصات من جديد.

**قائمة المنشآت:** يعرض عمود **الإعداد** عدد الموانع (أحمر) والتحذيرات (كهرماني)، أو **سليم**، أو **لم يُفحص**. مرّر المؤشر لمعرفة وقت آخر فحص، واضغط لفتح صحة الإعداد لتلك المنشأة. يعرض مرشّح **صحة الإعداد** المنشآت التي **بها موانع** أو **موانع أو تحذيرات** فقط، عبر كل الصفحات. تتحدّث الأعداد عند فتح صفحة صحة الإعداد للمنشأة، وكل ليلة. لتحديثها فوراً، اضغط **تشغيل فحوصات الإعداد** في أعلى الصفحة (أو **فحص الإعداد** من قائمة **⋯** لمنشأة واحدة، وتفتح النافذة نفسها مع اختيار تلك المنشأة). في النافذة اختر *كل المنشآت الفعّالة* أو *منشآت محددة*، و*كل الفحوصات* أو *فحوصات محددة* (مجمّعة حسب المجال)، ثم **تشغيل الفحوصات**. تعرض النتائج كل منشأة مع الموانع والتحذيرات وأسماء الفحوصات الفاشلة، مع رابط إلى صفحة صحة الإعداد الخاصة بها. تشغيل **كل** الفحوصات وحده يحدّث عمود الإعداد؛ أما تشغيل بعض الفحوصات فلا يغيّره لأن العمود يعرض دائمًا كل الفحوصات.
