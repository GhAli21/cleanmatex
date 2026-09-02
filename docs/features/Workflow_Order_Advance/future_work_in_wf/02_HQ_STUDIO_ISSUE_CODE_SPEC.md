# 02 — HQ Studio issue-code spec

**Date:** 2026-08-27  
**Updated:** 2026-09-03 — emit registry moved to the generated catalog  
**For:** HQ `WorkflowPolicyValidator` on the direct normalized profile-version model (ADR-SAAS-MNG-0010)

**Living registry (authority):** [GENERATED_WF_POLICY_ISSUE_CATALOG.md](../generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md)  
Pinned JSON: [wf-policy-issue-catalog.json](../generated/wf-policy-issue-catalog.json)  
HQ TypeScript: `cleanmatexsaas/platform-api/src/modules/workflow-engine-config/catalog/`  
**Maintain in HQ:** load `/manage-wf-policy-issues-catalog` before adding, updating, promoting, demoting, or retiring a code. Do not hand-edit the generated pin.

This file remains the **narrative** for planned codes and operator-facing EN/AR intent.  
Do not add a new Check-policy `code` here without a catalog row in the same change.

**Vocabulary:** [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md)  
**Situations:** [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md)

**Implementation authority:** `workflow_live_profile_runtime_20260827.plan.md`
in both the tenant and HQ repositories. Keep this code taxonomy synchronized
with that plan whenever a policy capability, validator rule, or stage-owned
service contract changes.

Paste this into HQ as the validation contract. Every **new** code is `snake_case`.
Legacy compiler-code aliases may be mapped during the coordinated cutover, but
they are not a second validator or runtime authority.

## 1. Severity and gate

| Severity | Meaning |
|----------|---------|
| `error` | Block Check policy, Pilot, and Publish |
| `warn` | Allow those; show bilingual copy and a fix |
| `assign_error` | Check policy may pass; Assign must fail |
| `assign_warn` | Assign may succeed; show impact |

| Gate | When it runs |
|------|----------------|
| `check_policy` | Live normalized rows for the selected saved `policy_revision` |
| `assign` | Tenant / branch / service assignment write |
| `publish` / `pilot` | Lifecycle; validates the same saved `policy_revision` in the command transaction |
| `template_import` | Preview/final import; validates mapped rows before save |

Issue object (target):

```ts
interface WfPolicyIssue {
  code: string
  severity: 'error' | 'warn' | 'assign_error' | 'assign_warn'
  path: string           // e.g. modules.pickup_handover | executions.{id} | initial_rules.{id}
  message_key: string    // HQ i18n key; API does not duplicate EN/AR prose
  hint_key: string       // HQ i18n key for the remediation
  params: Record<string, string | number | boolean>
  source: 'validator' | 'assignment' | 'template_import'
}
```

`ok === issues.filter(i => i.severity === 'error').length === 0` for Check
policy/Pilot/Publish. Assign additionally blocks `assign_error`. The server
always revalidates; a stale browser result is never authorization to proceed.

## 2. Status vs today

| Status | Meaning |
|--------|---------|
| `exists` | Existing code retained or mapped during cutover |
| `extend` | Exists but uniqueness/scope must change |
| `new` | Not coded; add |

---

## 3. Codes — keep (`exists`)

Wire these to Studio fields. Copy may be improved; do not rename codes without a compatibility map.

