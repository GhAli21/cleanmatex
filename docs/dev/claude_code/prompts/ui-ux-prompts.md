# UI / UX Prompts

## See Also

- [Prompt Pack Index](./index.md)
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
- [Build Prompts](./build-prompts.md)
- [Review Prompts](./review-prompts.md)
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)

## 1. UI/UX Design Prompt

Use when: You are creating a new screen, module, or surface and want UI guidance that can actually be built here.

Tip: Pair this with the Design System prompt when you want the answer to stay even closer to existing Cmx patterns.

```md
Your task is to design a premium, modern, responsive SaaS UI/UX for `[screen/module]` in CleanMateX.

Create implementation-ready UI guidance grounded in this repository's existing design system, layout patterns, and frontend constraints. Do not give generic design advice or abstract visual commentary. Design something that can be built directly in this codebase.

Cover:
- page layout and information hierarchy
- desktop, tablet, and mobile behavior
- navigation placement and user flow
- form structure, tables, filters, actions, dialogs, and feedback patterns
- loading, empty, error, success, and disabled states
- validation behavior and inline help text
- accessibility expectations, keyboard flow, and screen-reader considerations
- EN/AR i18n impact and RTL-safe layout behavior
- permission-aware UI states where actions or data may be gated
- developer-ready implementation notes tied to existing components and patterns

Required constraints:
- use Cmx components only
- do not use raw HTML controls in feature code
- preserve existing repository UI conventions unless improvement is clearly justified
- keep the UI responsive, accessible, and operationally practical
- prefer reusable patterns over one-off visual treatments
- identify missing states, edge cases, and UX risks
- include the expected message keys if new UI copy is needed

Output should be structured, specific, and ready for implementation in this repository.
```

## 2. Screen UX Review Prompt

Use when: A screen already exists and you want a practical UX critique with improvement direction.

Tip: This is stronger than the UI Design prompt when the real goal is critique, prioritization, and refinement rather than inventing a screen from scratch.

```md
Your task is to review the `[Screen Name]` screen in CleanMateX and recommend better UI/UX with implementation-ready guidance.

Evaluate the screen as an enterprise SaaS product surface, grounded in this repository's current patterns, design system, and operational workflows. Do not give generic design feedback. Focus on practical improvements that can be implemented in this codebase.

Review from these perspectives:
- information hierarchy and layout clarity
- usability and workflow efficiency
- visual consistency with existing Cmx patterns
- spacing, grouping, alignment, and readability
- accessibility and keyboard/screen-reader behavior
- responsiveness across desktop, tablet, and mobile
- missing states, missing actions, and unclear feedback
- empty, loading, error, disabled, and success states
- permission-aware UI behavior
- EN/AR and RTL-safe layout behavior
- scalability of the screen as data, actions, and roles grow

Required behavior:
- identify weak points, friction areas, and workflow bottlenecks
- explain why each issue matters
- suggest concrete improvements, not abstract design opinions
- recommend layout, component, hierarchy, copy, spacing, and interaction changes that fit CleanMateX
- prefer reusable Cmx-based patterns over one-off visual ideas
- include developer-ready notes where implementation implications are important

Output should be structured, prioritized, and ready for implementation or design refinement in this repository.
```

## 3. Screen Redesign Prompt

Use when: A screen exists but needs meaningful redesign without changing its core business purpose.

Tip: Use this instead of the general UI prompt when the main goal is improvement, not greenfield design.

```md
Your task is to redesign the `[Screen Name]` screen in CleanMateX for better clarity, usability, responsiveness, and workflow efficiency.

Preserve the business purpose and existing repository constraints, but improve layout, hierarchy, spacing, actions, feedback states, and overall usability. Use Cmx patterns only and keep the result implementation-ready for this codebase.

Focus on:
- clearer information hierarchy
- better grouping and spacing
- simpler action flow
- stronger empty, loading, error, and success states
- responsive desktop, tablet, and mobile behavior
- EN/AR and RTL-safe layout
- accessibility and keyboard flow
- reusable Cmx-based implementation direction

Output should prioritize concrete redesign recommendations that can be built in this repository.
```

