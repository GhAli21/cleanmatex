# CleanMateX Brand Specifications v1.0

**Prepared by:** Jehad Ali (Jh Apps)  
**Date:** November 2025  
**Version:** 1.0  
**Document Type:** Brand Specification (Design + Development Alignment)

---

## 1. Brand Identity Core

| Element | Specification |
|----------|----------------|
| **Brand Name** | **CleanMateX** |
| **Tagline** | "Smart. Fast. Spotless." *(Arabic: "ذكي. سريع. نقي.")* |
| **Mission** | To digitize, automate, and elevate every aspect of laundry and dry-cleaning operations through smart, bilingual, AI-driven SaaS. |
| **Vision** | To be the leading GCC-first laundry management platform—trusted by small shops and large franchises alike. |
| **Values** | Innovation, Reliability, Simplicity, Customer Focus, GCC Localization. |
| **Voice & Tone** | Clean, professional, bilingual, friendly but precise. Avoid jargon. |

---

## 2. Visual Identity System

### 2.1 Logo Guidelines
- **Primary Logo:** "CleanMateX" with stylized **"X"** symbolizing both exchange and efficiency.
- **Color Versions:**
  - Full color (preferred)
  - White on dark
  - Monochrome (print or thermal receipts)

### 2.2 Brand Colors

| Use | Color | HEX | Description |
|------|--------|------|-------------|
| **Primary** | Aqua Blue | `#0AB6D8` | Clean, modern, represents water and freshness. |
| **Secondary** | Deep Navy | `#0E2A47` | Trust, reliability, corporate GCC tone. |
| **Accent** | Emerald Green | `#1DBF73` | Growth, sustainability. |
| **Alert / Action** | Amber | `#FFB100` | Key buttons, attention color. |
| **Success** | Teal | `#14B8A6` | Positive confirmations. |
| **Error** | Coral Red | `#E44D4D` | Error, alert, cancel. |
| **Neutral / Backgrounds** | `#F8FAFC`, `#E2E8F0` | Clean UI backgrounds. |

*(Mapped to Tailwind config in Next.js and Flutter ThemeData.)*

---

## 3. Typography

| Platform | Font | Notes |
|-----------|-------|-------|
| **English (Web)** | Inter / Poppins | Sans-serif, legible, geometric. |
| **Arabic (Web)** | Tajawal / Cairo | RTL-friendly, modern Arabic font. |
| **Mobile (Flutter)** | Poppins + Tajawal via Google Fonts |
| **Print (Invoices/PDF)** | Noto Sans + Noto Naskh Arabic | Unicode-safe, bidi-correct. |

### Font Hierarchy
- Headings: 700 weight (2xl / xl)
- Body text: 400 weight (base)
- Captions: 300 weight (sm)

---

## 4. Iconography & Illustrations
- Outline-style icons (Lucide / Feather for web, Material for Flutter)
- Rounded corners (12px)
- Simple, vector-based illustrations for onboarding (laundry basket, delivery van, washer)

---

## 5. UI/UX Branding System

| Element | Spec |
|----------|------|
| **Corner Radius** | 12px (rounded-xl) |
| **Shadow** | Soft elevation (shadow-md) |
| **Primary Buttons** | Filled Aqua (#0AB6D8), white text |
| **Secondary Buttons** | Outline with Deep Navy border |
| **Success States** | Teal |
| **Error States** | Coral |
| **Font Size Hierarchy** | Headings (xl–2xl), Body (base), Captions (sm) |
| **Grid System** | 8px base grid |
| **Theme Modes** | Light + Dark (auto switch) |

---

## 6. Bilingual & Cultural Design
- EN/AR language toggle on all screens.
- RTL mirroring for Arabic.
- Localized date/time per GCC locale.
- Currency formatting (OMR, SAR, AED).
- Arabic translations must sound natural, not literal.

---

## 7. Brand Usage Scenarios

| Context | Style Guide Reference |
|----------|----------------------|
| **App Icons / Store** | Simplified X mark on Aqua background. |
| **Website Header** | Full wordmark + tagline. |
| **Admin Portal** | Sidebar icon only; full logo on login. |
| **Customer App Splash** | Gradient background (#0AB6D8 → #0E2A47). |
| **Invoices & Receipts** | Bilingual header; Arabic text right-aligned. |
| **Social Media / Ads** | Real imagery with AI-enhanced visuals. |

---

## 8. Brand Extensions

| Product | Sub-Brand | Accent |
|----------|------------|---------|
| Customer App | CleanMateX Go | Aqua |
| Driver App | CleanMateX Move | Emerald |
| Admin Web | CleanMateX HQ | Navy |
| Marketplace | CleanMateX Hub | Amber |

---

## 9. Brand Implementation Checklist
1. Create `/branding/` folder:
   - `logo_primary.svg`, `logo_white.svg`, `logo_icon.svg`
   - `brand_palette.json`
   - `typography.css` (web)
   - Flutter `app_theme.dart`
2. Configure Tailwind colors in `/web-admin/tailwind.config.ts`
3. Implement Flutter theme in `lib/core/theme/app_theme.dart`
4. Apply bilingual invoice/receipt headers
5. Generate brand guideline PDF for design & marketing

---

## 10. Deliverables
- `CleanMateX_Brand_Specifications_v1.0.docx`
- `CleanMateX_Brand_Specifications_v1.0.md`
- Design-ready logo assets (SVG/PNG)
- Tailwind + Flutter theme JSON snippets
- Bilingual tagline and marketing phrases

---

**End of Document**