| Code | Path (typical) |
|------|----------------|
| `profile_policy_missing` | `policy` |
| `profile_no_enabled_modules` | `modules` |
| `unsupported_capability_enabled` | `policy.capabilities.{flag}` for returns, required OTP, or unsupported conditional routing |
| `stage_sequence_blank_status` | `policy.stage_sequence` |
| `stage_sequence_duplicate_status` | `policy.stage_sequence` |
| `module_status_without_enabled_module` | `module_statuses.{id}` |
| `status_owner_not_primary_module` | `module_statuses.{id}` |
| `status_multiple_primary_owners` | `statuses.{status_code}.owners` |
| `execution_binding_duplicate` | `executions` — duplicate parent edge; child channels have their own uniqueness |
| `execution_without_enabled_module` | `executions.{id}` |
| `execution_on_observer_module` | `executions.{id}` |
| `execution_not_from_status_owner` | `executions.{id}` — **extend**: exempt fulfilment observe-and-execute (see §4.3) |
| `execution_status_not_in_stage_sequence` | `executions.{id}` |
| `execution_status_without_owner` | `executions.{id}` |
| `execution_without_channel` | `executions.{id}.channels` |
| `public_channel_execution_forbidden` | `executions.{id}.channels` |
| `public_channel_non_hard_gate_forbidden` | `executions.{id}.gates` |
| `gate_definition_inactive` | `executions.{id}.gates.{gate_code}` |
| `gate_input_schema_version_mismatch` | `executions.{id}.gates.{gate_code}` |
| `gate_warning_not_supported` | `executions.{id}.gates.{gate_code}` |
| `gate_override_not_supported` | `executions.{id}.gates.{gate_code}` |
| `gate_override_permission_inactive` | `executions.{id}.gates.{gate_code}` |
| `gate_override_reason_too_short` | `executions.{id}.gates.{gate_code}` |
| `gate_non_blocking_message_missing` | `executions.{id}.gates.{gate_code}` |
| `initial_rule_missing` | `initial_rules` |
| `initial_rule_status_not_in_stage_sequence` | `initial_rules.{id}` |
| `initial_rule_status_without_owner` | `initial_rules.{id}` |
| `initial_rule_ambiguous` | `initial_rules` |
| `graph_missing_fulfilment_end` | Retained compatibility code; derive from `policy.stage_sequence` / executions rather than a graph artifact |
| `initial_status_unreachable_fulfilment` | `initial_rules.{id}` |
| `pickup_module_missing` | `modules.pickup_handover` |
| `delivery_release_module_missing` | `modules.ready_release` |
| `delivery_module_missing` | `modules.driver_delivery` |
| `public_tracking_module_missing` | `modules.public_tracking` |
| `rack_release_module_missing` | `modules.ready_release` |
| `pickup_policy_without_pickup` | `policy.pickup_*` |
| `delivery_policy_without_delivery` | `policy.delivery_*` |
| `evidence_method_duplicate` | `evidence` |
| `evidence_runtime_unavailable` | `evidence.{id}` |
| `evidence_without_delivery` / `evidence_without_pickup` | `evidence.{id}` |
| `evidence_otp_unsupported` / `evidence_otp_runtime_unavailable` | `evidence` |
| `evidence_minimum_count_invalid` | `evidence.{id}` |
| `execution_evidence_runtime_unavailable` | `executions.{id}` |
| `execution_evidence_policy_missing` | `executions.{id}` |

Each issue must resolve EN/AR through `message_key`, `hint_key`, and `params`.
Retain old compiler detail only in compatibility logging while callers migrate.

---

## 4. Codes — new or extend (implement these)

Severity `error` and gate `check_policy` unless stated. Pilot, Publish,
assignment, and starter import invoke the same validator in their transaction.

### 4.1 Module coupling

#### `pickup_without_ready_release` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.pickup_handover` |
| Trigger | `pickup_handover` enabled (or `pickup_enabled`) and `ready_release` disabled |
| Tenant | No `/dashboard/pickup`. Pickup **card** mounts only on Ready Details. Ready **module** Off means the host page has no release/pickup policy. |
| EN | Counter pickup is enabled but Ready / release is off. Staff have no floor page that can confirm pickup. |
| AR | تم تفعيل تسليم الاستلام مع إيقاف شاشة الجاهز/الإفراج. لا توجد صفحة تشغيل يمكن منها تأكيد الاستلام. |
| Hint | Turn on `ready_release`, or turn off `pickup_handover` and pickup flags. |
| Hint AR | فعّل `ready_release` أو أوقف `pickup_handover` وخصائص الاستلام. |

#### `pickup_handover_missing_for_counter` — **new**

| Field | Value |
|-------|--------|
| Severity | `error` if `pickup_enabled` or pickup evidence/notes exist; else `warn` |
| Path | `modules.pickup_handover` |
| Trigger | Ready On, pickup module Off, but pickup is intended |
| EN | Ready can release work, but counter pickup is not configured. |
| AR | يمكن الإفراج من شاشة الجاهز دون تهيئة تأكيد استلام العميل. |
| Hint | Enable `pickup_handover` with `CONFIRM_PICKUP` and `staff_web`, or disable pickup flags. |

