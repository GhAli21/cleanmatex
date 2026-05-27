# CleanMateX Brand Specifications v1.1

**Prepared by:** Jehad Ali (Jh Apps) & AI Brand Assistant
**Date:** November 2025 (Updated)
**Version:** 1.1
**Document Type:** Brand Specification (Design + Development Alignment)

---

## 1. Brand Identity Core

| Element | Specification |
|----------|----------------|
| **Brand Name** | **CleanMateX** |
| **Tagline** | "Smart. Fast. Spotless." |
| **Mission** | To digitize, automate, and elevate every aspect of laundry and dry-cleaning operations through smart, bilingual, AI-driven SaaS. |
| **Vision** | To be the leading GCC-first laundry management platform—trusted by small shops and large franchises alike. |
| **Values** | Innovation, Reliability, Simplicity, Customer Focus, GCC Localization. |
| **Voice & Tone** | Clean, professional, bilingual, friendly but precise. Avoid jargon. (Achieved through clear, actionable language in UIs, empathetic support responses, and marketing copy that educates rather than overwhelms.) |
| **Brand Story (Recommended)** | (To be developed: A short paragraph about the 'why' behind CleanMateX - the problem identified, the impact intended, to humanize the brand.) |

---

## 2. Visual Identity System

### 2.1 Logo Guidelines

* **Primary Logo:** "CleanMateX" with stylized **"X"** (the 'Sparkle & Spotless X') symbolizing both exchange, efficiency, and pristine cleanliness.
    * **Logo Lockup:** "CleanMateX" wordmark with the 'Sparkle & Spotless X' integrated as the 'X'.
    * **Character Integration:** "The Cleanliness Champion" mascot positioned at the end of the wordmark, subtly enhancing personality without obscuring the 'X'.
* **Color Versions:**
    * Full color (preferred)
    * White on dark
    * Monochrome (print or thermal receipts)
* **Minimum Size & Clear Space:** To be defined for digital and print to ensure readability and impact.

### 2.2 Brand Colors

| Use | Color | HEX | Description |
|------|--------|------|-------------|
| **Primary** | Aqua Blue | `#0AB6D8` | Clean, modern, represents water and freshness. |
| **Secondary** | Deep Navy | `#0E2A47` | Trust, reliability, corporate GCC tone. |
| **Accent** | Emerald Green | `#1DBF73` | Growth, sustainability. (Used in 'Sparkle & Spotless X' gradient and sparkle effects.) |
| **Alert / Action** | Amber | `#FFB100` | Key buttons, attention color. |
| **Success** | Teal | `#14B8A6` | Positive confirmations. |
| **Error** | Coral Red | `#E44D4D` | Error, alert, cancel. |
| **Neutral / Backgrounds** | Light Grey | `#F8FAFC` | Clean UI backgrounds. |
| **Neutral / Backgrounds** | Mid Grey | `#E2E8F0` | Clean UI backgrounds / Dividers. |
| **Neutral / Text/Borders** | Dark Grey | `#64748B` | Text on light backgrounds, borders, dividers (for good contrast). |

*(Mapped to Tailwind config in Next.js and Flutter ThemeData.)*
*(Consider subtle gradients for splash screens/hero sections transitioning between Aqua Blue and Deep Navy, or Aqua Blue and Emerald Green.)*

### 2.3 "Sparkle & Spotless X" Emblem

* **Concept:** A dynamic 'X' formed by overlapping strokes, shimmering with sparkles.
* **Colors:** Gradient transition from Aqua Blue to Emerald Green.
* **Usage:** Integrated into the main logo, used as a standalone icon (app icon), and featured on branded elements like the mascot's apron and cleaning tools.

---

## 3. Typography

| Platform | Font | Notes |
|-----------|-------|-------|
| **English (Web)** | Poppins | Sans-serif, legible, geometric, modern. (Primary choice for headings and body). |
| **Arabic (Web)** | Tajawal / Cairo | RTL-friendly, modern Arabic font (to be decided which is primary). |
| **Mobile (Flutter)** | Poppins + Tajawal via Google Fonts |
| **Print (Invoices/PDF)** | Noto Sans + Noto Naskh Arabic | Unicode-safe, bidi-correct. |

### Font Hierarchy
* **Headings:** Poppins, 700 weight (2xl / xl), appropriate line-height.
* **Body text:** Poppins, 400 weight (base), line-height ~1.5.
* **Captions:** Poppins, 300 weight (sm).
* **Fallback Fonts:** Specify `font-family` stacks (e.g., `Poppins, "Helvetica Neue", Arial, sans-serif;`).
* **Letter-Spacing:** Subtle adjustments for headings for optimal visual appeal.

---

## 4. Iconography & Illustrations

* **Icon Style:** Outline-style icons (Lucide / Feather for web, Material for Flutter), rounded corners (12px), simple, vector-based.
* **Illustration Style (Onboarding/Marketing):** Minimalist, flat or subtle depth, line-art driven, using brand primary/secondary/accent colors. Depicts diverse individuals/hands. Examples: laundry basket, delivery van, washer.
* **Custom Icon Set (Long-term consideration):** Develop a small set of custom icons for core concepts (laundry basket, hanger, delivery truck, AI brain) that subtly incorporate the 'X' motif or brand's rounded corner style.

### 4.1 "The Cleanliness Champion" Character/Mascot

