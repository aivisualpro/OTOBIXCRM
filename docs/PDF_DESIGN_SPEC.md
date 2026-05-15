# Vehicle Inspection PDF — Design Specification

> **Version**: 1.0 · **Date**: 2026-05-15  
> **Renderer**: html2pdf.js 0.10.1 → html2canvas 1.4.1 + jsPDF  
> **Format**: A4 portrait (210 × 297 mm)

---

## 1. Rendering Constraints

These are hard constraints inherited from the existing `downloadPDF()` config and
html2canvas limitations. Every design decision below must satisfy them.

| Parameter | Value | Source |
|-----------|-------|--------|
| Page size | 210 × 297 mm | `jsPDF: { format: 'a4', orientation: 'portrait' }` |
| Renderer margin | `[10, 0, 10, 0]` mm (top, right, bottom, left) | `opt.margin` |
| Canvas scale | `2` (≈ 144 DPI raster) | `html2canvas: { scale: 2 }` |
| Image format | JPEG 0.95 quality | `image: { type: 'jpeg', quality: 0.95 }` |
| Color model | **Hex/RGB only** — no `oklch()`, no `hsl()`, no CSS vars | html2canvas 1.4.1 crash |
| Gradients | **Forbidden** — html2canvas renders them as solid grey | — |
| Box-shadow | **Forbidden** — already forced to `none` in `<style>` | — |
| SVG icons | Rendered as raster at `scale: 2`; keep ≤ 16 px | — |
| Fonts | System-stack only; no `@font-face` (no fetch during render) | — |
| Page breaks | Via `.html2pdf__page-break` div or CSS `page-break-*` | — |

---

## 2. Typography

### Font Stack

```
--pdf-font: 'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
```

**Inter** ships pre-installed on modern macOS / iOS and is available as a
system font in many Linux distros. It is the only named font in the stack;
the remaining entries are OS fallbacks. No web-font loading — the PDF
renders offline from a rasterised canvas.

### Type Scale

All sizes are in **CSS `px`** (rendered at `scale: 2` → effective 2× on paper).

| Token | Size | Weight | Letter-spacing | Usage |
|-------|------|--------|----------------|-------|
| `h1` | 20 px | 800 | 0.04 em | Report title (cover page only) |
| `h2` | 11 px | 700 | 0.12 em, uppercase | Section banners (A, B, C…) |
| `h3` | 9 px | 700 | 0.08 em, uppercase | Sub-section headers (Front, Rear…) |
| `h4` | 8 px | 700 | 0.05 em, uppercase | Card titles / field group labels |
| `body` | 9 px | 500 | 0 | Data values, table cells |
| `caption` | 7 px | 600 | 0.06 em, uppercase | Image captions, footer text |
| `kpi-value` | 18 px | 800 | -0.02 em | KPI strip numbers |
| `kpi-label` | 7 px | 600 | 0.10 em, uppercase | KPI strip labels |

### Rules

- Maximum two weights in any single component: **500** (medium) + **700/800** (bold).
- No italic anywhere.
- Line-height: 1.3 for body text, 1.1 for headings, 1.0 for KPI values.
- Truncation: single-line `text-overflow: ellipsis` on data values; never wrap.

---

## 3. Color Palette

Exactly four colors. Every element maps to one of these. No gradients, no
opacity tricks, no alpha channels (html2canvas rounds alpha inconsistently).

| Token | Hex | Role |
|-------|-----|------|
| **Ink** | `#0F172A` | All text, borders, section banners, rules |
| **Paper** | `#FFFFFF` | Page background, card backgrounds |
| **Accent** | `#2563EB` | Report title, KPI values, section sub-headers, accent rules |
| **Muted** | `#F1F5F9` | Card header fills, table zebra rows, photo placeholder bg |

### Condition Pills (semantic — derived from Ink only)

Condition pills override *background only* to convey status. Text stays Ink.

| Condition | Background | Text |
|-----------|-----------|------|
| Okay / Working / Yes | `#DCFCE7` | `#0F172A` |
| Repainted / Changed / Low | `#FEF9C3` | `#0F172A` |
| Damaged / Broken / Missing | `#FEE2E2` | `#0F172A` |
| Not Applicable | `#F1F5F9` | `#0F172A` |

These four tints are pastel enough to survive JPEG compression at 0.95.

---

## 4. Spacing Scale

Eight fixed tokens. No arbitrary values outside this set.

| Token | Value | Common use |
|-------|-------|------------|
| `xs` | 2 px | Pill internal padding |
| `sm` | 4 px | Icon-to-text gap, cell padding |
| `md` | 8 px | Card internal padding, grid gap |
| `lg` | 12 px | Between card rows |
| `xl` | 16 px | Section bottom margin |
| `2xl` | 24 px | Between major sections |
| `3xl` | 32 px | Cover page element spacing |
| `page-margin` | 10 mm (≈ 38 px at scale 2) | Page inset (set by html2pdf `margin`) |

---

## 5. Grid System

### Page Geometry