#### `delivery_without_ready_release` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.driver_delivery` |
| Trigger | `driver_delivery` On, `ready_release` Off |
| EN | Driver delivery is on but Ready / release is off. Orders cannot be released for delivery. |
| AR | التوصيل مفعّل مع إيقاف الجاهز/الإفراج. لا يمكن إفراج الطلب للتوصيل. |
| Hint | Enable `ready_release` or disable `driver_delivery`. |

#### `public_tracking_requires_pickup_release` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.public_tracking` |
| Trigger | Public tracking On **and** the public path is released counter pickup, but Ready Off or no `RELEASE_FOR_PICKUP` |
| EN | /track pickup confirm from ready_for_pickup needs an open pickup release. Ready release is missing. Delivery-only public confirm (OFD) does not use this code. |
| AR | تأكيد الاستلام العام يتطلب إفراج استلام مفتوح. مسار الجاهز/الإفراج ناقص. |
| Hint | Enable `ready_release` and `RELEASE_FOR_PICKUP`, or turn public tracking off. |

#### `workboard_must_be_observer` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.workboard` |
| Trigger | `workboard.module_mode` is not `observer` |
| EN | Workboard must be an observer. It cannot own or execute workflow commands. |
| AR | لوحة العمل للعرض فقط. لا يجوز أن تملك الحالة أو تنفّذ أوامر سير العمل. |
| Hint | Set module mode to `observer`. |

#### `module_without_status_membership` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.{screen_key}` |
| Trigger | Module enabled, zero active status memberships |
| EN | Module `{screen}` is enabled but owns or observes no status. The tenant worklist will stay empty. |
| AR | الوحدة `{screen}` مفعّلة دون أي حالة. ستبقى قائمة العمل فارغة. |
| Hint | Add owner or observer memberships, or disable the module. |

#### `owner_module_without_execution` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.{screen_key}` |
| Trigger | `primary_owner` enabled with no active executable |
| EN | Owner module `{screen}` has no action. Plant/Ready ActionBar will be empty; pickup and delivery show a not-configured card instead. |
| AR | وحدة المالك `{screen}` بلا إجراء. سيظهر شريط إجراءات فارغ. |
| Hint | Bind at least one action + channel, or disable the module. |

#### `disabled_stage_without_skip_edge` — **new**

| Field | Value |
|-------|--------|
| Path | `policy.stage_sequence` / `executions` |
| Trigger | Optional stage in sequence is module-Off, previous owner has no skip-ahead exec to the next enabled owner |
| EN | Stage `{status}` is in the sequence but its module is off, and there is no skip action from `{from_module}`. |
| AR | المرحلة `{status}` ضمن التسلسل ووحدتها موقوفة، ولا يوجد إجراء تخطٍ من `{from_module}`. |
| Hint | Add exactly one skip execution, or remove the status from the sequence. |

#### `core_processing_missing` — **new**

| Field | Value |
|-------|--------|
| Severity | `error` by default; `warn` if profile is tagged retail-only (explicit policy flag) |
| Path | `policy.stage_sequence` |
| Trigger | `processing` not in sequence |
| EN | Core processing is missing from the stage sequence. |
| AR | مرحلة المعالجة الأساسية غير موجودة في تسلسل المراحل. |
| Hint | Add `processing`, or mark the profile as retail-only if that is intentional. |

### 4.2 Channel, permission, legacy actions

#### `staff_web_channel_missing` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.channels` |
| Trigger | Exec on a staff floor owner (`preparation`, `processing`, `assembly`, `qa`, `packing`, `ready_release`, `pickup_handover`, `driver_delivery`) without `staff_web` |
| EN | Floor action `{action}` has no staff_web channel. Tenant will hide the ActionBar command or the pickup/delivery card (notConfigured). |
| AR | إجراء التشغيل `{action}` بلا قناة staff_web. سيُخفى أمر الشريط أو بطاقة الاستلام/التوصيل. |
| Hint | Add `staff_web`, or document that this profile is mobile/API-only (then Warn, not Error, only if product agrees). |

