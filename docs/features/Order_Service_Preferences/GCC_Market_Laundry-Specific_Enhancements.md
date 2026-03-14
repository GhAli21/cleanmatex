---
version: v1.0.0
last_updated: 2026-03-14
author: CleanMateX Team
source: suggesstion_decisions.md §5.1
---

# GCC Market — Laundry-Specific Enhancements

## Overview

This document captures laundry-specific enhancements for the GCC (Gulf Cooperation Council) market. Implementation details are tracked in the main Order Service Preferences implementation plan.

## Scope

### Thobe/Formal Wear Presets

- Preset combinations for common GCC garments (e.g. Heavy Starch + Hang for thobes)
- Quick-apply buttons for formal wear items
- Product-level defaults for thobe, kandura, dishdasha

### Ramadan/Eid Seasonal Bundles

- Date-activated preference bundles for Ramadan and Eid
- Auto-apply or suggested bundles during seasonal periods
- Example: "Eid Premium" — Perfume + Heavy Starch for formal wear

### Arabic-First Labels and Descriptions

- All preference names and descriptions in Arabic (name2, description2)
- RTL layout support for preference selectors
- Arabic-first display when locale is ar

### Currency and Locale

- OMR (Oman), SAR (Saudi Arabia), AED (UAE), BHD (Bahrain), KWD (Kuwait), QAR (Qatar)
- Locale-aware number and currency formatting
- Date formats per GCC region

## Implementation Status

- **Documentation:** This file (created per user decision)
- **Implementation:** Tracked in [IMPLEMENTATION_PLAN_ENHANCEMENT_v2.md](IMPLEMENTATION_PLAN_ENHANCEMENT_v2.md)
