# Troubleshooting · Limitations · Verification status

**English** · [한국어](../ko/troubleshooting.md) · [日本語](../ja/troubleshooting.md) · [简体中文](../zh-CN/troubleshooting.md)

[← README](../../README.md)

**Contents**

- [Troubleshooting](#troubleshooting) — Using the debug overlay · By symptom
- [Limitations](#limitations) — Environment · What it leaves alone · When floating a scrollbar · Re-evaluation · Names and display · Limits of detection
- [Verification status](#verification-status)

&nbsp;

&nbsp;

## Troubleshooting

### Using the debug overlay

"I can't see what it did" is the biggest worry. Turn on `debug` and you get two things — what's drawn on the page, and attributes added to the areas.

#### What's drawn on the page

For every scroll area it touched, or tried to touch and couldn't, the following is drawn on top. Colors depend on the method.

| What's drawn | Meaning |
| --- | --- |
| Thick border and light fill | The scroll area |
| Solid strip | Where the scrollbar sits — the inner edge of the area for Own padding, Centered, and Overlay; outside the area for Outside |
| Hatched strip | The padding after it was shrunk or added. If the padding of an inner child was changed instead of the area itself, it's drawn over that child |
| Dotted rectangle | Where the content sits without a scrollbar. If the content stays inside it when the scrollbar appears, nothing shifted |
| Label at the top left | The method chosen for vertical (`↕`) and horizontal (`↔`), the scrollbar thickness (`S`, `H`), the distance when floated outside (`gap`), changed values as before → after, and the reason |

Label examples:

| Label | How to read it |
| --- | --- |
| `↕ padding · S 11 · padding-right 24 → 13` | The vertical scrollbar (11px) was handled with Own padding. The right padding shrank from 24 to 13 |
| `↕ center · S 11 · padding-left 0 → 11` | Handled as Centered. 11 was added on the left |
| `↕ center · S 11 · child padding-right 16 → 5` | The right padding of a full-width child inside was shrunk |
| `↕ outside · S 11 · gap 2` | Floated outside, across a 2px border, 2px away from the area |
| `↕ overlay · S 11 — outside-occupied` | Overlaid on the content, because another element occupies the spot outside |
| `↕ outside · S 11 · ↔ overlay · H 11` | Vertical outside, horizontal over the content |

Things to know:

- It's drawn on a separate layer at the very top of the page. Nothing is inserted into scroll areas, and clicks aren't intercepted.
- Areas with nothing to do (no scrollbar, turned off, excluded) aren't drawn. Those areas still get the attributes below.
- Because the layer sits on top, the border of an area scrolled under a fixed header can show over the header.
- Labels are drawn at their full text length, so they can spill outside narrow areas.
- With nested areas, the strips and dotted lines overlap.
- There's only something to draw once a scrollbar appears. It's normal for an area whose content doesn't overflow to show nothing.

#### Attributes on the area

Select the area in DevTools to see them. You can also read them in tests.

| Attribute | Meaning |
| --- | --- |
| `data-scrollbar-method` | The method chosen for the vertical scrollbar |
| `data-scrollbar-method-x` | The method chosen for the horizontal scrollbar |
| `data-scrollbar-why` | Why that method was chosen — the reason an earlier method couldn't be used (see the "Reasons" tables below) |

Methods:

| Method | Meaning | Color |
| --- | --- | --- |
| `padding` | 1 Shrank its own padding | Green |
| `center` | 2 Handled as centered | Blue |
| `outside` | 3 Floated outside | Purple |
| `overlay` | 4 Overlaid on the content | Orange |
| `widen` | Widened the area as a fallback | Yellow |
| `manual` | `manual` setting, so it only passed down the width | Black |
| `none` | Did nothing | Gray dotted (not drawn when the reason is "nothing to do") |

Reasons — nothing to do:

| Reason | Meaning |
| --- | --- |
| `no-scrollbar` | No scrollbar is showing (the content doesn't overflow, or the environment uses overlay scrollbars) |
| `nothing-to-scroll` | The scrollbar is set to always show, but there's nothing to scroll — nothing was floated |
| `off` · `excluded` | Has `data-scrollbar="off"` · matched the `exclude` selector |

Reasons — couldn't float outside:

| Reason | Meaning |
| --- | --- |
| `outside-too-narrow` | The outer padding or empty space is narrower than the scrollbar |
| `outside-occupied` | Another element is in the spot where the scrollbar would go (a side panel, a button in the padding) |
| `outside-behind-box` | There's empty space outside, but a box with a background or border, or a container that clips overflow, sits in between |
| `outside-gap-over-limit` | The total thickness of the borders to cross exceeds `stayClose` |
| `outside-is-scroller` | The outer container is itself a scroll area |
| `outside-none` | There's no usable padding all the way up to the document root |
| `outside-clipped-or-unanchored` | It tried floating outside, but the scrollbar was clipped by an ancestor and invisible, or didn't attach in place |
| `no-anchor-positioning` | The browser doesn't support anchor positioning |
| `page-has-no-outside` | It's page (browser window) scrolling, so there's no outside |

Reasons — other:

| Reason | Meaning |
| --- | --- |
| `cannot-attach` | The element can't take a floated scrollbar (`ul`, `table`, `textarea`, web component tags, elements that already have a shadow root) |
| `cannot-overlay` | The structure can't even be overlaid (for example, it overflows horizontally but a horizontal scrollbar can't be floated) |
| `center-too-narrow` | It's centered, but the space on each side is narrower than the scrollbar, so the scrollbar was overlaid on the content |
| `center-not-applicable` | Set to `center`, but the structure can't be handled as centered |
| `gutter-kept` · `gutter-released` | Releasing the reserved scrollbar space would shift the content, so it was kept · only the reserved space was released (there's no scrollbar right now) |

### By symptom

#### `ResizeObserver loop completed with undelivered notifications` shows up in the console or error tracking

- **Cause**: The browser emits this notice because the library adjusts padding right when it detects that a scrollbar appeared. Nothing is broken.
- **Fix**: By default the library intercepts the notice so it doesn't reach listeners registered after it (`quiet`). Listeners registered earlier (such as a dev server's error overlay) may still see it.

#### The scrollbar is thin and disappears when you stop scrolling. The library doesn't seem to run

- **Cause**: You're on overlay scrollbars. Nothing shifts, so there's nothing to do.
- **Fix**: To see space-taking scrollbars, set scroll bars to show "Always" in your OS settings.

#### There's padding outside, but the scrollbar overlays the content

- **Cause** (one of four):
  - The outer padding is narrower than the scrollbar.
  - Another element sits right next to the area.
  - Another element (such as a close button) floats in that padding, in the spot where the scrollbar would go.
  - It's empty space rather than padding, but a box with a border or background sits in between.
- **Fix**: Turn on `debug` and check the area's `data-scrollbar-why`. Make the outer padding at least the scrollbar width, or give the scroll area its own padding.

#### The right side is wider than the left when there's no scrollbar

- **Cause**: Right padding added for the scrollbar is still there.
- **Fix**: Remove that padding ([Recommendations](./configuration.md#recommendations)).

#### An always-on scrollbar disappears when the content is short

- **Cause**: This is intended. With nothing to scroll, no scrollbar is floated.
- **Fix**: If it must always show, add `data-scrollbar="off"` to that area.

#### Text shifts in a text area (`textarea`)

- **Cause**: Text areas aren't handled by default. If text still shifts with the option on, it's one of two things (the reason in the debug overlay is `cannot-attach`).
  - The text area's right padding is narrower than the scrollbar width.
  - The text area's width is fixed in `box-sizing: content-box` terms (the browser default). Shrinking the padding doesn't widen the text.
- **Fix**: Turn on the `textarea` option. Give the text area horizontal padding at least the scrollbar width, plus `box-sizing: border-box`. Or use `data-scrollbar="manual"` to get the width and adjust it yourself ([Configuration](./configuration.md#options)).

#### I want to turn it off for one area

- **Fix**: Add `data-scrollbar="off"` to that area.

&nbsp;

&nbsp;

## Limitations

### Environment

**It does nothing with overlay scrollbars.**

- If the scrollbar takes no space (measured width 0), as with the macOS default or on mobile, nothing shifts to begin with.

**Overlay in areas that don't stack children top to bottom (grid, horizontal, reverse stacking) requires anchor positioning.**

- In browsers without it, such areas can't be overlaid, so they're left alone.

### What it leaves alone

**It doesn't touch hard-coded right padding.**

- See [Recommendations](./configuration.md#recommendations).

**Some areas aren't handled.**

- Scroll areas inside a shadow root or an iframe.
- Text areas (`textarea`) are handled only with the `textarea` option on. Even then, they can't get a floated scrollbar (only shrinking padding and `manual` work).
- Regions matched by `exclude`.

**It doesn't shrink padding on boxes whose size it can't preserve.**

- If you shrink the padding of a box whose size is fixed in `content-box` terms (`box-sizing: content-box`), the content area stays the same and only the box gets smaller.
- Such boxes skip 1 and 2 and go to the next in order (Outside, Overlay). It never rewrites width or height to compensate.
- If an element that can't take a floated scrollbar (such as a text area) is such a box, there's no way to handle it, so it's left as is. Adding `box-sizing: border-box` makes it work.

**It doesn't handle the page's (browser window's) horizontal scrollbar.**

### When floating a scrollbar

**The shadow root can't be undone.**

- Areas with a floated scrollbar (Outside, Overlay) get a shadow root. Once attached, a shadow root can't be removed.
- The element's `shadowRoot` stays after the library is uninstalled (the scrollbar inside is hidden).
- So **any code that later calls `attachShadow` on that element throws.**
- The most likely case is a web component whose definition loads late. That's why web component tags (tags with a `-` in their name) never get a shadow root — such scroll areas are handled like "Some elements can't take a floated scrollbar" below.
- If a regular tag has code that attaches a shadow root later, add `data-scrollbar="off"` or `manual` to that element so no scrollbar is floated on it.
- Areas handled by shrinking padding or by centering never get a shadow root.

**Some elements can't take a floated scrollbar.**

- The floated scrollbar lives in the scroll element's shadow root.
- Affected elements: tags that can't have a shadow root (`ul`, `table`, `textarea`, etc.), elements that already have a shadow root, and web component tags.
- These only get methods 1 and 2.
- If there's room outside and the area isn't a visible box (border, background), the fallback widens the area by `S`.
- If that doesn't work either, it's left as is (the content shifts when the scrollbar appears).
- You can handle such areas yourself with `manual`.

**Clicks where a floated scrollbar sits go to the scrollbar.**

- Only the thumb is visible, but the whole strip as wide as the scrollbar receives clicks.
- With Overlay, that's a strip that wide along the right edge of the content (the bottom edge for horizontal).

**Areas inside a card that clips the floated scrollbar, and areas that clip themselves, can't float it outside.**

- Affected cards: cards that clip overflow and also have something like `transform`, `filter`, or `backdrop-filter`, and cards clipped to a shape (`clip-path`) or masked (`mask`).
- They overlay the content even when there's room outside.
- Sometimes it judges that a card clips when it actually doesn't (for example, a page with scrolling locked). Those also go to Overlay.

**Always-on scrollbars become "shown only when there's something to scroll".**

- An empty scrollbar kept visible with `overflow: scroll` doesn't show when the content doesn't overflow ([How it works](./how-it-works.md#other-things-it-does)).

**When both the vertical and horizontal scrollbars are overlaid, their thumbs can overlap.**

- The two thumbs can overlap in the bottom-right corner.

**For an area partly hidden inside a larger scroll area, the scrollbar can show outside it.**

- A scrollbar floated outside can be visible outside that larger area (it hides when the area is fully covered).

### Re-evaluation

**Changes in appearance without any element change aren't caught right away.**

- Affected cases: elements that widen only on hover, animations, and fonts that apply late.
- They're corrected the next time you scroll that area or resize the window.

**Areas floated into empty space outside watch every element around that space.**

- What's watched: the container whose empty space was measured, and its direct children.
- A container with very many children means that many more elements to watch.

### Names and display

**`--sbw` and `--sbh` are names this library uses.**

- They're written inline on every scroll area (`0px` unless `manual`) and removed on uninstall.
- If your app writes variables with the same names inline, they get overwritten or removed.

**The debug overlay's drawing can be misaligned under a scaled ancestor.**

- Under an ancestor with scaling (`transform: scale`), the strip thickness and position can be off.
- Only the drawing is wrong; detection is unaffected.

### Limits of detection

**It doesn't guarantee the same result for every structure.**

- Detection is an estimate based on measuring rendered sizes and padding.
- With unusual structures it can pick the wrong method.
- Fix those areas with [Per-area settings](./configuration.md#per-area-settings).

&nbsp;

&nbsp;

## Verification status

### At a glance

| Item | Status |
| --- | --- |
| Adoption | The same code, before it was extracted into a package, is in use in 2 apps of one service |
| Automated tests | `npm test` — runs the built output (`dist`) in the playground (`playground/`) with Playwright on three engines |
| Latest result | 2026-11-20, 126 passed · 21 skipped because that engine can't produce a scrollbar width |
| Test targets | 39 cases in the test bench (`playground/bench.html`), plus 12 pages mimicking other projects (around 60 scroll areas) |
| Real app screens | Measured on 2026-11-20 with the code just before extraction, in Chrome (macOS), with an 11px scrollbar and a window width of 2025 — content moved 0 before and after the scrollbar appeared (0.1px at most) in about 120 vertical scroll areas across 46 screens and 4 kinds of modals. Horizontal scroll areas and narrow windows (1024, 390) were not measured on app screens |
| Deferred | An option to turn it on for only part of the page (a single container) — postponed because modals and dropdowns render outside that container. App- and page-level scope already works through where you place the component |

### Tested environments

| Engine | Scrollbars tested | Notes |
| --- | --- | --- |
| Chromium | Default 15px, thin 11px, custom (`::-webkit-scrollbar`) 11px and 17px | — |
| Firefox | Default 15px, thin 11px | Run in headed mode — in headless mode the scrollbar width is 0 |
| WebKit (Safari's engine) | Custom 11px and 17px | The default scrollbar is an overlay scrollbar (width 0), so only "does nothing" was verified |

### Not verified

- Real Windows (17px was simulated with a custom scrollbar)
- Safari with the setting that makes the default scrollbar take space
- Safari 26 itself (Playwright's WebKit is a different build of the same engine)
- Older browsers without anchor positioning

### What the tests assert

Shifting and methods:

- Content position before and after the scrollbar appears (zero shift)
- The method chosen in each case
- That it does nothing when the scrollbar width is 0
- That boxes whose size is fixed in `content-box` terms keep their width and height, and that width and height aren't rewritten
- That boxes with content-driven height and boxes with a percentage width don't get their sizes frozen into numbers (they follow along when lines are added or the wrapper shrinks)
- That a full-width `content-box` child keeps its text width
- That the fallback (widening) widens a `content-box` list by exactly the scrollbar width

Floated scrollbars:

- That the floated scrollbar can be grabbed in place and is actually rendered on screen
- Scroll sync between the content and the thumb
- That no bar intercepts clicks when there's nothing to scroll
- That the wheel over a floated bar passes through to the scroll area, while Ctrl+wheel doesn't
- That web component tags don't get a shadow root

Re-evaluation and restoring:

- That it re-evaluates when a neighboring element widens and narrows
- That two nested areas re-evaluating at the same moment don't overlap each other's scrollbars
- That nothing is left behind after the scrollbar disappears or the library is turned off

Options:

- `stayClose` — the default limit and other values
- `exclude` — excluded regions stay as they are and everything else is handled
- `debug` — the debug overlay matches the method actually chosen and is removed when turned off, and turning it on doesn't change the chosen method
- `quiet` — the default of intercepting the browser notice, and turning it off
- `textarea` — by default text areas are left as is (including as a full-width child of another area); with it on, padding shrinks and the text width stays the same; text areas with narrow padding are left as is; typing into a text area with an always-on scrollbar doesn't hide the scrollbar; uninstalling restores everything

Debug layer:

- That labels show the scrollbar thickness and the changed values
- That the scrollbar strip is as thick as the original scrollbar
- That the dotted content rectangle matches where the content actually is
- That it doesn't intercept clicks

Installation:

- That the core can be installed and uninstalled without React
- That the core doesn't import React
- That installing in an unsupported environment doesn't throw, and later installs and uninstalls still work
