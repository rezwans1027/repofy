# Repofy Design System

> "The Terminal Report" — a developer evaluation that feels like an IDE, not a marketing site.

---

## Design Philosophy

- **Dark-first.** The default (and only) theme is dark. No light mode.
- **Terminal aesthetic.** Monospace headings, traffic-light window chrome, diff views, and CLI-style inputs replace traditional SaaS patterns.
- **Typography over imagery.** No stock photos, no illustrations. Color, type, and data visualization carry the entire visual language.
- **Animations are polish, not obstacles.** Viewport-triggered reveals, animated charts, and count-ups. No scroll-jacking, no parallax.
- **Developer-friendly copy.** Concise, direct, no marketing fluff.

---

## Color Tokens

All colors are defined as CSS custom properties in `globals.css` and mapped through Tailwind v4's `@theme inline` block.

### Core Palette

| Token | Value | Tailwind Class | Usage |
|-------|-------|----------------|-------|
| `--background` | `#0A0A0B` | `bg-background` | Page background |
| `--foreground` | `#E4E4E7` | `text-foreground` | Primary text |
| `--card` | `#111113` | `bg-card` | Card / elevated surfaces |
| `--card-foreground` | `#E4E4E7` | `text-card-foreground` | Card text |
| `--primary` | `#22D3EE` | `bg-primary` / `text-primary` | Primary accent (cyan) |
| `--primary-foreground` | `#0A0A0B` | `text-primary-foreground` | Text on cyan backgrounds |
| `--secondary` | `#1A1A1D` | `bg-secondary` | Subtle backgrounds, progress bar tracks |
| `--secondary-foreground` | `#A1A1AA` | `text-secondary-foreground` | Secondary text |
| `--muted` | `#1A1A1D` | `bg-muted` | Muted backgrounds |
| `--muted-foreground` | `#71717A` | `text-muted-foreground` | De-emphasized text, labels |
| `--border` | `#27272A` | `border-border` | All borders |
| `--input` | `#27272A` | `border-input` | Input borders |
| `--ring` | `#22D3EE` | `ring-ring` | Focus rings |
| `--destructive` | `#EF4444` | `text-destructive` | Error states |

### Accent Color

| Token | Value | Tailwind Class | Usage |
|-------|-------|----------------|-------|
| `--color-cyan` | `#22D3EE` | `text-cyan` / `bg-cyan` | Primary brand accent |
| `--color-cyan-dim` | `#22D3EE80` | `text-cyan-dim` | Subdued cyan (50% opacity) |

### Chart Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--chart-1` | `#22D3EE` | Cyan — primary data |
| `--chart-2` | `#A78BFA` | Purple — secondary data |
| `--chart-3` | `#34D399` | Green — tertiary data |
| `--chart-4` | `#FBBF24` | Yellow — quaternary data |
| `--chart-5` | `#F472B6` | Pink — quinary data |

### Diff Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-diff-add` | `#22C55E` | Addition text |
| `--color-diff-remove` | `#EF4444` | Removal text |
| `--color-diff-add-bg` | `rgba(34, 197, 94, 0.1)` | Addition line background |
| `--color-diff-remove-bg` | `rgba(239, 68, 68, 0.1)` | Removal line background |

---

## Typography

### Font Families

| Font | Variable | Tailwind Class | Usage |
|------|----------|----------------|-------|
| **Inter** | `--font-inter` | `font-sans` | Body text, descriptions, paragraphs |
| **JetBrains Mono** | `--font-jetbrains-mono` | `font-mono` | Headings, labels, data values, code, badges |

Both fonts are loaded via `next/font/google` in `layout.tsx`.

### Type Scale

| Usage | Class | Example |
|-------|-------|---------|
| Section heading | `font-mono text-xl sm:text-2xl font-bold tracking-tight` | `.Code DNA` |
| Card heading | `font-mono text-lg font-bold` | Profile name |
| Grade display | `font-mono text-7xl font-bold text-cyan` | `A-` |
| Pricing price | `font-mono text-3xl font-bold` | `Free` |
| Body text | `text-sm` (Inter) | Descriptions, summaries |
| Label / caption | `font-mono text-xs text-muted-foreground` | Metric labels |
| Micro text | `text-[10px]` or `text-[9px]` | Badge labels, chart month labels |

### Heading Convention

Section headings use a **cyan dot prefix**:

```
<span class="text-cyan mr-2">.</span>Code DNA
```

This is handled by the `SectionHeader` component.

---

## Spacing

