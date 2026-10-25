# Design Brief

## Direction

Vitals Ledger — a calm clinical instrument for personal health data, built as a mobile-first PWA-style web app.

## Tone

Refined clinical serenity: soft blue-green medical palette, generous whitespace, and instrument-like precision rather than consumer-app playfulness.

## Differentiation

Every vital sign renders as a monospace "ledger reading" on a tinted card with a colored status rail — the record reads like a lab sheet you own, not a dashboard you rent.

## Color Palette

| Token      | OKLCH         | Role                                  |
| ---------- | ------------- | ------------------------------------- |
| background | 0.98 0.008 220 | Cool off-white page canvas            |
| foreground | 0.22 0.02 235  | Primary clinical text                 |
| card       | 1.0 0.004 220  | Elevated reading surfaces             |
| primary    | 0.5 0.11 225   | Deep ocean blue — actions & nav       |
| accent     | 0.66 0.115 175 | Soft teal — highlights, live data     |
| muted      | 0.945 0.012 220 | Section alternation, inactive states  |
| success    | 0.62 0.15 158  | Low-risk band, connected state        |
| warning    | 0.72 0.15 78   | Moderate-risk band                    |
| destructive| 0.55 0.21 25   | High-risk band, red-flag emergency    |

## Typography

- Display: Space Grotesk — headings, module titles, nav wordmark
- Body: Figtree — paragraphs, labels, forms, plain-language copy
- Mono: Geist Mono — vital readings, risk scores, timestamps, UUIDs
- Scale: hero `text-3xl md:text-5xl font-bold tracking-tight`, h2 `text-2xl md:text-3xl font-bold`, label `text-xs font-semibold tracking-widest uppercase`, body `text-base leading-relaxed`

## Elevation & Depth

Flat cool canvas with two shadow tiers — `shadow-subtle` for resting cards and `shadow-elevated` for the sticky disclaimer banner, nav, and modals; no glow effects.

## Structural Zones

| Zone    | Background            | Border                    | Notes                                          |
| ------- | --------------------- | ------------------------- | ---------------------------------------------- |
| Header  | `bg-card` + blur      | `border-b`                | Sticky top nav + persistent disclaimer banner  |
| Content | `bg-background`       | —                         | Alternate `bg-muted/30` sections for rhythm    |
| Footer  | `bg-muted/40`         | `border-t`                | Privacy note + educational disclaimer restated |

## Spacing & Rhythm

Mobile-first single column with `px-4` gutters and `gap-4` stacking; sections separated by `py-8 md:py-12`, cards use `p-5`, micro-spacing `gap-2` inside reading rows.

## Component Patterns

- Buttons: `rounded-lg` (primary, gradient) and `rounded-full` (pills); `tap-target` min 44px; hover lifts with `shadow-elevated`
- Cards: `rounded-xl` `bg-card` `border` `shadow-subtle`; risk cards add a 4px left status rail colored by band
- Badges: `rounded-full` tinted fills — success/warning/destructive for risk bands, accent for live/connected

## Motion

- Entrance: `fade-in-up` 0.4s ease-out, staggered 60ms across list items
- Hover: `transition-smooth` 0.3s lift and border-color shift
- Decorative: `pulse-live` 2s infinite on the Bluetooth streaming indicator only

## Constraints

- WCAG 2.1 AA contrast in both modes; never rely on color alone — pair band color with text labels and icons
- Mobile-first for Chrome; minimum 44px tap targets; plain-language copy throughout
- All health data stays client-side (IndexedDB); no server calls, no trackers, no signup
- Never auto-connect Bluetooth; never social-share results; red-flag states always override predictions

## Signature Detail

A left-edge status rail on every reading card — a 4px color bar encoding risk band or connection state, echoing a clinical chart tab.
