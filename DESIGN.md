# DESIGN.md — organize site + Committee Workspace

Locked design system. Agent outputs defer to this file. Conversion rule:
hex→OKLCH, same hues; nothing rebranded.

/* Hallmark · pre-emit critique: P5 H4 E4 S4 R5 V4 — union-poster utilitarian,
   theme: Broadsheet (tuned custom) · paper light-warm / display heavy grotesk
   (system 900) / accent warm red — system-managed (diversification suspended) */

## Genre + voice — classic union posters

The visual language of 1930s–70s labor posters: cream paper, heavy ink-black
letterpress blocks, poster red for action, thick rules, stamp-like badges.
Dense, blunt, urgent — a hand-set flyer you'd grab off a table. Copy rules stay
`plans/01-content.md` §Voice; the poster voice is in the TYPE and the BLOCKS,
not in shouty copy. **CSP constraint: no poster fonts available — poster feel
comes from weight and composition, not typefaces.**

Poster moves (use these, not gradients/glow/stock):
- Display: uppercase, weight 800–900, tight tracking (-0.02em), hard left
  alignment; set inside a full-bleed ink or red block where the moment calls
  for it (Today meter, Lock, danger confirmations).
- Blocks: 2–3px ink borders, squared corners, flat color fields — no shadows
  except real overlays; no rounded-SaaS pills, no glass.
- Badges: stamp-like, 1px–2px rule, tiny rotation (-2deg) reserved for
  status stamps (CERTIFIED, DEADLINE, chain-verified) — never for navigation.
- Dividers: heavy 2px rules, optional ★ rule between major app sections.
- Red is the ACTION color (retaliation button, danger, deadline). It must stay
  scarce: one red block per screen view, or it stops meaning anything.
- Contrast is law: poster red on cream is for large/bold text and fills with
  paper text only; body copy stays ink-on-cream (WCAG AA always wins over
  poster drama).

## Color (OKLCH, single source of truth)

| Token | Value | Role |
|---|---|---|
| `--paper` | oklch(0.99 0.008 90) | page background |
| `--ink` | oklch(0.24 0.02 70) | text, primary buttons |
| `--muted` | oklch(0.45 0.03 70) | secondary text (4.5:1 on paper) |
| `--rule` | oklch(0.88 0.02 80) | hairlines |
| `--red` | oklch(0.55 0.19 30) | retaliation CTA, danger actions |
| `--red-dark` | oklch(0.47 0.17 30) | danger hover/active |
| `--focus` | oklch(0.5 0.18 262) | focus ring (3px, never animated) |
| `--surface` | oklch(0.96 0.01 85) | cards, wells |
| `--ok` | oklch(0.5 0.14 150) | success states |

Rating scale (workspace only; **words always shown — color is secondary,
never the sole indicator** — AGENTS.md a11y rule):

| Token | Value |
|---|---|
| `--r1` | oklch(0.5 0.15 145) |
| `--r2` | oklch(0.62 0.13 120) |
| `--r3` | oklch(0.75 0.12 95) |
| `--r4` | oklch(0.66 0.14 55) |
| `--r5` | oklch(0.55 0.19 25) |

## Type

System stack only (CSP; no webfonts): `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
Poster display = system 800–900, UPPERCASE, tracking -0.02em — punch via weight
and alignment, never a fake condensed hack. Scale (1.2 ratio, rem):
`--text-sm 0.8125 · --text-base 1 · --text-lg 1.25 · --text-xl 1.5625 ·
--text-2xl 1.875 · --text-poster 2.5`. Headings roman only. Measure ≤ 68ch.
Line-height 1.55 body, 1.05 poster display.

## Space + shape

4-pt scale: `--space-1 4 · --space-2 8 · --space-3 12 · --space-4 16 ·
--space-6 24 · --space-8 32 · --space-12 48`. Radius: `--radius-sm 2 ·
--radius-md 4` (poster corners are near-square; nothing rounder than 4).
2–3px ink rules over shadows; shadows only for true overlays (dialogs).

## Motion

Motion-cut project. Allowed: opacity crossfades ≤150ms for dialog/result
reveals, and `transform` on press (translateY 1px). Nothing else. Easing
`--ease-out: cubic-bezier(.2,.7,.3,1)`. `prefers-reduced-motion: reduce`
collapses even those. Focus rings appear instantly.

## Components — 8-state discipline (mandatory)

Every interactive element ships styling for: default · hover · `:focus-visible`
· active · disabled *(aria-disabled + explain; never a dead submit button)* ·
loading · error · success. States also render via `.is-*` classes so tests and
previews can force them. Tool pages carry no analytics; error paths are inline,
never toasts.

## App-specific rules (workspace screens 0–11)

- 360px one-handed: primary action in thumb zone, min 44px targets.
- Quick Exit (button + Esc×2) on every screen; leaving-site warning on all
  outbound links.
- Numbers with words: majority meter shows "now / 30% filing floor / 70% go"
  as text, not just a bar. Ratings show words next to the number.
- Lock screen (0) is neutral-disguised; no union vocabulary in its chrome.
- Print: wallet card and evidence timeline must print clean at A7/A4 in ink
  (no color dependency).

## Slop gates that bite here

46 (no invented numbers — stats come from the drive's own data or cited
sources), 38a (no italic headers), 47 (no fake phone/browser chrome in docs or
screens), 34 (no horizontal scroll; `overflow-x: clip`), 49 (no two-line
buttons), 51 (headers `overflow-wrap: anywhere`), plus WCAG 2.2 AA everywhere
(contrast, labels, `aria-invalid`, focus moved to first invalid field).

## antislop overlay (applies with the gates above)

- **R-02:** UI copy carries no em dash. Prose content pages are the owner's
  voice call (`plans/01-content.md` §Voice); UI chrome follows the ban.
- **R-08 purpose (arrows):** the `→` on "Boss retaliating? →" and external
  action links is the poster's directional mark (sitemap-specified identity),
  one arrow per action, never decoration on secondary buttons.
- **R-09:** badges are status stamps only (CERTIFIED, chain-verified,
  DEADLINE). No "New/Beta" capsules anywhere.
- **R-27:** every workspace screen ships empty, loading and error states;
  local-compute tools show their result state inline (no loading theater).
- **Dials:** ENERGY 2 / RHYTHM 2 / MOTION 1. One focal block per screen (the
  red action block, when present). Identity motif: the ink-block headline with
  heavy uppercase display + the stamp badge.

## Handoff

`tokens.css` at app root is generated from this file and is the only place raw
values live; components reference tokens by name. Component outputs carry:
`/* Hallmark · component: <type> · genre: union-poster · theme: Broadsheet
 * states: all 8 · contrast: pass (46–50) */`