#### `public_web_channel_missing` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.channels` |
| Trigger | Public tracking confirm exec without `public_web` |
| EN | Public confirm has no public_web channel. `/track` cannot confirm received. |
| AR | تأكيد التتبع العام بلا قناة public_web. لا يمكن التأكيد من صفحة التتبع. |
| Hint | Add `public_web` to that execution. |

#### `execution_binding_duplicate` — **extend**

An execution parent is unique by
`version_id + screen_key + from_status + action_code + to_status`. Child
channels are unique by `execution_id + channel_code`. One execution may expose
several legitimate channels (`staff_web`, `mobile`, `api`); do not duplicate its
parent row per channel.

#### `execution_permission_invalid` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.permission_code` |
| Trigger | Missing, unknown, or inactive `sys_auth_permissions_cd` row |
| EN | Action `{action}` references an invalid permission `{code}`. |
| AR | الإجراء `{action}` يشير إلى صلاحية غير صالحة `{code}`. |
| Hint | Use a live `resource:action` permission or clear the field if the stage adapter uses `orders:transition` only. |

#### `legacy_mark_ready_forbidden` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | `action_code = MARK_READY` |
| EN | MARK_READY is retired. Use stage complete, Ready release, or pickup_handover CONFIRM_PICKUP. |
| AR | MARK_READY لم يعد مستخدماً. استخدم إكمال المرحلة أو الإفراج أو تأكيد الاستلام. |
| Hint | Remove the binding. |

#### `return_action_not_supported` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` / `modules.returning` |
| Trigger | Return exec or `returning` enabled while returns capability is unsupported (V1.1 not shipped) |
| EN | Return is not supported until V1.1. This execution cannot be published. |
| AR | الإرجاع غير مدعوم حتى الإصدار V1.1. لا يمكن نشر هذا الإجراء. |
| Hint | Disable `returning` and return actions. |

#### `invalid_cross_cutting_module` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.{screen_key}` |
| Trigger | `cross_cutting_command` on anything other than `canceling`, `order_control`, `public_tracking` |
| EN | `{screen}` cannot be a cross-cutting command module. |
| AR | لا يجوز أن تكون `{screen}` وحدة أوامر عابرة. |
| Hint | Use `primary_owner` or `observer`. |

#### `terminal_status_forward_action` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | from_status in `delivered`, `closed`, `cancelled`, `returned` with a normal forward plant action |
| EN | Terminal status `{status}` cannot have a forward plant action. |
| AR | الحالة النهائية `{status}` لا تقبل إجراء تقدم تشغيلي. |
| Hint | Remove the execution. Exception commands belong in V1.1+ return/control policy. |

### 4.3 Fulfilment semantics

#### `execution_not_from_status_owner` — **extend**

Keep for ordinary plant stages. **Do not** emit it for:

- `CONFIRM_PICKUP` on `pickup_handover` from `ready` when pickup has observer membership for `ready` (direct counter).
- `CONFIRM_DELIVERY` on `public_tracking` from `out_for_delivery` (`cross_cutting_command`; already skipped because the module is not `primary_owner`).

Wrong operator fix today: move `CONFIRM_PICKUP` onto `ready_release`. Tenant pickup complete will still execute `pickup_handover` and fail. HQ preset `wf-semantic-profile-presets.ts` currently does that dodge for direct pickup — change the preset, not the tenant screen_key.

If observer membership is missing, emit `direct_pickup_from_ready_not_declared` instead of `execution_not_from_status_owner`.

#### `pickup_action_on_wrong_module` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | `CONFIRM_PICKUP` bound on a screen other than `pickup_handover` |
| EN | Confirm pickup must be owned by pickup_handover, not `{screen}`. The Ready page can still host the pickup card; the executable screen_key must stay pickup_handover. |
| AR | تأكيد الاستلام يجب أن تملكه وحدة pickup_handover وليس `{screen}`. صفحة الجاهز يمكن أن تعرض بطاقة الاستلام، لكن مفتاح الشاشة التنفيذي يبقى pickup_handover. |
| Hint | Do not move CONFIRM_PICKUP onto ready_release just because the UI sits on Ready Details. Enable pickup_handover and bind CONFIRM_PICKUP there. |