```
┌──────────────────── 210 mm ────────────────────┐
│← 10mm →┌──── 190 mm content area ────┐← 10mm →│
│         │                             │         │
│  html2pdf margin (top: 10mm)          │         │
│         │                             │         │
│         │  ┌─ 12-col grid ──────────┐ │         │
│         │  │ col: 14.17 mm          │ │         │
│         │  │ gutter: 2 mm           │ │         │
│         │  │ (12×14.17 + 11×2 = 192 │ │         │
│         │  │  ≈ 190 mm usable)      │ │         │
│         │  └────────────────────────┘ │         │
│         │                             │         │
│  html2pdf margin (bottom: 10mm)       │         │
│         └─────────────────────────────┘         │
└─────────────────────────────────────────────────┘
```

| Measurement | Value |
|-------------|-------|
| Page width | 210 mm |
| Page height | 297 mm |
| html2pdf margin top/bottom | 10 mm |
| html2pdf margin left/right | 0 mm |
| Content area CSS padding (left + right) | 10 mm each side |
| **Usable content width** | **190 mm** |
| Grid columns | 12 |
| Column width | ~14.17 mm |
| Gutter | 2 mm |
| Content area height per page | 277 mm (297 − 10 − 10) |

### Column Shortcuts

| Layout | Columns | Width |
|--------|---------|-------|
| Full-width | 12 | 190 mm |
| Half | 6 | 93 mm |
| Third | 4 | 61 mm |
| Quarter | 3 | 45 mm |
| Two-thirds | 8 | 126 mm |
| KPI cell (1/5) | — | `20%` of 190 mm = 38 mm |

---

## 6. Iconography

- **Library**: Lucide icons only (already in the project via `@iconify`).
- **Stroke**: 1.25 px (rendered as inline SVG, rasterised by html2canvas).
- **Size**: 10 px for inline data icons; 14 px for section headers.
- **Color**: **Ink** (`#0F172A`) only. Never accent, never muted.
- **Usage**: Sparingly — one icon per section header, one per KPI cell. No
  decorative icons.

---

## 7. Component Catalog

### 7.1 — Cover Page

Full first page. No data cards.

```
┌────────────────────────────────────────────┐
│                                            │
│  [Logo]              VEHICLE INSPECTION    │
│  Otobix              REPORT          [h1]  │
│                                            │
│  ─────────── 1px Ink rule ───────────────  │
│                                            │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │                  │ │                  │ │
│  │   Front Main     │ │   Rear Main      │ │
│  │   Image          │ │   Image          │ │
│  │   (93 × 62 mm)   │ │   (93 × 62 mm)  │ │
│  └──────────────────┘ └──────────────────┘ │
│                                            │
│  ┌──── KPI Strip (5 cells) ──────────────┐ │
│  │ REG NO │ MFG YEAR │ KMs │ OWNER │FUEL │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  Inspected: 15 May 2026 · Mumbai           │
│  ID: ABC123   ·   Approved by: User        │
│                                            │
│  ─── footer: page 1 / N ─── report ID ──  │
└────────────────────────────────────────────┘
```

- Logo: 24 mm height, left-aligned.
- Title: `h1`, Accent color, right-aligned.
- Vehicle: `h3` size, Ink color, below title. `YEAR MAKE MODEL VARIANT`.
- Images: two equal halves, `object-contain`, 1 px Muted border.
- KPI strip: see §7.2.

### 7.2 — KPI Strip

A single horizontal bar with 5 equal-width cells, 1 px Ink top/bottom rules.

```
┌──────┬──────┬──────┬──────┬──────┐
│ val  │ val  │ val  │ val  │ val  │   ← kpi-value (18px, Accent)
│ lbl  │ lbl  │ lbl  │ lbl  │ lbl  │   ← kpi-label (7px, Ink)
└──────┴──────┴──────┴──────┴──────┘
```

- Background: Paper.
- Vertical dividers: 1 px Muted.
- Cell padding: `sm` top/bottom, `md` left/right.
- Values: `kpi-value` token, Accent color.
- Labels: `kpi-label` token, Ink color.

### 7.3 — Section Divider

Full-width banner separating major sections (A, B, C…).

```
┌────────────────────────────────────────────┐
│  A. GENERAL INFORMATION & DOCUMENTATION    │   ← h2, Paper text
└────────────────────────────────────────────┘     ← Ink background
```

- Height: auto (padding `sm` vertical).
- Background: Ink (`#0F172A`).
- Text: Paper (`#FFFFFF`), `h2` token, centered.
- Bottom margin: `xl`.
- No rounded corners (html2canvas rounds inconsistently at edges).

### 7.4 — Sub-Section Header

Used below section dividers (e.g., "Front", "Left (LHS)").

```
  FRONT                                          ← h3, Accent text
  ─────────────────────────────────────────────   ← 1px Accent rule
```

- Text: `h3` token, Accent color, left-aligned.
- Underline: 1 px solid Accent, full content width.
- Bottom margin: `md`.

### 7.5 — Two-Column Data Card

