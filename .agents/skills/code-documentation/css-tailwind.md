# CSS / Tailwind Annotation Rules

---

## When to Comment Tailwind Classes

**Comment when:**
- A `className` has **more than 5 classes** and the visual intent isn't obvious
- Any `rtl:` or `ltr:` variant is used — always comment these
- A custom CSS property (`var(--cmx-*)`) is set or referenced
- An `@layer` block is defined
- A class overrides a component default in a non-obvious way

**Skip comments when:**
- The class group is simple and self-evident (e.g. `className="flex"`, `className="w-full mt-4"`)
- The class name is the same as the intent (e.g. `text-center`, `hidden`)

---

## Complex Class Group (>5 classes) — Add Intent Comment

```tsx
{/* Card header: flex row, baseline-aligned, padded for visual breathing room */}
<div className="flex flex-row items-baseline gap-3 px-4 py-3 border-b border-cmx-border">

{/* Sidebar nav item: full-width, flex with icon, hover highlight, active state */}
<li className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cmx-surface-hover data-[active=true]:bg-cmx-primary/10">
```

The comment format: `{/* [element role]: [layout intent] */}`

---

## RTL-Specific Classes (Always Comment)

Every `rtl:` or `ltr:` variant must have an inline comment explaining the layout flip:

```tsx
{/* Icon flips to left side in RTL (Arabic) layout */}
<ChevronRight className="ml-2 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />

{/* Text alignment flips for Arabic reading direction */}
<p className="text-left rtl:text-right text-cmx-muted">

{/* Border moves from left to right side in RTL */}
<div className="border-l-4 rtl:border-l-0 rtl:border-r-4 border-cmx-primary pl-3 rtl:pl-0 rtl:pr-3">
```

---

## Custom CSS Property (Always Comment)

```css
:root {
  /* Primary brand hue — change only via design token update, not per-component */
  --cmx-primary-rgb: 30 64 175;

  /* Sidebar width — shared between AppShell layout and mobile overlay drawer */
  --cmx-sidebar-width: 16rem;

  /* Card border radius — matches Cmx Design System specification */
  --cmx-radius-card: 0.5rem;
}
```

---

## @layer Blocks (Always Comment)

```css
@layer base {
  /* Base resets: direction inheritance, font stack, scrollbar normalization */
}

@layer components {
  /* Cmx Design System composite classes — prefer CmxComponent TSX over these when possible */
}

@layer utilities {
  /* One-off utility overrides not available in Tailwind defaults */
}
```

---

## Conditional Class Logic

When using `cn()` with conditional classes, comment non-obvious conditions:

```tsx
<div
  className={cn(
    'flex items-center gap-2',
    // Highlight row when order is overdue (past expected delivery date)
    isOverdue && 'bg-red-50 border-red-200',
    // Dim row when order is archived — not a workflow state, just visual de-emphasis
    isArchived && 'opacity-50',
  )}
>
```

---

## Animation / Transition Classes

```tsx
{/* Fade in on mount — delay matches sidebar slide-in so content appears together */}
<main className="transition-opacity duration-300 delay-150 opacity-0 data-[loaded=true]:opacity-100">
```

---

## What NOT to Comment

```tsx
{/* BAD: Obvious — className speaks for itself */}
{/* Full-width container */}
<div className="w-full">

{/* BAD: Restates class names */}
{/* Flex row with gap */}
<div className="flex flex-row gap-4">
```