#### `delivery_action_on_wrong_module` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | Staff `CONFIRM_DELIVERY` not on `driver_delivery`; public confirm not on `public_tracking` |
| EN | Confirm delivery is bound to the wrong module `{screen}`. Staff complete uses driver_delivery; /track uses public_tracking. Delivery Details can host the card; the executable screen_key must match the caller. |
| AR | تأكيد التوصيل مربوط بوحدة خاطئة `{screen}`. تأكيد الموظف يستخدم driver_delivery؛ صفحة التتبع تستخدم public_tracking. |
| Hint | Do not bind staff CONFIRM_DELIVERY onto ready_release. Same action code, two modules, two channels. |

#### `release_action_on_wrong_module` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | `RELEASE_FOR_PICKUP` / `RELEASE_FOR_DELIVERY` not on `ready_release` |
| EN | Release actions must be owned by ready_release, even when the pickup card is rendered on Ready Details. |
| AR | إجراءات الإفراج يجب أن تملكها ready_release حتى لو ظهرت بطاقة الاستلام على صفحة الجاهز. |
| Hint | Pickup module confirms handover; it does not own RELEASE_FOR_PICKUP. |

#### `delivery_stop_gate_on_simple_profile` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.gates` |
| Trigger | `delivery_stop_active` bound while profile policy does not require stops (`delivery_stop_required` false / unset) |
| EN | Stop-active gate is bound on a simple delivery profile. Floor confirm will always block for missing stop. |
| AR | بوابة التوقف مربوطة على ملف توصيل بسيط. سيُحظر التأكيد دائماً لعدم وجود توقف. |
| Hint | Remove `delivery_stop_active`, or turn on routed-delivery policy and POD evidence. |

#### `staff_delivery_execution_missing` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.driver_delivery` |
| Trigger | Delivery module On without `CONFIRM_DELIVERY` + `staff_web` |
| EN | Driver delivery is on but staff cannot confirm delivery (delivery card, not a missing /dashboard/delivery page). |
| AR | توصيل السائق مفعّل دون إجراء تأكيد بقناة staff_web. |

#### `routed_delivery_evidence_incomplete` — **new**

| Field | Value |
|-------|--------|
| Severity | `error` if any method is required; else `warn` |
| Path | `evidence` / `executions.{CONFIRM_DELIVERY}` |
| Trigger | Routed profile (stop gate On) without normalized executable POD methods / `pod_evidence_valid` |
| EN | Routed delivery has no executable proof-of-delivery evidence. |
| AR | التوصيل الموجّه بلا إثبات تسليم قابل للتنفيذ. |

#### `generic_requires_evidence_forbidden` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | `requires_evidence = true` on an exec (generic flag) |
| EN | Generic requires_evidence is not supported. Tenant returns EVIDENCE_RUNTIME_UNAVAILABLE. Use normalized evidence rows and pod_evidence_valid. |
| AR | خيار requires_evidence العام غير مدعوم. استخدم صفوف الإثبات المهيكلة وبوابة pod_evidence_valid. |

#### `pickup_execution_missing` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.pickup_handover` |
| Trigger | Pickup module On without `CONFIRM_PICKUP` from `ready` and/or `ready_for_pickup` |
| EN | Pickup module is on but CONFIRM_PICKUP is not bound from a ready status. |
| AR | وحدة الاستلام مفعّلة دون ربط CONFIRM_PICKUP من حالة جاهز. |

#### `direct_pickup_from_ready_not_declared` — **new**

| Field | Value |
|-------|--------|
| Path | `module_statuses` for `pickup_handover` |
| Trigger | `CONFIRM_PICKUP` from `ready` but pickup does not observe `ready` |
| EN | Direct counter pickup from ready is not declared on the pickup module. |
| AR | الاستلام المباشر من حالة ready غير معلن على وحدة الاستلام. |
| Hint | Add observer (or documented direct-handover) membership for `ready` on `pickup_handover`. |

#### `public_pickup_requires_release_path` — **new**

| Field | Value |
|-------|--------|
| Path | `modules.public_tracking` |
| Trigger | Public tracking + pickup On, no `RELEASE_FOR_PICKUP` path |
| EN | /track cannot confirm counter pickup from ready. It needs a staged ready_for_pickup release. Do not bind CONFIRM_PICKUP onto public_tracking. |
| AR | صفحة التتبع لا تؤكد الاستلام من حالة ready. يلزم إفراج إلى ready_for_pickup. لا تربط CONFIRM_PICKUP بوحدة public_tracking. |

