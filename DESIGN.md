---
name: DNSQUEEN
description: A split-flap concourse board for extracting clean IP lists from messy text.
world: "signals-instruments-split-flap-concourse"
colors:
  flap-black: "#0b0b0d"
  plate: "#111114"
  plate-2: "#141417"
  plate-3: "#1c1c21"
  rule: "#2a2d31"
  rule-strong: "#5b5e63"
  steel: "#a7aaaf"
  amber: "#ffb000"
  amber-soft: "rgba(255, 176, 0, 0.09)"
  red: "#ff6b6b"
  red-deep: "#b00020"
  chalk: "#f2f2f2"
  chalk-dim: "#b9bcc2"
  chalk-faint: "#8b8e94"
  ok: "#4ade80"
  warn: "#fbbf24"
  danger: "#fb7185"
  info: "#7dd3fc"
  tag-private: "#a7aaaf"
typography:
  display:
    fontFamily: "Oswald, 'Vazirmatn Variable', system-ui, sans-serif"
    fontSize: "clamp(24px, 3.4vw, 30px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
  title:
    fontFamily: "Oswald, 'Vazirmatn Variable', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.14em"
  body:
    fontFamily: "'Vazirmatn Variable', 'Vazirmatn', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Oswald, 'Vazirmatn Variable', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.62
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  shell: "clamp(14px, 2.4vw, 28px)"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "#0b0b0d"
    rounded: "{rounded.sm}"
    padding: "11px 24px"
  button-primary-hover:
    backgroundColor: "#ffc233"
  button-steel:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.sm}"
    padding: "11px 24px"
  button-steel-hover:
    backgroundColor: "{colors.plate-3}"
  tool-pill:
    backgroundColor: "{colors.plate-2}"
    textColor: "{colors.chalk-dim}"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
  toggle-on:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.pill}"
    padding: "6px 12px 6px 9px"
---

# Design System: DNSQUEEN

## Overview

**Creative North Star: "The Departure Board"**

DNSQUEEN is a split-flap concourse board, not a utility form. The clean list is the event: paste messy text and the addresses flip into place row by row, as if the board were re-ranking live. The page is a steel-framed board on flap-black ground — dense, ruled, and mechanical — where the count is the board and every address has a numbered row with a version and a category. Nothing is a quiet table of results; nothing is silently dropped.

The system is restrained on purpose. One condensed face carries all board data, one mono face carries all addresses, one accent (delay amber) marks change, and one red marks rejection. Depth comes from hairline rules and tonal layering, never from shadow, glow, or gradient. The crown mark stays in unlit steel. The world is professional and mechanical — far from the violet glow, cream serif, and purple gradient the old identity carried.

**Key Characteristics:**
- Flap-black ground, letter-white type, brushed-steel frame
- One enormous tabular count as the lead cell of a single stats surface
- Ruled board rows in fixed cells: number, address, version, category, status, copy
- State is colour plus text: amber means changed, red means dropped, white means filed
- Flat everywhere; hairline rules do the work shadows usually do

## Colors

One accent on a near-black ground; steel does the framing, chalk does the reading.

