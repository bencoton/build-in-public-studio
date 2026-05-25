# WyCo Digital Design System

Use this style guide when building any WyCo Digital product. All products should feel part of the same family while maintaining their individual identity.

---

## Brand Positioning

**Tagline:** "Digital Craft. Real Impact."

**Brand Promise:** We bridge the digital and physical worlds through smart technology.

**Voice:** Technical but approachable. Precise but warm. Innovative but grounded.

---

## Product Family

| Product | Description | Accent Color |
|---------|-------------|--------------|
| **WyCo Digital** | Parent brand, portfolio hub | Teal (primary) |
| **WyCo Trace** | 3D topographic run route maps | Green (#22c55e) |
| **Stashery** | Model train marketplace & inventory | Amber (#f59e0b) |
| **ReConfig** | AI home reconfiguration | Blue (#3b82f6) |
| **[Irrigation]** | Smart irrigation management | Cyan (#06b6d4) |
| **[NFC App]** | NFC chip programming | Purple (#a855f7) |

Each product uses the core WyCo palette but emphasizes its own accent color for differentiation.

---

## Color Palette

### Core Colors (Use Across All Products)

```css
/* Primary - Teal */
--color-primary-50: #f0fdfa;
--color-primary-100: #ccfbf1;
--color-primary-200: #99f6e4;
--color-primary-300: #5eead4;
--color-primary-400: #2dd4bf;
--color-primary-500: #14b8a6;
--color-primary-600: #0d9488;
--color-primary-700: #0f766e;
--color-primary-800: #115e59;
--color-primary-900: #134e4a;
--color-primary-950: #042f2e;

/* Accent - Lime */
--color-accent-50: #f7fee7;
--color-accent-100: #ecfccb;
--color-accent-200: #d9f99d;
--color-accent-300: #bef264;
--color-accent-400: #a3e635;
--color-accent-500: #84cc16;
--color-accent-600: #65a30d;
--color-accent-700: #4d7c0f;
--color-accent-800: #3f6212;
--color-accent-900: #365314;
--color-accent-950: #1a2e05;
```

### Neutral Colors

```css
/* Slate - For backgrounds, text, borders */
--color-slate-50: #f8fafc;
--color-slate-100: #f1f5f9;
--color-slate-200: #e2e8f0;
--color-slate-300: #cbd5e1;
--color-slate-400: #94a3b8;
--color-slate-500: #64748b;
--color-slate-600: #475569;
--color-slate-700: #334155;
--color-slate-800: #1e293b;
--color-slate-900: #0f172a;
--color-slate-950: #020617;
```

### Semantic Colors

```css
/* Light Mode */
--background: #ffffff;
--foreground: #0f172a;
--card: #ffffff;
--card-foreground: #0f172a;
--muted: #f1f5f9;
--muted-foreground: #64748b;
--border: #e2e8f0;

/* Dark Mode (Preferred for WyCo brand) */
--background: #0f172a;
--foreground: #f8fafc;
--card: #1e293b;
--card-foreground: #f8fafc;
--muted: #334155;
--muted-foreground: #94a3b8;
--border: #334155;
```

### Usage Rules

1. **Dark mode is the default** for WyCo Digital brand presence
2. **Light mode** is acceptable for user-facing app interfaces where readability is priority
3. **Never use pure black (#000000)** - use slate-950 or slate-900
4. **Never use pure white (#ffffff) on dark backgrounds** - use slate-50 or slate-100
5. **Primary teal** for CTAs, links, and interactive elements
6. **Accent lime** sparingly for highlights, badges, and success states

---

## Typography

### Font Stack

```css
/* Headings - Space Grotesk */
--font-heading: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Body - Inter */
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Code - JetBrains Mono */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Font Imports

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

```css
/* Headings - Use Space Grotesk, font-weight: 600-700 */
--text-h1: 3.5rem;    /* 56px - Hero headlines */
--text-h2: 2.25rem;   /* 36px - Section titles */
--text-h3: 1.5rem;    /* 24px - Card titles */
--text-h4: 1.25rem;   /* 20px - Subsections */
--text-h5: 1.125rem;  /* 18px - Labels */

/* Body - Use Inter, font-weight: 400-500 */
--text-lg: 1.125rem;  /* 18px - Lead paragraphs */
--text-base: 1rem;    /* 16px - Body text */
--text-sm: 0.875rem;  /* 14px - Secondary text */
--text-xs: 0.75rem;   /* 12px - Captions, labels */

/* Line Heights */
--leading-tight: 1.25;   /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.625; /* Long-form content */
```

### Typography Rules

1. **Headings** use Space Grotesk, weight 600-700
2. **Body text** uses Inter, weight 400-500
3. **Line height** for body text should be 1.5-1.625
4. **Letter spacing** on headings: -0.02em (slightly tighter)
5. **Maximum line width** for body text: 65-75 characters
6. Use `text-balance` or `text-pretty` on headings to prevent orphans

---

## Spacing System

Use an 8px base grid system:

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### Section Spacing

- **Between major sections:** 80-96px (space-20 to space-24)
- **Between related elements:** 24-32px (space-6 to space-8)
- **Within components:** 16-24px (space-4 to space-6)
- **Tight groupings:** 8-12px (space-2 to space-3)

---

## Border Radius

```css
--radius-sm: 0.25rem;   /* 4px - Small elements, badges */
--radius-md: 0.5rem;    /* 8px - Buttons, inputs */
--radius-lg: 0.75rem;   /* 12px - Cards */
--radius-xl: 1rem;      /* 16px - Large cards, modals */
--radius-2xl: 1.5rem;   /* 24px - Hero elements */
--radius-full: 9999px;  /* Pills, avatars */
```

---

## Shadows

```css
/* Subtle - For cards on light backgrounds */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Default - For elevated cards */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

/* Prominent - For modals, dropdowns */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

/* Glow - For primary buttons on dark backgrounds */
--shadow-glow: 0 0 20px rgb(20 184 166 / 0.3);
--shadow-glow-accent: 0 0 20px rgb(163 230 53 / 0.3);
```

---

## Visual Motif: Topographic Lines

The topographic contour line pattern is a unifying visual element across all WyCo products.

### SVG Pattern

```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="topo-lines" patternUnits="userSpaceOnUse" width="100" height="100">
      <path d="M0 50 Q25 30 50 50 T100 50" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.1"/>
      <path d="M0 70 Q30 50 60 70 T100 65" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.08"/>
      <path d="M0 30 Q20 45 50 30 T100 35" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="100" height="100" fill="url(#topo-lines)"/>
</svg>
```

### CSS Background

```css
.topo-bg {
  background-image: url("data:image/svg+xml,..."); /* Encoded SVG */
  background-size: 200px 200px;
  background-repeat: repeat;
}
```

### Usage

- Use on hero sections, card backgrounds, or decorative elements
- Keep opacity low (5-15%) to avoid visual noise
- Use the primary teal color for the lines

---

## Component Patterns

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
  color: #0f172a;
  font-family: var(--font-heading);
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 20px rgb(20 184 166 / 0.4);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #f8fafc;
  border: 1px solid #334155;
  font-family: var(--font-heading);
  font-weight: 500;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
}

.btn-secondary:hover {
  border-color: #14b8a6;
  color: #14b8a6;
}
```

### Cards

```css
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.card:hover {
  border-color: #14b8a6;
  transform: translateY(-2px);
}

/* Product card with accent */
.card-product {
  border-top: 3px solid var(--product-accent);
}
```

### Inputs

```css
.input {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #f8fafc;
  font-family: var(--font-body);
}

.input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgb(20 184 166 / 0.1);
}
```

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgb(20 184 166 / 0.1);
  color: #14b8a6;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-accent {
  background: rgb(163 230 53 / 0.1);
  color: #a3e635;
}
```

---

## Product Branding

Each product uses the core WyCo palette plus its own accent color.

### WyCo Trace (Maps)

```css
:root {
  --trace-accent: #22c55e; /* Green - represents routes */
  --trace-secondary: #ef4444; /* Red - alternative route color */
}
```

### Stashery (Trains)

```css
:root {
  --stashery-accent: #f59e0b; /* Amber - warm, collectible feel */
  --stashery-secondary: #78716c; /* Stone - vintage/heritage */
}
```

### ReConfig (Homes)

```css
:root {
  --reconfig-accent: #3b82f6; /* Blue - trust, planning */
  --reconfig-secondary: #8b5cf6; /* Violet - AI/innovation */
}
```

### Irrigation App

```css
:root {
  --irrigation-accent: #06b6d4; /* Cyan - water */
  --irrigation-secondary: #22c55e; /* Green - plants/growth */
}
```

### NFC App

```css
:root {
  --nfc-accent: #a855f7; /* Purple - tech/connectivity */
  --nfc-secondary: #14b8a6; /* Teal - links to parent brand */
}
```

---

## Layout Patterns

### Container

```css
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

@media (min-width: 640px) {
  .container { padding: 0 2rem; }
}
```

### Section

```css
.section {
  padding: 5rem 0;
}

@media (min-width: 768px) {
  .section { padding: 6rem 0; }
}
```

### Grid

```css
/* Product grid */
.grid-products {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .grid-products { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid-products { grid-template-columns: repeat(3, 1fr); }
}
```

---

## Animation

```css
/* Transitions */
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;

/* Hover lift */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-lift:hover {
  transform: translateY(-2px);
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease forwards;
}
```

---

## "by WyCo Digital" Badge

Use this badge on all sub-products:

```html
<div class="wyco-badge">
  <span class="wyco-badge-text">by</span>
  <svg class="wyco-badge-logo" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z"/>
  </svg>
  <span class="wyco-badge-name">WyCo Digital</span>
</div>
```

```css
.wyco-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

.wyco-badge-logo {
  width: 1rem;
  height: 1rem;
  color: #14b8a6;
}

.wyco-badge-name {
  font-family: var(--font-heading);
  font-weight: 500;
}
```

---

## Tailwind CSS Configuration

If using Tailwind, extend with:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        accent: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          950: '#1a2e05',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
```

---

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | `#14b8a6` (teal-500) |
| Accent Color | `#a3e635` (lime-400) |
| Dark Background | `#0f172a` (slate-900) |
| Card Background | `#1e293b` (slate-800) |
| Border Color | `#334155` (slate-700) |
| Heading Font | Space Grotesk |
| Body Font | Inter |
| Border Radius | 8px (buttons), 12px (cards) |
| Max Content Width | 1280px |

---

## File Naming Conventions

```
components/
  ui/           # Shared UI components
  [product]/    # Product-specific components
  
styles/
  globals.css   # Global styles, CSS variables
  [product].css # Product-specific overrides

public/
  images/
    wyco/       # Parent brand assets
    trace/      # WyCo Trace assets
    stashery/   # Stashery assets
    ...
```

---

*Last updated: 2024 | WyCo Digital*