#### `public_cannot_own_pickup_action` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}` |
| Trigger | `CONFIRM_PICKUP` bound on `public_tracking` |
| EN | Public tracking must not own CONFIRM_PICKUP. Released-pickup /track calls the pickup service, which still executes pickup_handover. |
| AR | التتبع العام لا يملك CONFIRM_PICKUP. تأكيد الاستلام المفرج عبر /track يستدعي خدمة الاستلام على pickup_handover. |

#### `evidence_otp_optional_dead` — **new** (`warn`)

| Field | Value |
|-------|--------|
| Path | `evidence` |
| Trigger | OTP listed optional alongside other methods |
| EN | OTP can be listed but tenant completion always rejects OTP until a verifier exists. |
| AR | يمكن إدراج OTP لكن التنفيذ يرفضه حتى يتوفر محقّق. |

### 4.4 Initial rules

#### `initial_rule_uncovered_create_path` — **new**

| Field | Value |
|-------|--------|
| Path | `initial_rules` |
| Trigger | At least one required create context (see file 01 §3.D) has no matching rule |
| EN | No initial rule covers `{context}` (source={source}, retail={r}, quick_drop={q}, remote={remote}). Order create will return PROFILE_INITIAL_RULE_UNMATCHED. |
| AR | لا توجد قاعدة بداية تغطي السياق `{context}`. إنشاء الطلب سيفشل بـ PROFILE_INITIAL_RULE_UNMATCHED. |
| Hint | Add a catch-all rule or a specific matcher for that context. |

#### `initial_rule_no_winner` / `initial_rule_multiple_winners` — **new**

Per **context**, not only same-priority overlap (that remains `initial_rule_ambiguous`).

| Field | Value |
|-------|--------|
| Path | `initial_rules` |
| EN (none) | No unique initial-rule winner for `{context}`. |
| EN (many) | Multiple initial-rule winners for `{context}`. |
| AR | لا يوجد فائز وحيد لقاعدة البداية في السياق `{context}`. / يوجد أكثر من فائز. |

#### `initial_status_closed_forbidden` — **new**

| Field | Value |
|-------|--------|
| Path | `initial_rules.{id}` |
| Trigger | `initial_status = closed` |
| EN | Orders must not start as closed. Retail is not auto-closed. |
| AR | لا يجوز أن يبدأ الطلب بحالة closed. التجزئة لا تُغلق تلقائياً. |

#### `initial_status_fulfilment_forbidden` — **new**

| Field | Value |
|-------|--------|
| Path | `initial_rules.{id}` |
| Trigger | Initial status `out_for_delivery` or `delivered` (except an explicit HQ demo flag, if product adds one) |
| EN | Initial status cannot be a fulfilment terminal. |
| AR | حالة البداية لا يجوز أن تكون نهاية استيفاء. |

### 4.5 Transition reachability and optional-stage routing

#### `partial_pickup_runtime_unavailable` / `partial_delivery_runtime_unavailable` — **new**

| Field | Value |
|-------|--------|
| Path | `policy.capabilities.partial_pickup` / `policy.capabilities.partial_delivery` |
| Trigger | The capability is enabled but the corresponding stage-owned service cannot atomically validate piece selection, collection/evidence gates, fulfilment record, status change, and audit. |
| EN | Partial fulfilment is enabled but its atomic operational service is not available. |
| AR | تم تفعيل التسليم الجزئي ولكن خدمة التشغيل الذرية الخاصة به غير متاحة. |
| Hint | Disable the capability or finish the dedicated pickup/delivery partial-fulfilment service and its tests. |

#### `optional_stage_skip_ambiguous` — **new**

| Field | Value |
|-------|--------|
| Path | `executions` of previous owner |
| Trigger | Optional module Off; more than one skip target from previous owner |
| EN | Disabled stage `{status}` has more than one skip destination from `{from_screen}`. |
| AR | المرحلة المعطّلة `{status}` لها أكثر من وجهة تخطٍ من `{from_screen}`. |
| Hint | Keep exactly one skip execution to the next enabled owner. |

#### `optional_stage_skip_missing` — **new**

