# UI/UX Design Rules

Guidelines for designing intuitive, scalable, and accessible interfaces for CleanMateX.

## Layout & Structure

- Use a **dashboard-first layout** with clear separation between admin and customer views
- Prioritize **modular components**: cards, tables, filters, and action panels
- Maintain consistent spacing, padding, and grid alignment across all screens

## Navigation

- Use **sidebar navigation** for desktop and **bottom tab bar** for mobile
- Include breadcrumb trails for nested views
- Highlight active routes and provide back navigation on all subpages

## Visual Hierarchy

- Use **typography scale** to differentiate headings, labels, and body text
- Apply **color contrast** to emphasize primary actions and alerts
- Group related actions visually (e.g., batch actions, filters, export buttons)

## Accessibility

- Ensure **WCAG 2.1 AA compliance** for contrast, keyboard navigation, and screen reader support
- Use semantic HTML tags and `aria-*` attributes
- Avoid color-only indicators; pair with icons or labels

## Responsiveness

- Design for **mobile-first**, then scale up to tablet and desktop
- Use `flexbox` and `grid` for adaptive layouts
- Test across breakpoints: 320px, 768px, 1024px, 1440px

## Feedback & States

- Show **loading indicators** for async actions
- Use toast/snackbar for success and error messages
- Include empty states with helpful prompts and icons

## Forms & Inputs

- Use floating labels or placeholders, never both
- Validate inputs inline with clear error messages
- Group related fields and use progressive disclosure for complex forms

## Branding & Theme

- Apply CleanMateX brand colors, fonts, and iconography consistently
- Support **dark mode** and **RTL layout** via global theme toggles
- Store theme config in `ui/theme.ts`

## Microinteractions

- Animate transitions subtly (e.g., fade, slide)
- Use hover and focus states for buttons and inputs
- Provide visual feedback on drag-and-drop, toggles, and switches

## RTL Support

For Arabic (right-to-left):

```tsx
// Direction-aware spacing
<div className="ml-4 rtl:ml-0 rtl:mr-4">Content</div>

// Direction-aware alignment
<div className="text-left rtl:text-right">Text</div>

// Direction-aware icons
<ChevronRight className="rtl:rotate-180" />
```

## Documentation

- Document all components in Storybook
- Include usage examples, props, and accessibility notes
- Sync design tokens with Figma via plugin or JSON export
