# Handoff: LOCKIN — CS2 Pocket Coach (visual identity + 4 screens)

## Overview
LOCKIN is a free, self-contained CS2 training-coach app: a 7-question quiz builds a
personalised plan, then a daily tracker keeps players on it (streaks, per-day drill
checklist, progress). This handoff covers a full redesign — a distinctive visual
identity and redesigned layouts for the four core screens (Today, Quiz, Plan, Setup),
plus a desktop layout — replacing the current "generic dark gamer" look.

## About the Design Files
`LOCKIN.dc.html` is a **design reference created in HTML** — a working prototype that
shows the intended look, motion and behavior. It is authored as a "Design Component"
(a streaming preview format) and is **not** the production file to ship as-is.

The target is the existing repo (https://github.com/jacquesvn/lockin) whose hard
constraint is **ONE self-contained HTML file**: everything inline, no external fonts,
no CDNs, no remote images, strict CSP; must render identically as a web page, an
installed PWA (phone + desktop) and inside a desktop webview; theme-aware, responsive
360px→desktop, ~40KB, WCAG-AA, keyboard-focusable, honours prefers-reduced-motion.

**The task:** recreate this design in that single-file app using its existing vanilla
patterns. All the CSS is already plain/inline-friendly and all icons are inline SVG
or CSS masks, so it ports directly to a hand-written `index.html` + a small `<script>`.
No framework or build step is required (and none should be added).

## Fidelity
**High-fidelity.** Final colors, type treatment, spacing, components and motion.
Recreate pixel-close. Exact token values are in the Design Tokens section and are
also visible in the "03 · COLOR TOKENS" panel of the prototype.

## Design Tokens

Defined as CSS custom properties on `:root` (dark, default) and `[data-theme="light"]`.
Theme switches by flipping the `data-theme` attribute on the root element.

### Dark (default)
- bg / ink: `oklch(0.168 0.004 100)`
- surface: `oklch(0.205 0.005 100)`  · surface2: `oklch(0.248 0.006 100)`
- line: `oklch(0.315 0.006 100)`  · line2: `oklch(0.40 0.008 100)`
- text: `oklch(0.965 0.004 100)`  · muted: `oklch(0.665 0.006 100)`  · faint: `oklch(0.50 0.006 100)`
- hero (yellow): `oklch(0.865 0.165 96)`  · hero2 (pressed): `oklch(0.80 0.16 96)`  · onhero (text on yellow): `oklch(0.20 0.03 96)`
- good: `oklch(0.805 0.15 152)`  · bad: `oklch(0.685 0.19 27)`  · info: `oklch(0.78 0.085 225)`
- stage (page bg): `oklch(0.128 0.004 100)`

### Light
- bg / bone: `oklch(0.948 0.004 95)`
- surface: `oklch(0.995 0.003 95)`  · surface2: `oklch(0.922 0.006 95)`
- line: `oklch(0.855 0.006 95)`  · line2: `oklch(0.77 0.008 95)`
- text: `oklch(0.205 0.006 95)`  · muted: `oklch(0.44 0.006 95)`  · faint: `oklch(0.575 0.006 95)`
- hero: `oklch(0.845 0.17 91)`  · hero2: `oklch(0.79 0.16 91)`  · onhero: `oklch(0.18 0.035 91)`
- good: `oklch(0.55 0.14 152)`  · bad: `oklch(0.53 0.20 27)`
- stage: `oklch(0.90 0.005 95)`

### Type
- Display: `'Helvetica Neue', Helvetica, Arial, sans-serif` — weight 800, UPPERCASE, letter-spacing -0.02 to -0.04em. Scoreboard weight.
- Body: `system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`.
- Mono (data/labels): `ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace` — used uppercase, letter-spacing 0.1–0.2em for HUD labels.
- No web fonts — system stacks only (satisfies the no-CDN / size constraints).

### Spacing / radius
- Spacing rhythm: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Radius: cards 14–16, controls/buttons 10–12, checkbox 7, small labels 4–5, pills 999.
- Borders: 1px `--line` default; selected/active states use `--hero` at 1.5px.
- Shadows: used only on the device/window frames, not on inner cards.

## Logo / Mark
Four-corner **targeting reticle** (HUD frame) with an open center dot — the old
crosshair rebuilt so it "locks on." Inline SVG, `viewBox 0 0 32 32`, `stroke=currentColor`,
`stroke-width 2`, `stroke-linecap square`:
`<path d="M3 9V3h6M23 3h6v6M3 23v6h6M29 23v6h-6"/>` (corners) +
`<path d="M16 8.5v3.5M16 20v3.5M8.5 16h3.5M20 16h3.5"/>` (ticks) +
`<circle cx="16" cy="16" r="1.9" fill="currentColor"/>`.
Wordmark `LOCKIN` in display face, uppercase; the **IN** always carries `--hero`.
App icon = the reticle knocked out of a solid `--hero` tile (used as the scanning
frame in the win animation).

## Screens / Views

### 1. TODAY (money screen)
- **Purpose:** daily hub — see streak, tick today's drills, log hand-feel.
- **Layout (mobile):** vertical scroll. Header (date/context mono label + "TODAY" display title + profile icon). Streak hero card. Focus divider. Drill list. Hand-feel card. Footer motto. Fixed bottom tab bar.
- **Streak hero:** surface card, faint radial `--hero` glow top-right (opacity .10). Left: mono "CURRENT STREAK" + big number (64px display, `--hero`) + "DAYS LOCKED IN". Right: "THIS WEEK" + `weekDone/weekTarget` + status ("ON PACE"/"TARGET HIT" in `--good`). Below: 7-cell **week strip**.
- **Week strip cell:** 30px tall, radius 8, mono 12px bold. States — done: `--hero` bg / `--onhero` text / "✓"; today: transparent, 1.5px `--hero` border, `--hero` "●"; rest: dashed `--line2` border, "—"; upcoming: `--surface2` bg.
- **Drill row (checkable):** flex row, surface card, `border-left:3px` (`--hero` when done, else `--line`). 26px checkbox (radius 7) — unchecked: 1.5px `--line2` border transparent; checked: `--hero` fill + `--onhero` check SVG. Body: name (dims to `--muted` when done), CORE chip (mono, `--hero`), sub line, mono measure line prefixed "◎". Right: duration `NN′`. Whole row and checkbox toggle done. Done row drops to opacity .72. Transition 0.15s.
- **Hand-feel logger:** 5 buttons 1–5; filled `--hero` up to the selected value, else `--surface2`. Label word changes: Off / Shaky / OK / Warm / Dialled (color: `--good` at ≥4, `--bad` at ≤2, else `--muted`).

### 2. QUIZ (onboarding)
- **Purpose:** 7 single/multi-select questions → generating → "LOCKED IN" reveal.
- **Layout:** title + step counter (mono "0N / 07"); 7-segment progress bar (filled segments `--hero`, rest `--surface2`); mono kicker; display question; muted hint; option list; BACK + NEXT row (NEXT disabled/greyed until answered; last step label "LOCK IT IN ▸").
- **Quiz option:** full-width button, 1.5px border (`--hero` + 10%-hero bg when selected, else `--line`). Tick indicator: circle for single-select, rounded square for multi; filled `--hero` with check when selected.
- **Generating:** ~1.4s — reticle inside a spinning ring, blinking mono "COMPILING TRAINING PLAN…".
- **Reveal:** see Signature Moment. Ends with a Diagnosis card (FOCUS + CADENCE derived from answers) and a "START DAY 1 ▸" primary button → Today.

### 3. PLAN
- **Purpose:** the generated program.
- **Sections:** Diagnosis card (surface, `border-left` `--hero`). "12-WEEK PHASES" — 3 numbered rows (Foundations WK1–4 / Sharpen WK5–8 / Compete WK9–12), big `--hero` numeral + divider + name/weeks/desc. "WEEKLY FOCUS ROTATION" — 2-col grid of week cards (current week highlighted with `--hero` border + 10% bg). "DRILL LIBRARY" — rows with mono category tag, name, "MEASURE ·" line, duration.

### 4. SETUP
- **Purpose:** profile / retake / theme / backup.
- **Sections:** Profile card (avatar tile, handle, rank·mode·streak mono line, RETAKE button → Quiz). APPEARANCE — Theme segmented DARK/LIGHT. DATA · LOCAL ONLY — Export (.json) and Restore rows (download/upload SVGs). Footer: "LOCKIN · FREE FOREVER · NO ACCOUNT · v1.0".

### Desktop layout
Same screens/state in a window: left **sidebar** (236px — mark, vertical nav Today/Plan/Setup + Retake, streak mini, theme toggle) + scrolling main. Today uses a horizontal streak banner (number | week progress bar + strip) then a 2-col grid (drills | hand-feel + "THE RULE" tip). Plan is 2-col (diagnosis+phases | rotation+library). Quiz/Setup are centered columns. Breakpoint: single column / bottom-tab below ~720px; sidebar layout above.

## Interactions & Behavior
- **Tap drill / checkbox** → toggles done (0.15s). When the **last CORE drill** completes: streak +1, weekDone +1 (capped at target), fire the celebrate overlay (see below).
- **Hand-feel** → sets 1–5, updates fill + label/color.
- **Quiz** → pick sets answer (multi toggles); NEXT advances (disabled until answered); after Q7 → 1.4s generating → reveal. START DAY 1 resets quiz and routes to Today. RETAKE routes to Quiz.
- **Theme toggle** → flips `data-theme`; persist to localStorage; also default from `prefers-color-scheme` on first load.
- **Nav** (bottom tabs / sidebar) → switch screen.

## Signature Moment — "the lock-on beat"
On completing the last core drill (and on the quiz reveal): a reticle/lock badge
**scales in 1.55→1** (`cubic-bezier(.2,.9,.2,1)`, ~0.45s), a **ring pings** outward
(scale .7→2.1, opacity→0, ~0.9s), a **scan line** sweeps top→bottom (celebrate overlay
only), text "DAY SECURED" + "STREAK ▸ N DAYS" rise in. Overlay auto-dismisses after
~1.7s. Keyframes: `lk-snap`, `lk-ping`, `lk-scan`, `lk-rise` (all in the prototype
`<style>`). **All motion disabled under `prefers-reduced-motion`** — values still update,
overlay still shows briefly, no animation.

## State Management
`theme`, `screen` ('today'|'quiz'|'plan'|'setup'), `streak`, `weekDone`, `weekTarget`,
`handFeel` (0–5), `drills[]` ({id,title,sub,dur,core,measure,done}), `quizStep`,
`quizAnswers{}`, `generating`, `quizDone`, `celebrate`. Persist streak/week/drills/
answers/theme to **localStorage** (app is account-less, local-only). Derive the plan
(focus, cadence, diagnosis) from `quizAnswers` — mapping is in the prototype's
`renderVals()` (weak → focus map; days/time → cadence string).

## Assets
None external. All graphics are inline SVG (reticle, check, lock, up/down, profile,
nav icons) or CSS. Nav icons are drawn as CSS `mask` from inline data-URI SVGs.

## Files
- `LOCKIN.dc.html` — the full working design reference (both themes, all 4 screens,
  phone + desktop, live interactions). Open in a browser to click through it; read the
  `<style>` for keyframes and the logic class for exact state/derivation logic.