Primary unit for inspection parts. Always rendered in a 2-column grid.

```
┌──────────────────────┬──────────┐
│  LHS FENDER    [h4]  │          │
│                      │  image   │
│  ● Repainted         │  thumb   │
│  ● Scratched         │  32×22mm │
│                      │          │
└──────────────────────┴──────────┘
```

- Outer: 1 px Muted border, no rounded corners.
- Header bar: Muted background, `h4` token, `sm` padding.
- Body: Paper background, condition pills left-aligned, `md` padding.
- Image well: 32 mm wide, right side, Muted background, centered
  `object-contain`. If no image: "No Image" in `caption` style, Ink at 40% opacity.
- Minimum height: 22 mm.
- `page-break-inside: avoid`.

### 7.6 — Condition Pill

Inline element displaying a single condition value.

```
  ┌─────────────┐
  │ ● Repainted  │
  └─────────────┘
```

- Height: 14 px.
- Padding: `xs` vertical, `sm` horizontal.
- Border: 1 px solid, color matches background tint (see §3 table).
- Background: semantic tint from §3.
- Text: `caption` size, **700** weight, Ink color.
- Dot: 4 px circle, same color as border, `sm` gap before text.
- No emoji. The dot replaces emoji from the current design.

### 7.7 — Data Table (General Info & Docs)

4-column label→value grid for the documentDetailFields section.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Fuel Type   │  Petrol      │  Color       │  White       │
├──────────────┼──────────────┼──────────────┼──────────────┤
│  Engine No.  │  ABC123      │  Chassis No. │  XYZ789      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

- Label cells: Muted background, `h4` style.
- Value cells: Paper background, `body` style.
- Borders: 1 px Muted.
- No row striping beyond the label/value contrast.
- `page-break-inside: avoid` per row-pair.

### 7.8 — Photo Grid (3-up)

Used in the Image Gallery section. Three images per row.

```
┌────────────┐ ┌────────────┐ ┌────────────┐
│            │ │            │ │            │
│   image    │ │   image    │ │   image    │
│   60×40mm  │ │   60×40mm  │ │   60×40mm  │
│            │ │            │ │            │
├────────────┤ ├────────────┤ ├────────────┤
│  CAPTION   │ │  CAPTION   │ │  CAPTION   │
└────────────┘ └────────────┘ └────────────┘
```

- Grid: 3 equal columns, `md` gap.
- Image cell: `object-contain`, Muted background, 1 px Muted border.
- Caption bar: Muted background, `caption` token, centered, 1 px top border.
- Card height: fixed 45 mm (image) + 6 mm (caption) = 51 mm.
- `page-break-inside: avoid` per card.

---

## 8. Print Rules

### Page Breaks

| Rule | CSS |
|------|-----|
| Section dividers | `page-break-before: auto` (let flow naturally) |
| Data cards | `page-break-inside: avoid` |
| Photo grid cards | `page-break-inside: avoid` |
| Data table rows | `page-break-inside: avoid` |
| KPI strip | `page-break-inside: avoid` |
| Explicit break | `<div class="html2pdf__page-break"></div>` before Image Gallery |

### Widows & Orphans

```css
#pdf-container * {
  widows: 2;
  orphans: 2;
}
```

### Page Footer

Every page receives a consistent footer rendered as a fixed-height block at
the bottom of the content area (not via `@page` — html2pdf does not support
CSS `@page` counters).

**Approach**: The footer is baked into the template as a repeating element
before each `html2pdf__page-break` and once at the document end.

```
─────────────────────────────────────────────────
Report ID: ABC123                    Page 1 of N
```

- Top rule: 0.5 px Muted, full width.
- Left text: Report ID (`appointmentId`), `caption` token, Ink at 50% opacity.
- Right text: Page number, `caption` token, Ink at 50% opacity.
- Margin-top: `lg`.
- Total footer height: ~8 mm.

> **Note**: html2pdf auto-paginates and does not expose a page counter to
> the DOM. For true `Page X of N`, post-process with jsPDF's `setPage()` API
> after generation. For the initial implementation, render a static footer
> with Report ID only and omit page numbers (they will be added in a follow-up
> if jsPDF post-processing is feasible).

---

## 9. Full Page Budget

With 277 mm usable height per page (297 − 10 top − 10 bottom):

| Section | Est. height | Pages |
|---------|-------------|-------|
| Cover page (logo + images + KPI + meta) | 277 mm | 1 |
| A. General Info table (~20 rows × 6 mm) | ~120 mm | < 1 |
| B. Vehicle Condition (≈80 cards × 24 mm, 2-col) | ~960 mm | ~4 |
| C. Image Gallery (≈60 images, 3-up × 51 mm) | ~1020 mm | ~4 |
| **Total estimated** | | **~10 pages** |

---

## 10. What This Spec Does NOT Cover

- Actual Vue template code (Prompt 3+).
- Dynamic show/hide logic for empty fields.
- QR code or barcode embedding.
- Multi-language / RTL layout.
- Digital signature block.

These may be scoped in future prompts.
