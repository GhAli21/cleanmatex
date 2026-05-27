To define **CleanMateX brand specifications**, the foundation from your existing documentation provides strong alignment between the **product vision**, **target markets (GCC)**, and the **digital-first, AI-driven, bilingual identity**.
From the unified requirements, technical stack, and master plan documents, here is a full **Brand Specification Framework** to guide your design and creation of all brand assets:

---

## 1. Brand Identity Core

| Element          | Specification                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Brand Name**   | **CleanMateX**                                                                                                                   |
| **Tagline**      | “Smart. Fast. Spotless.” *(optional Arabic: “ذكي. سريع. نقي.”)*                                                                  |
| **Mission**      | To digitize, automate, and elevate every aspect of laundry and dry-cleaning operations through smart, bilingual, AI-driven SaaS. |
| **Vision**       | To be the leading GCC-first laundry management platform—trusted by small shops and large franchises alike.                       |
| **Values**       | Innovation, Reliability, Simplicity, Customer Focus, GCC Localization.                                                           |
| **Voice & Tone** | Clean, professional, bilingual, friendly but precise. Avoid technical jargon in marketing.                                       |

---

## 2. Visual Identity System

### 2.1 Logo Guidelines

* **Primary Logo:**
  “CleanMateX” with stylized **“X”** symbolizing both “exchange” and “efficiency”.
* **Color Versions:**

  * Full color (preferred)
  * White on dark
  * Monochrome (for print and POS)

### 2.2 Brand Colors

| Use                       | Color                | HEX                   | Description                                    |
| ------------------------- | -------------------- | --------------------- | ---------------------------------------------- |
| **Primary**               | Aqua Blue            | `#0AB6D8`             | Clean, modern, represents water and freshness. |
| **Secondary**             | Deep Navy            | `#0E2A47`             | Trust, reliability, GCC corporate tone.        |
| **Accent**                | Emerald Green        | `#1DBF73`             | Growth, eco-friendly sustainability.           |
| **Alert / Action**        | Amber                | `#FFB100`             | Used for key buttons and warnings.             |
| **Success**               | Teal                 | `#14B8A6`             | Positive confirmations.                        |
| **Error**                 | Coral Red            | `#E44D4D`             | Errors, alerts.                                |
| **Neutral / Backgrounds** | `#F8FAFC`, `#E2E8F0` | Clean UI backgrounds. |                                                |

*(Match these with Tailwind configuration in Next.js and Flutter ThemeData in apps.)*

---

## 3. Typography

| Platform                 | Font                                                         | Notes                                      |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------ |
| **English (Web)**        | `Inter` or `Poppins`                                         | Sans-serif, modern, legible.               |
| **Arabic (Web)**         | `Tajawal` or `Cairo`                                         | Harmonizes well with Inter; RTL-friendly.  |
| **Flutter / Mobile**     | Use same pairing (`Poppins` + `Tajawal`) via `google_fonts`. |                                            |
| **Print (Invoices/PDF)** | `Noto Sans` / `Noto Naskh Arabic`                            | Unicode-safe, used for bilingual receipts. |

---

## 4. Iconography & Illustrations

* Use **outline-style** icons (Lucide or Feather icons for Next.js, Material Icons for Flutter).
* Consistent rounded corners (`border-radius: 12px`).
* Simplified illustrations for onboarding screens (laundry basket, delivery van, washing machine).

---

## 5. UI/UX Branding System

Integrated in all apps (Admin / Customer / Driver):

| Element                 | Spec                                          |
| ----------------------- | --------------------------------------------- |
| **Corner Radius**       | 12px (rounded-xl)                             |
| **Shadow**              | Soft elevation, `shadow-md`                   |
| **Primary Buttons**     | Filled Aqua (`#0AB6D8`) with white text       |
| **Secondary Buttons**   | Outline with Deep Navy border                 |
| **Success States**      | Teal                                          |
| **Error States**        | Coral                                         |
| **Font Size Hierarchy** | Headings (xl–2xl), Body (base), Captions (sm) |
| **Layout Grid**         | 8px-based grid                                |
| **Theme Modes**         | Light + Dark (auto switch)                    |

---

## 6. Bilingual & Cultural Design

* All UI layouts must support **EN/AR** toggling and **RTL mirroring**.
* Date/time formatting per GCC locale (Hijri optional later).
* Number formatting (Arabic numerals in Arabic mode).
* Currency localization (OMR, SAR, AED, etc.).
* Arabic marketing assets to use natural, modern translation (not literal).

---

## 7. Brand Usage Scenarios

| Context                        | Style Guide Reference                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| **App Icons / Store Listing**  | Simplified logo mark only (CleanMateX “X”) on aqua background.            |
| **Website Header**             | Full wordmark + tagline.                                                  |
| **Admin Portal (Next.js)**     | Left nav uses logo mark only; login screen full logo.                     |
| **Customer App Splash Screen** | Gradient background (#0AB6D8 → #0E2A47).                                  |
| **Invoices & Receipts**        | Header with bilingual logo + address block right-aligned for Arabic.      |
| **Social Media / Ads**         | Use real imagery + AI-enhanced visuals (folded shirts, eco delivery van). |

---

## 8. Brand Extensions

| Product              | Sub-Brand           | Color Accent |
| -------------------- | ------------------- | ------------ |
| Customer App         | **CleanMateX Go**   | Aqua         |
| Driver App           | **CleanMateX Move** | Emerald      |
| Admin Web            | **CleanMateX HQ**   | Navy         |
| Marketplace (future) | **CleanMateX Hub**  | Amber        |

---

## 9. Brand Implementation Checklist

1. Create brand folder `/branding/`

   * `logo_primary.svg`, `logo_white.svg`, `logo_icon.svg`
   * `brand_palette.json` (for app themes)
   * `typography.css` / Flutter text theme config
2. Configure Tailwind theme in `/web-admin/tailwind.config.ts`
3. Add Flutter `AppTheme` constants under `lib/core/theme/`
4. Update invoice/receipt templates (EN/AR headers)
5. Build brand guideline PDF with logo usage rules

---

Would you like me to now **generate the official "CleanMateX Brand Specification Document v1.0.docx"** (ready for design team and developers) based on this framework? It would include:

* Visual palette charts
* Typography pairing samples
* Logo placement examples
* App color mapping for Flutter + Tailwind

It can be exported as `.docx` or `.md`.
