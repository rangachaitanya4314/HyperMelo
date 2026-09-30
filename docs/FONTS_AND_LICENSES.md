# NARO Typography System & Font Licensing Documentation

NARO adheres to a three-tier typographic hierarchy designed to reflect the identity of a premium record label and contemporary music publication:

```
BRAND (Calligraphic/Script)   → NARO Wordmark, Expressive Identity
EDITORIAL (Contemporary Serif) → Hero Headings, Poetic Pullquotes, Moment Titles
UI (Modern Grotesk Sans)      → Navigation, Controls, Timers, Metadata
```

---

## 1. BRAND: Calligraphic / Script Typography

- **Primary Font**: `Alex Brush` (Google Fonts / Web Font) + Bespoke Scalable Vector Wordmark
- **Designer**: Robert E. Leuschke (TypeSETit)
- **License**: **SIL Open Font License, Version 1.1 (OFL)**
  - Open Source, royalty-free for commercial and non-commercial web use.
  - No redistribution fees, no API keys or telemetry required.
- **Application**: The official `NARO` wordmark and select artist accentuation.
- **Implementation**:
  - CSS Token: `--font-brand: 'Alex Brush', cursive;`
  - Encapsulated in the dedicated `<NaroLogo />` component with hand-crafted SVG bezier paths for instant zero-latency rendering across all devices, viewports, and headless environments, backed by `@font-face` CSS.

---

## 2. EDITORIAL: Elegant Serif Display

- **Font Family**: `Cormorant Garamond` (Weights: 400, 500, 600, Italic)
- **Designer**: Christian Thalmann (Catharsis Fonts)
- **License**: **SIL Open Font License, Version 1.1 (OFL)**
  - Open Source, freely licensed for digital and print distribution.
- **Application**: Hero titles (*"Feel the song."*, *"Make it yours."*), editorial music commentary, and lyric display highlights.
- **Implementation**:
  - CSS Token: `--font-editorial: 'Cormorant Garamond', Georgia, serif;`
  - Utility Class: `.serif-italic`, `.editorial-title`

---

## 3. UI: Clean Modern Sans-Serif

- **Font Family**: `Inter` (Weights: 300, 400, 500, 600, 700)
- **Designer**: Rasmus Andersson
- **License**: **SIL Open Font License, Version 1.1 (OFL)**
  - Open Source, optimized for maximum legibility on digital screens.
- **Application**: Navigation items, volume sliders, audio scrubbers, buttons, capability indicators (`FULL SONG`, `KARAOKE READY`, `PREVIEW`), and timestamps.
- **Implementation**:
  - CSS Token: `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`

---

## 4. MULTILINGUAL SUPPORT: Indic Scripts

- **Hindi**: `Noto Sans Devanagari` (SIL Open Font License, Version 1.1)
- **Telugu**: `Noto Sans Telugu` (SIL Open Font License, Version 1.1)
- **Provider**: Google Fonts (OFL)
- **Application**: Truthful synchronized and non-synchronized lyric translations in Hindi and Telugu.

---

## Compliance Guarantee

All fonts in NARO are licensed under the **SIL Open Font License (OFL) v1.1**. No commercial font assets with restrictive runtime or per-seat licenses are embedded or referenced.