| Context | Value |
|---------|-------|
| Page max-width | `max-w-4xl` (896px) |
| Navbar max-width | `max-w-7xl` (1280px) |
| Page horizontal padding | `px-4 sm:px-6 lg:px-8` |
| Section vertical padding | `py-20` |
| Card padding | `p-6` |
| Navbar height | `h-14` (56px) |
| Sidebar width | `w-48` (192px, desktop only) |

---

## Border Radius

Base radius is `0.625rem` (10px). Computed variants:

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small elements |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 10px | Cards, containers |
| `--radius-xl` | 14px | Large cards |

---

## Layout

### Split-Panel Structure

```
┌──────────────────────────────────────────┐
│  Navbar (fixed, full-width, z-50)        │
├────────┬─────────────────────────────────┤
│        │                                 │
│ Section│      PageContainer              │
│  Nav   │      (max-w-4xl, centered)      │
│ (fixed │                                 │
│  left, │      Scrollable sections        │
│  w-48) │                                 │
│        │                                 │
├────────┴─────────────────────────────────┤
│  Footer                                  │
└──────────────────────────────────────────┘
```

- **Desktop (lg+):** Fixed left nav rail, content offset with `lg:pl-48`
- **Mobile:** Horizontal sticky nav bar below navbar, full-width content

### Page Sections

| # | ID | Component |
|---|----|-----------|
| 0 | `analysis-input` | AnalysisInput (hero) |
| 1 | `profile-summary` | ProfileSummary |
| 2 | `code-dna` | CodeDna |
| 3 | `language-fingerprint` | LanguageFingerprint |
| 4 | `commit-signature` | CommitSignature |
| 5 | `verdict` | Verdict |
| 6 | `how-it-works` | HowItWorks |
| 7 | `pricing` | Pricing |

---

## Components

### Layout Components

#### `Navbar`
Fixed top bar with logo and CTA button. Uses `bg-background/80 backdrop-blur-md` for transparency.

#### `SectionNav`
Left rail (desktop) / horizontal sticky bar (mobile) with section links. Active section is detected via `useActiveSection` hook (IntersectionObserver) and highlighted with cyan text and a dot indicator.

#### `PageContainer`
Wraps main content with proper offsets for navbar and sidebar.

#### `Footer`
Single-row footer with logo, tagline, and social links.

---

### Custom UI Components

#### `AnimateOnView`
Framer Motion wrapper that fades and slides children in when they enter the viewport.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content to animate |
| `className` | `string` | — | Optional wrapper class |
| `delay` | `number` | `0` | Animation delay in seconds |

#### `SectionHeader`
Monospace heading with cyan dot prefix.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Section title |
| `subtitle` | `string` | — | Optional subtitle in muted text |

#### `MetricBar`
Animated horizontal progress bar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Metric label |
| `value` | `number` | required | Current value |
| `max` | `number` | `100` | Maximum value |
| `color` | `string` | `var(--primary)` | Bar fill color |
| `className` | `string` | — | Optional wrapper class |

#### `TerminalWindow`
Terminal chrome container with macOS-style traffic-light dots (red, yellow, green).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"terminal"` | Title in the title bar |
| `children` | `ReactNode` | required | Window content |
| `className` | `string` | — | Optional outer class |

#### `CountUp`
Animated number counter that starts when scrolled into view. Uses ease-out cubic easing.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `end` | `number` | required | Target number |
| `duration` | `number` | `2000` | Duration in ms |
| `suffix` | `string` | `""` | Text after number (e.g., `%`) |
| `prefix` | `string` | `""` | Text before number |
| `className` | `string` | — | Optional class |

#### `RadarChart`
Custom SVG spider/radar chart with animated path drawing.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `{ axis: string; value: number }[]` | required | Data points (value 0-1) |
| `size` | `number` | `280` | SVG viewBox size |

#### `HeatmapGrid`
CSS Grid contribution calendar (7 rows x 52 columns) with cascading fill animation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `number[][]` | required | 7x52 grid, values 0-4 |

Heatmap color scale: `secondary` (0) → `#064E3B` (1) → `#065F46` (2) → `#047857` (3) → `#22D3EE` (4)

