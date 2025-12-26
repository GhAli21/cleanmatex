# Web Admin Layout & Navigation - Development Plan & PRD

**Document ID**: 015 | **Version**: 1.0 | **Dependencies**: 001-004, 049-050  
**Related**: NFR-I18N-001

## Overview

Implement responsive admin dashboard layout with RTL support, navigation menu, theme system, and loading states.

## Requirements

- Responsive layout (desktop, tablet, mobile)
- RTL/LTR switching (EN/AR)
- Sidebar navigation with icons
- Breadcrumbs
- User menu & tenant switcher
- Dark mode (optional)

## Technical Design

**Framework**: Next.js 15 App Router  
**Styling**: Tailwind CSS 4  
**Components**: shadcn/ui

### Layout Structure

```tsx
<html dir={locale === "ar" ? "rtl" : "ltr"}>
  <body>
    <Sidebar />
    <main>
      <Header />
      <Breadcrumbs />
      <PageContent>{children}</PageContent>
    </main>
  </body>
</html>
```

## Implementation (3 days)

1. Layout components (2 days)
2. Navigation menu (1 day)
3. RTL testing (1 day)

## Acceptance

- [ ] Responsive on all devices
- [ ] RTL working correctly
- [ ] Navigation functional
- [ ] Loading states smooth

**Last Updated**: 2025-10-09