Opposite of ambiguous: zero skip targets.

#### `enabled_stage_unreachable` — **new**

| Field | Value |
|-------|--------|
| Path | `policy.stage_sequence` / `statuses.{code}` |
| Trigger | Enabled owned status never reachable from any initial (current BFS is only initial→fulfilment) |
| EN | Status `{status}` is enabled but unreachable from every initial rule. |
| AR | الحالة `{status}` مفعّلة لكن لا يمكن الوصول إليها من أي قاعدة بداية. |

#### `illegal_cycle` — **new**

| Field | Value |
|-------|--------|
| Path | `executions` |
| Trigger | Cycle that is not QA fail→rework or hold→resume |
| EN | Illegal cycle involving `{statuses}`. |
| AR | حلقة غير مسموحة تشمل `{statuses}`. |

#### `back_step_forbidden_by_policy` — **new**

| Field | Value |
|-------|--------|
| Path | `policy.allow_back_steps` / `executions.{id}` |
| Trigger | `allow_back_steps=false` and exec moves to an earlier sequence index |
| EN | Back steps are disabled but execution `{action}` moves backward. |
| AR | الرجوع معطّل لكن الإجراء `{action}` يعود للخلف. |

### 4.6 Gates

#### `gate_evaluator_missing` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.gates.{gate_code}` |
| Trigger | Catalog row exists but tenant has no evaluator (or unknown code) |
| EN | Gate `{gate}` has no tenant evaluator. Runtime returns GATE_RUNTIME_UNAVAILABLE. |
| AR | البوابة `{gate}` بلا مقيّم في تطبيق المستأجر. |

#### `gate_requires_disabled_module` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.gates.{gate_code}` |
| Trigger | e.g. `qa_passed` while `qa` Off; piece gates while piece tracking Off; `prep_stage_complete` while prep Off; `delivery_stop_active` while delivery Off |
| EN | Gate `{gate}` requires module `{module}`, which is off. Orders will block forever. |
| AR | البوابة `{gate}` تتطلب الوحدة `{module}` وهي موقوفة. سيُحظر الطلب دائماً. |

#### `fulfilment_missing_collection_gate` — **new**

| Field | Value |
|-------|--------|
| Severity | Product choice: `error` if profile documents PAY_ON_COLLECTION; else `warn` |
| Path | `executions` for release / pickup / delivery |
| Trigger | Those execs lack `fin_release_eligible` |
| EN | Fulfilment action `{action}` has no collection / finance-release gate. |
| AR | إجراء الاستيفاء `{action}` بلا بوابة مالية/تحصيل. |

#### `rack_gate_wrong_action` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.gates` |
| Trigger | `rack_required` on an action that is not a Ready release |
| EN | rack_required must bind to a Ready release action. |
| AR | يجب ربط rack_required بإجراء إفراج الجاهز. |

#### `gate_parameters_invalid` — **new**

| Field | Value |
|-------|--------|
| Path | `executions.{id}.gates.{gate_code}.parameters` |
| Trigger | `parameters_json` fails catalog JSON Schema (today only schema **version** is checked) |
| EN | Gate `{gate}` parameters do not match the catalog schema. |
| AR | معاملات البوابة `{gate}` لا تطابق مخطط الكتالوج. |

#### `override_permission_not_in_tenant_roles` — **new** (`assign_warn`)

| Field | Value |
|-------|--------|
| Gate | `assign` |
| Path | `executions.{id}.gates.{gate_code}` |
| Trigger | Override permission not granted to any role of the target tenant |
| EN | Override permission `{code}` is not granted to this tenant’s roles. Staff cannot complete override gates. |
| AR | صلاحية التجاوز `{code}` غير ممنوحة لأدوار هذا المستأجر. |

### 4.7 Assignment

#### `assign_scope_conflict` — **exists in spirit** (`PROFILE_ASSIGNMENT_SCOPE_CONFLICT`) — keep **assign_error**

Two active rows at the same tenant + branch + service.

#### `assign_duplicate_tenant_default` — **new** (`assign_error`)

Two `is_default` rows at tenant scope (null branch, null service).

EN: Two default assignments exist for this tenant.
AR: يوجد تعيينان افتراضيان لهذا المستأجر.