* **Name:** بطل النظافة (The Cleanliness Champion)
* **Persona:** Friendly, cheerful, radiates happiness, excellent cleanliness, and a bright, positive attitude. Embodies the "Smart. Fast. Spotless." tagline.
* **Key Visual Elements:**
    * Wide, welcoming smile and bright, expressive eyes.
    * Immaculately clean and neat work attire (e.g., teal polo, white apron, dark trousers).
    * Subtle "sparkles" or "shimmering effects" around the character/cleaning tools.
    * Brand colors (Aqua Blue, Emerald Green, White) dominant in attire and effects.
    * Active and happy posture (e.g., thumbs up, welcoming gesture, holding clean items or cleaning tools).
    * Integration of the 'Sparkle & Spotless X' on apron pocket and cleaning tools.
    * Holds relevant items: tablet displaying CleanMateX app, cleaning spray bottle.
* **Target Feeling:** Assured, happy, and confident that laundry will be handled perfectly and with joy.
* **Usage:** Onboarding, empty states, error pages, marketing, notifications, gamification.

---

## 5. UI/UX Branding System

| Element | Spec |
|----------|------|
| **Corner Radius** | 12px (rounded-xl) for all major UI elements. |
| **Shadow** | Soft elevation (shadow-md) for cards and important elements. |
| **Primary Buttons** | Filled Aqua (`#0AB6D8`), white text. (Hover: Darken Aqua Blue by 10%; Active: Darken by 20%). |
| **Secondary Buttons** | Outline with Deep Navy border (`#0E2A47`), transparent background, Deep Navy text. (Hover: Fill with Aqua Blue, white text). |
| **Success States** | Teal (`#14B8A6`). |
| **Error States** | Coral (`#E44D4D`). |
| **Font Size Hierarchy** | Headings (xl–2xl), Body (base), Captions (sm). |
| **Grid System** | 8px base grid for all spacing and alignment. |
| **Theme Modes** | Light + Dark (auto switch functionality). |
| **Input Fields** | Default: Light grey border; Focus: Aqua Blue border; Error: Coral Red border; Disabled: Light grey background, faded text. |
| **Modals/Dialogs** | Defined background overlay opacity, consistent title font, clear button placement. |
| **Loader/Spinner** | Custom animation using brand 'X' or colors (optional, long-term). |

---

## 6. Bilingual & Cultural Design

* EN/AR language toggle on all screens.
* RTL mirroring for Arabic interface.
* Localized date/time per GCC locale.
* Currency formatting (OMR, SAR, AED, etc.).
* Arabic translations must sound natural, not literal.
* **Cultural Sensitivity:** Avoid imagery or metaphors that might be culturally insensitive. Ensure diverse and respectful portrayal in illustrations.
* **Number Formatting:** Specify how numbers (quantities, prices) are formatted in Arabic context (e.g., Arabic numerals with Arabic formatting for decimals/thousands).

---

## 7. Brand Usage Scenarios

| Context | Style Guide Reference |
|----------|----------------------|
| **App Icons / Store** | 'Sparkle & Spotless X' mark on Aqua/Navy gradient background. |
| **Website Header** | Full wordmark + tagline (with or without character depending on space). |
| **Admin Portal** | Sidebar icon (Sparkle X) only; full logo on login screen. |
| **Customer App Splash** | Gradient background (`#0AB6D8` → `#0E2A47`) with full logo and character. |
| **Invoices & Receipts** | Bilingual header; Arabic text right-aligned; monochrome logo version. |
| **Social Media / Ads** | Real imagery with AI-enhanced visuals; full logo, character, and tagline as appropriate. Icon 'Sparkle X' for profile picture. |
| **Email Templates** | Minimalist, uses primary logo in header, clean layout, brand colors for CTAs. |

---

## 8. Brand Extensions

| Product | Sub-Brand Name | Accent Color | Sub-Brand Logo Treatment |
|----------|----------------|--------------|--------------------------|
| Customer App | CleanMateX Go | Aqua         | (To be defined: e.g., "CleanMateX" with "Go" in Aqua) |
| Driver App | CleanMateX Move | Emerald      | (To be defined: e.g., "CleanMateX" with "Move" in Emerald) |
| Admin Web | CleanMateX HQ  | Navy         | (To be defined: e.g., "CleanMateX" with "HQ" in Navy) |
| Marketplace | CleanMateX Hub | Amber        | (To be defined: e.g., "CleanMateX" with "Hub" in Amber) |

---

## 9. Brand Implementation Checklist

1.  Create `/branding/` folder:
    * `logo_primary_full.svg`, `logo_primary_no_tagline.svg`, `logo_icon.svg`
    * `logo_white_on_dark.svg`, `logo_monochrome.svg`
    * `sparkle_x_emblem.svg`
    * `cleanliness_champion_mascot.svg` (multiple poses if developed)
    * `brand_palette.json`
    * `typography.css` (web)
    * Flutter `app_theme.dart`
2.  Configure Tailwind colors in `/web-admin/tailwind.config.ts`
3.  Implement Flutter theme in `lib/core/theme/app_theme.dart`
4.  Apply bilingual invoice/receipt headers
5.  Generate brand guideline PDF for design & marketing
6.  Create `CleanMateX_Master_Design_File.fig` (or Sketch/XD) with all UI components and brand elements.

---

## 10. Deliverables

* `CleanMateX_Brand_Specifications_v1.1.md` (This document)
* Design-ready logo assets (SVG/PNG) for all variations.
* `sparkle_x_emblem.svg`
* `cleanliness_champion_mascot.svg`
* Tailwind + Flutter theme JSON snippets.
* Bilingual tagline and marketing phrases.
* Basic marketing templates (social media, banner ads) - if required for initial launch.

---

**End of Document**