#### `DiffBlock`
Styled diff lines with slide-in animation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lines` | `{ type: "add" \| "remove"; text: string }[]` | required | Diff lines |
| `delay` | `number` | `0` | Animation delay in seconds |

---

### shadcn/ui Components

Installed via `shadcn` CLI (New York style, Zinc base). All live in `src/components/ui/`.

| Component | Import |
|-----------|--------|
| Avatar | `@/components/ui/avatar` |
| Badge | `@/components/ui/badge` |
| Button | `@/components/ui/button` |
| Card | `@/components/ui/card` |
| Input | `@/components/ui/input` |
| Separator | `@/components/ui/separator` |
| Skeleton | `@/components/ui/skeleton` |
| Tabs | `@/components/ui/tabs` |
| Tooltip | `@/components/ui/tooltip` |

---

## Providers

### `ThemeProvider`
Wraps `next-themes` with `defaultTheme="dark"` and `enableSystem={false}`. Dark mode is the only mode.

### `AnalysisProvider`
Context provider for demo analysis state. Exposes:

| Value | Type | Description |
|-------|------|-------------|
| `state.username` | `string` | Entered GitHub username |
| `state.isAnalyzing` | `boolean` | Analysis in progress |
| `state.isComplete` | `boolean` | Analysis finished |
| `startAnalysis(username)` | `function` | Trigger analysis (simulated 2s delay) |
| `reset()` | `function` | Reset to initial state |

---

## Animation Patterns

### Viewport-Triggered Reveals
Wrap content in `<AnimateOnView>` to fade + slide up on scroll. Uses `viewport={{ once: true }}` so animations only play once.

```tsx
<AnimateOnView delay={0.1}>
  <Card>...</Card>
</AnimateOnView>
```

### Stagger Pattern
Use incrementing `delay` props for sequential reveals:

```tsx
{items.map((item, i) => (
  <AnimateOnView key={item.id} delay={0.05 * i}>
    ...
  </AnimateOnView>
))}
```

### Progress Bars
`MetricBar` and language bars animate width from 0 to target `whileInView`.

### Cascading Heatmap
Each cell in `HeatmapGrid` fades in with a tiny stagger: `delay: (week * 7 + day) * 0.002`.

### Radar Chart Path
SVG path draws in using `pathLength` animation from 0 to 1, followed by staggered data point circles.

### CountUp Numbers
Triggered by IntersectionObserver. Uses `requestAnimationFrame` with cubic ease-out.

### Typewriter Effect
Hero input cycles through usernames with character-by-character typing and deletion. Blinking cursor uses CSS `step-end` animation.

---

## Scrollbar

Custom WebKit scrollbar: 6px wide, transparent track, `#27272A` thumb (matches `--border`), `#3F3F46` on hover.

---

## Responsive Breakpoints

Uses Tailwind defaults:

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Default | 0px | Single column, horizontal nav bar, compact padding |
| `sm` | 640px | Wider padding, larger headings |
| `md` | 768px | Two-column grids (CodeDNA, Verdict, Pricing) |
| `lg` | 1024px | Left sidebar nav, content offset (`pl-48`) |

---

## Copy Voice

Developer-friendly, concise, no fluff. Examples:

- *"Paste any GitHub username. See what we see."*
- *"We read the code. All of it."*
- *"Language !== skill"*
- *"Patterns reveal practice"*
- *"One page. No guesswork."*
- *"The old way is broken."*
- *"Free while in beta. No credit card. No catch."*
- *"Built for developers who hire developers."*

---

## File Structure

```
src/
├── app/
│   ├── globals.css           # Tailwind imports, color tokens, custom CSS
│   ├── layout.tsx            # Fonts, ThemeProvider, AnalysisProvider, metadata
│   └── page.tsx              # Assembles all sections
├── components/
│   ├── layout/
│   │   ├── navbar.tsx
│   │   ├── section-nav.tsx
│   │   ├── page-container.tsx
│   │   └── footer.tsx
│   ├── sections/
│   │   ├── analysis-input.tsx
│   │   ├── profile-summary.tsx
│   │   ├── code-dna.tsx
│   │   ├── language-fingerprint.tsx
│   │   ├── commit-signature.tsx
│   │   ├── verdict.tsx
│   │   ├── how-it-works.tsx
│   │   └── pricing.tsx
│   ├── ui/                   # Custom + shadcn components
│   │   ├── animate-on-view.tsx
│   │   ├── section-header.tsx
│   │   ├── metric-bar.tsx
│   │   ├── terminal-window.tsx
│   │   ├── count-up.tsx
│   │   ├── radar-chart.tsx
│   │   ├── heatmap-grid.tsx
│   │   ├── diff-block.tsx
│   │   └── [shadcn components]
│   └── providers/
│       ├── theme-provider.tsx
│       └── analysis-provider.tsx
├── hooks/
│   └── use-active-section.ts
└── lib/
    ├── utils.ts              # cn() helper
    ├── constants.ts          # Section IDs, nav labels
    └── demo-data.ts          # Static mock data
```