### Primary
- **Delay Amber** (#FFB000): the only accent. The primary action, the focus ring, the selection colour, the changed-row wash, and the on-state of every toggle and segmented control. Its rarity is the point.

### Neutral
- **Flap Black** (#0B0B0D): page ground and the dark theme's base.
- **Plate** (#111114): the shell and the raised surface the board sits on.
- **Plate 2** (#141417): panes, the stats strip, tool pills, and the controls panel.
- **Plate 3** (#1C1C21): hover surfaces and the deepest tonal step.
- **Rule** (#2A2D31): hairline dividers between cells and rows.
- **Rule Strong** (#5B5E63): the shell frame and the strongest hairline.
- **Steel** (#A7AAAF): the frame metal, the crown mark, and private-row addresses.
- **Letter White** (#F2F2F2): primary text.
- **Chalk Dim** (#B9BCC2): secondary text, hints, and the brand tagline.
- **Chalk Faint** (#8B8E94): labels, board headers, and meta text on dark; darkened to #6B6E75 on light for contrast.
- **Cancel Red** (#FF6B6B on dark, #B00020 on light): dropped or rejected items and error states only.
- **Toast Tones** (#4ADE80 ok, #FBBF24 warn, #FB7185 danger, #7DD3FC info): toast borders and backgrounds only; never used as brand colour.

Light theme is the same board in daylight: white flap faces (#FFFFFF), ink letters (#1C1C1E), the same steel frame and the same amber and red states. Only tokens change; no component needs a second stylesheet. In light, amber text darkens to #7A5200 and red becomes #B00020 so both keep their meaning at full contrast.

### Named Rules
**The One Accent Rule.** Amber is the only accent on any screen. No second accent colour, no violet, no purple, no cyan-on-dark.
**The Amber Means Changed Rule.** Amber marks a row that just changed, a control that is on, or the primary action — never decoration.
**The Red Means Dropped Rule.** Red marks a dropped, rejected, or erroneous item — never emphasis, never a brand moment.

## Typography

**Display Font:** Oswald (with Vazirmatn Variable fallback)
**Body Font:** Vazirmatn Variable (with Vazirmatn, system-ui fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Menlo fallback)

**Character:** One condensed sans carries the whole board voice — brand, count, headers, status, buttons — while IBM Plex Mono carries every address and every number that must not reflow, and Vazirmatn carries the human interface text. The pairing is mechanical and tabular: condensed caps for the board, mono for the data, human type for the words around them. Numbers and addresses stay LTR even inside an RTL page.

### Hierarchy
- **Display** (Oswald 600, clamp(24px, 3.4vw, 30px), line-height 1, letter-spacing 0.12em): the DNSQUEEN wordmark. The big stats count uses the same face at 40px, weight 500, tabular numerals.
- **Title** (Oswald 500, 13px, line-height 1, letter-spacing 0.14em): pane heads and section labels.
- **Body** (Vazirmatn 400, 15px, line-height 1.6): interface text, hints, and empty states.
- **Label** (Oswald 500, 10px, line-height 1, letter-spacing 0.16em): board column headers and control labels.
- **Mono** (IBM Plex Mono 500, 13.5px, line-height 1.62): IP addresses in board rows; 400 at 13px in the input; 10–11px for pane meta, strip notes, and footer.

### Named Rules
**The One Condensed Face Rule.** Oswald is the only display face. Never a system display face, never an overused face (Inter, Roboto, Fraunces, Geist, Plus Jakarta Sans, Space Grotesk).
**The Data Is Mono Rule.** Every address, port, count, and timing note is IBM Plex Mono with tabular numerals. Board data never renders in the UI face.

## Layout

A single steel-framed shell (max-width 1180px, centred, 18px top margin) holds the whole page: top rail, one stats surface, one stage of two panes (input, board), the controls panel, and a footer line. The shell's padding is clamp(14px, 2.4vw, 28px) horizontally and 26px at the bottom; the vertical rhythm between sections is clamp(12px, 1.6vw, 18px).

The stage is a two-pane grid (1fr input, 1.25fr board) that stacks to a single column below 900px. The board scrolls internally (max-height min(58vh, 520px); 44vh below 900px) while the page stays put. The stats strip is six cells in a row on desktop (lead cell 1.4fr, the rest 1fr) and a two-column grid below 620px, where the big count and the last cell each span the full width. Board rows are fixed-cell grids (30px number, flexible address, 34px version, 92px category, 64px status, 34px copy) that tighten to 26px / flexible / 30px / 56px / 52px / 30px below 620px — every column survives on mobile; nothing is hidden. In Persian the layout mirrors RTL (input right, board left); in English it reads LTR. On coarse pointers every interactive target is at least 44px tall and the per-row copy button is always visible.

## Elevation & Depth

Flat, by construction. There are no shadows anywhere except the toast. Depth is conveyed by tonal layering (ground → plate → plate-2 → plate-3) and by 1px hairline rules between every cell, row, and pane. The shell frame is a single 1px rule-strong border; panes and panels are 1px rule borders. A surface that needs to feel raised gets a lighter plate, not a shadow.

### Shadow Vocabulary
- **Toast shadow** (`box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5)`): the only shadow in the system, reserved for the floating toast so it reads as above the board.

### Named Rules
**The Hairline Rule.** Depth is a 1px rule, never a shadow, never a glow, never a gradient. If a surface needs emphasis, lighten its plate.

## Shapes

Panels and panes are softly squared (8px radius), the shell a little softer (12px), buttons and inputs tighter (6px). Pills are fully round (999px): language and theme tools, toggles, segmented tracks, and the toast. The brand mark is an 8px square tile holding the drawn crown. Borders are always 1px hairlines in rule or rule-strong; nothing is clipped, skewed, or offset. The form language is rectangular and ruled — the board is a grid of cells, not a stack of cards.

## Components

### Buttons
- **Shape:** 6px radius, Oswald 500 at 15px with 0.14em letter-spacing, padding 11px 24px.
- **Primary:** amber fill (#FFB000) with flap-black text; hover lightens to #FFC233; press drops 1px. The primary action is always the amber one.
- **Secondary (steel):** transparent fill, chalk text, 1px rule-strong border; hover fills plate-3 and lightens the border. Copy and Download are a matched equal-weight pair: same size, same shape, side by side under the board, and both disabled together when the board is empty.
- **Disabled:** opacity 0.34, cursor not-allowed. The pair shares one empty state.

### Toggles
- **Style:** pill (999px) with a 7px dot and a mono label, padding 6px 12px 6px 9px, minimum height 34px (44px on coarse pointers).
- **On state:** amber-soft fill, border rgba(255, 176, 0, 0.55), amber dot with an 18% amber halo. Off state is plate-3 with a steel dot.
- **Hint:** every toggle carries its explanation as visible 10.5px faint text beneath it — never a hover-only tooltip.

### Segmented Controls
- **Style:** a 1px rule track (6px radius) on the ink ground, mono 11px buttons, 30px minimum height.
- **Active:** amber-soft fill, amber text, and a 2px amber underline inset at the bottom. The active format's hint renders as visible 11px faint text under the control.

### Board Rows
- **Shape:** ruled rows, 5px vertical padding, 1px rule divider; hover fills plate-3.
- **Cells:** Oswald index (12px, faint), mono address (13.5px, 500, wraps anywhere), mono version (11px, dim), category (11px, dim, ellipsized), Oswald status (11px, 0.12em, end-aligned), and a 30px drawn-SVG copy button that appears on hover or focus and is always visible on coarse pointers.
- **Changed rows:** amber-soft wash with amber status text (تازه / CHANGED) until the next keystroke; when more than half the board is fresh, the wash is suppressed and the flip cascade alone carries the wholesale replacement.
- **Private rows:** the address renders in steel instead of chalk.
- **Motion:** rows flip in with a 260ms ease rotateX(-65deg) from the top (perspective 700px), staggered 12ms per row; reduced-motion collapses all animation to 0.001ms.

### Stats Strip
- **Style:** one surface, 8px radius, 1px rule border, plate-2 ground. Six cells: the big unique count (Oswald 500, 40px, tabular numerals) first, then found, duplicates, private-removed, special-removed, and v4/v6 split.
- **Labels:** 10px, 0.14em letter-spacing, faint. The removed count is always split by reason — never one unexplained number.
- **Note line:** mono 11px faint beneath the strip, carrying parse time always and the invalid-CIDR count in red when present.

### Input / Dropzone
- **Style:** borderless mono textarea (13px, line-height 1.62) on plate-2, amber caret, 34px bottom padding so placeholder text clears the drop hint.
- **Focus:** inset 1px amber ring; the field is focused on load on fine-pointer devices only, so a phone never opens its keyboard uninvited.
- **Drag state:** 1.5px dashed amber inset frame over an amber-soft wash. Only text files (.txt, .csv, .list) are accepted.

### Toast
- **Style:** fixed top-centre pill (999px), dark #17171A ground (white on light) with a 1px rule-strong border and the system's only shadow; 180ms slide-in from 8px above.
- **Tones:** ok uses the default border; warn and error tint border and ground; an action (e.g. Restore) renders as an amber outlined pill button and holds the toast for 6 seconds instead of 2.6. Docked at the top so it never covers the action pair or the board.

### Tool Buttons and Brand Mark
- **Tool buttons:** pill (999px), plate-2 ground, 1px rule border, 12px dim text with a drawn SVG icon; hover lightens text and border.
- **Brand mark:** 44px square tile, 8px radius, 1px rule-strong border, transparent ground, steel drawn crown SVG, unlit. The crown is a drawn mark, never a glyph or emoji.

## Do's and Don'ts

### Do:
- **Do** use amber only for changed rows, on-states, the primary action, focus, and selection.
- **Do** pair every state colour with text (FILED / CHANGED, or a written reason) — state is never colour alone.
- **Do** keep the count as one enormous tabular number leading the single stats surface.
- **Do** split the removed count by reason (private vs. special) on the strip.
- **Do** draw every icon as inline SVG; the disclosure chevron rotates 180° when open.
- **Do** keep every board column visible on mobile, at the tighter 6-column track.
- **Do** dock the toast at the top so it never covers the Copy/Download pair or the board.

### Don't:
- **Don't** use gradients, glow, shadows (except the toast), or violet/purple anywhere.
- **Don't** use an overused display face or a system display face; Oswald is the only display face.
- **Don't** hide data behind hover-only tooltips; every toggle and format carries a visible hint.
- **Don't** light the whole board amber — when more than half the rows are fresh, the wash is suppressed.
- **Don't** enable one of the matched pair while the other is disabled; Copy and Download share one empty state.
- **Don't** use unicode glyphs as icons (▾/▴, ✓, ✕) — draw them.
- **Don't** invent testimonials, customers, benchmarks, or pricing; none exist for this product.

---

## Divergences (build vs. contract)

The build is the authority; these are the places it landed differently from the surface brief, recorded so a later reader does not "fix" them back:

- The contract's THESIS promised rows flipping "character by character"; the build flips whole rows (rotateX, 260ms, 12ms stagger). The whole-row flip is the signature motion.
- The contract's OWN-WORLD promised cancel red on dropped rows; dropped rows leave the board entirely, so red appears on the invalid-CIDR note and in error toasts, not on a row. The removed counts on the strip carry the reason instead.
- The contract's FIRST VIEWPORT placed the count in the top rail; the build carries it as the lead cell of the stats strip, folding the old standalone meter into the one stats surface.
- The contract's FIRST VIEWPORT described input left, board right; the build mirrors in RTL, so in Persian the input sits right and the board left.