## 4. Interaction / Flow UX Prompt

Use when: The core problem is workflow friction rather than screen visuals.

Tip: This is ideal for order creation, payments, approvals, onboarding, multi-step forms, and stateful operational flows.

```md
Your task is to review and improve the UX flow for `[flow name]` in CleanMateX.

Focus on task efficiency, decision clarity, friction points, state transitions, validation timing, error recovery, and user confidence. Do not focus only on visuals. Optimize the end-to-end workflow so it feels clear, fast, and reliable for real users.

Cover:
- step sequence and flow logic
- unnecessary friction or repeated actions
- unclear choices or weak feedback
- validation and error recovery behavior
- loading and intermediate states
- role and permission-aware flow differences
- mobile and RTL considerations

Output should be structured as implementation-ready UX flow improvements for this repository.
```

## 5. Accessibility Review Prompt

Use when: You want a focused accessibility pass instead of a broad UX review.

Tip: This is especially useful after UI changes, before release, or when forms, dialogs, and tables are involved.

```md
Your task is to review `[screen/module]` in CleanMateX for accessibility readiness.

Evaluate the implementation or design for keyboard access, focus behavior, labeling, semantics, contrast, screen-reader clarity, error messaging, target sizes, and state communication. Focus on practical issues in this codebase, not generic WCAG summaries.

Required behavior:
- identify confirmed accessibility issues and likely risks
- explain why each issue matters in real usage
- recommend concrete, implementation-ready fixes
- include EN/AR and RTL implications where relevant

Output should list practical accessibility findings and fixes for this repository.
```

## 6. Responsive / Mobile UX Prompt

Use when: A screen is functional on desktop but may break down across smaller breakpoints or touch usage.

Tip: This is particularly strong for tables, dashboards, filter-heavy screens, and action-dense operational pages.

```md
Your task is to review `[screen/module]` in CleanMateX for responsive and mobile UX quality.

Assess how the screen should adapt across desktop, tablet, and mobile while preserving usability, hierarchy, actions, readability, and workflow efficiency. Recommend implementation-ready responsive behavior using existing repository patterns.

Cover:
- layout adaptation across breakpoints
- action placement and discoverability
- overflow handling and content density
- table, filter, and form behavior on smaller screens
- dialog, drawer, and navigation behavior
- touch-target usability and scrolling ergonomics
- EN/AR and RTL-safe responsiveness

Output should be structured as implementation-ready responsive UX recommendations for this repository.
```

## 7. Design System / Component Selection Prompt

Use when: You want the UI to stay consistent with the design system and avoid inventing one-off components.

Tip: This is very useful before implementation when you are not sure whether something belongs in feature UI or reusable Cmx UI.

```md
Your task is to design the UI for `[screen/module]` in CleanMateX using the most appropriate reusable Cmx patterns.

Recommend the right component structure, page sections, feedback surfaces, form patterns, table patterns, and dialog patterns so the screen stays consistent with the repository's design system and avoids one-off UI.

Required behavior:
- prefer reusable Cmx-based patterns over custom one-off components
- preserve existing repository conventions unless improvement is clearly justified
- include developer-ready implementation notes where component choice affects architecture or reuse
- consider accessibility, RTL, and permission-aware states in the recommendation

Output should be implementation-ready and explicitly grounded in existing Cmx patterns.
```

## 8. UX Copy / Microcopy Prompt

Use when: The UI mostly works but the wording, labels, messages, or helper text feel weak.

Tip: This is high-value for modals, payment flows, confirmations, validation messages, and empty/error states.

```md
Your task is to improve the UX copy and microcopy for `[screen/module/flow]` in CleanMateX.

Review labels, helper text, validation messages, action names, empty states, confirmations, and error messages for clarity, confidence, brevity, and operational usefulness. Keep the copy enterprise-ready, bilingual-friendly, and implementation-ready for EN/AR localization.

Required behavior:
- identify unclear, weak, or overly technical copy
- suggest clearer wording that improves user confidence and task completion
- keep labels and messages concise and actionable
- note where new i18n keys or namespace updates would be needed

Output should be structured as implementation-ready microcopy improvements for this repository.
```
