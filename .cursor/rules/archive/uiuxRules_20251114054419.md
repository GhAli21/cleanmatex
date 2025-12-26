# UI/UX Design Rules

## Overview
Guidelines for designing intuitive, scalable, and accessible interfaces.

## Rules

### Layout & Structure
- Use dashboard-first layout with clear separation between admin and customer views
- Prioritize modular components: cards, tables, filters, action panels
- Maintain consistent spacing, padding, and grid alignment

### Navigation
- Use sidebar navigation for desktop and bottom tab bar for mobile
- Include breadcrumb trails for nested views
- Highlight active routes and provide back navigation

### Visual Hierarchy
- Use typography scale to differentiate headings, labels, and body text
- Apply color contrast to emphasize primary actions and alerts
- Group related actions visually

### Accessibility
- Ensure WCAG 2.1 AA compliance for contrast, keyboard navigation, and screen readers
- Use semantic HTML tags and `aria-*` attributes
- Avoid color-only indicators; pair with icons or labels

### Responsiveness
- Design mobile-first, then scale up to tablet and desktop
- Use flexbox and grid for adaptive layouts
- Test across breakpoints: 320px, 768px, 1024px, 1440px

### Feedback & States
- Show loading indicators for async actions
- Use toast/snackbar for success and error messages
- Include empty states with helpful prompts and icons

### Forms & Inputs
- Use floating labels or placeholders, never both
- Validate inputs inline with clear error messages
- Group related fields and use progressive disclosure

### Branding & Theme
- Apply CleanMateX brand colors, fonts, and iconography consistently
- Support dark mode and RTL layout via global theme toggles
- Store theme config in `ui/theme.ts` or `flutter_theme.dart`

### Microinteractions
- Animate transitions subtly (fade, slide)
- Use hover and focus states for buttons and inputs
- Provide visual feedback on drag-and-drop, toggles, and switches

### Documentation
- Document all components in Storybook (React) or Widgetbook (Flutter)
- Include usage examples, props, and accessibility notes
- Sync design tokens with design tools