#### `assign_service_scope_never_used` — **new** (`assign_warn`)

Service code on assignment is not in the tenant catalog / never ordered.

#### `assign_mixed_service_split_required` — **new** (`assign_warn`)

Different profiles per service. Mixed carts will return `PROFILE_SERVICE_SCOPE_CONFLICT`.

#### `assign_pilot_not_demo_tenant` — **exists in DB/runtime** — surface as **assign_error** in Studio

#### `assign_missing_published_for_unpinned` — **exists** — keep

#### `assign_policy_invalid` — **new** (`assign_error`)

| Field | Value |
|-------|--------|
| Path | `version_id` / validation result |
| Trigger | The selected version has blocking live-policy issues or is not lifecycle eligible for this assignment |
| EN | This version cannot be assigned because its live workflow policy is incomplete or unavailable. Tenant order creation would fail closed. |
| AR | لا يمكن تعيين هذا الإصدار لأن سياسة سير العمل الحية غير مكتملة أو غير متاحة. سيفشل إنشاء الطلب بأمان. |
| Hint | Resolve blocking Check policy issues, save the policy, then assign an eligible Pilot or Published version. |

#### `assign_does_not_move_open_orders` — **new** (`assign_warn`)

EN: `{n}` open orders stay on profile {p} version {v}. Reassignment affects new orders only.
AR: `{n}` طلبات مفتوحة تبقى على الملف {p} الإصدار {v}. إعادة التعيين تؤثر على الطلبات الجديدة فقط.

### 4.8 Dirty policy / flags

#### `policy_check_stale` — **new** (`warn` in UI; server rechecks on every protected write)

Trigger: the browser displays validation for a revision older than the saved
`policy_revision`.

EN: Policy changed after the last successful check. Run Check policy again.
AR: تغيّرت السياسة بعد آخر فحص ناجح. أعد فحص السياسة.

This is not a server-side bypass: Pilot, Publish, assignment, and template
import always validate live rows inside their own transaction.

#### `policy_flag_without_runtime_surface` — **new** (`error`)

Trigger: HQ flag On (`pickup_enabled`, `delivery_enabled`, `public_tracking_enabled`, `require_rack_before_release`, …) but corresponding module/exec is missing.

Note: tenant TypeScript currently ignores many flags and reads modules/execs/gates only. Flags must not look like a second runtime.

---

## 5. Implementation notes for HQ

1. Add severity and structured i18n keys to validator issues. Warn codes must
   not block valid lean shops (`canceling` Off, `returning` Off).
2. Run **create-path matrix** as data, not prose: list of contexts in, winner rule id out.
3. Run **archetypes** as fixtures: Lean plant must fail `pickup_without_ready_release`.
4. Return message/hint keys plus parameters; Studio resolves bilingual copy and
   does not hardcode English.
5. Emit these codes from `WorkflowPolicyValidator` directly from normalized
   rows, with no artifact, compiler commit, or runtime fallback.
6. Do not lower tenant fail-closed behaviour to “make Studio green”. If a combo is illegal at runtime, it is `error` here.
7. Fix HQ **presets** so direct `CONFIRM_PICKUP` is always `pickup_handover` + observer `ready`, never `ready_release`. Stop using `CONFIRM_PICKUP:pickup_handover:ready:ready_release` as the “move it to the owner” example.
8. Studio copy: “wrong module” means `screen_key`, not “wrong dashboard page”.
9. When partial fulfilment is enabled, require an implemented atomic
   stage-service contract; otherwise emit `partial_pickup_runtime_unavailable`
   or `partial_delivery_runtime_unavailable` as a blocking issue.

## 6. Highest-value first (HQ sprint order)

1. `pickup_without_ready_release`
2. `execution_not_from_status_owner` exception + stop binding `CONFIRM_PICKUP` to `ready_release` in presets
3. `staff_web_channel_missing`
4. `legacy_mark_ready_forbidden`
5. `initial_rule_uncovered_create_path` + per-context winner
6. `generic_requires_evidence_forbidden`
7. `delivery_stop_gate_on_simple_profile`
8. `assign_policy_invalid`
9. Parent/channel-aware `execution_binding_duplicate`
10. Skip-edge missing/ambiguous
11. Gate requires disabled module
