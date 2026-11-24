# How it works

**English** · [한국어](../ko/how-it-works.md) · [日本語](../ja/how-it-works.md) · [简体中文](../zh-CN/how-it-works.md)

[← README](../../README.md)

**Contents**

- [At a glance](#at-a-glance)
- [Detection priority](#detection-priority) — Vertical · Method details · Horizontal
- [Other things it does](#other-things-it-does)
- [When it re-evaluates](#when-it-re-evaluates)
- [What it leaves on the page](#what-it-leaves-on-the-page)
- [Browser support](#browser-support)

&nbsp;

&nbsp;

## At a glance

| What it does | Details |
| --- | --- |
| Automatic discovery | Finds vertical and horizontal scroll areas on the page by their computed styles. It doesn't rely on class names or how the CSS is written. It also finds elements added later (modals, dropdowns) |
| Per-area detection | It doesn't apply one fix to every area. It looks at each area's structure and picks one of four methods ([Detection priority](#detection-priority)) |
| Vertical and horizontal separately | It decides the place of each scrollbar separately |
| Native scrollbar | Uses the browser's native scrollbar, not a custom-drawn one. It also follows styling done with `scrollbar-width`, `scrollbar-color`, and `::-webkit-scrollbar` |
| Measured scrollbar width | It never assumes the width; it uses the value measured in that browser |
| Re-evaluation | Re-evaluates when the size of an area or its content changes, or when elements or styles change |
| Restore | Records the padding, variables, and markers it changes on each element, and restores them when the library is uninstalled. Only the shadow root attached to areas with a floated scrollbar can't be removed, so it stays ([Limitations](./troubleshooting.md#limitations)) |
| Nested areas | When a scroll area contains another one, it decides the outer one first so the two don't use the same padding |
| Configuration | Five global options (`stayClose`, `exclude`, `debug`, `quiet`, `textarea`) and a per-area `data-scrollbar` attribute (turn off, pin a method, manual control). It works with nothing set |
| Debug overlay | When on, draws what it did to each area on the page: the chosen method and the reason, where the scrollbar sits, the before and after values of padding it shrank or added, and where the content sits without a scrollbar |

&nbsp;

&nbsp;

## Detection priority

This is the core of the library.

- It doesn't correct the scrollbar one single way.
- For each area that shows a scrollbar, it analyzes the structure and uses **the first method that fits**.
- Below, `S` is the scrollbar width measured in that browser.

### Vertical scrollbar

| Order | Area structure | What it does | Covers content? |
| --- | --- | --- | --- |
| 1 Own padding | The scroll area's own right padding is at least `S` | Shrinks that padding by `S`. The scrollbar appears in its place | No |
| 2 Centered | The content inside has equal space on the left and right (within 2px) | Adds `S` on the left | No |
| 3 Outside | The scroll area's right edge touches the outer container's padding (at least `S`), or the space to its right is empty | Leaves the scroll area as is and floats only the scrollbar just outside it | No |
| 4 Overlay | None of the above works | Floats the scrollbar over the right edge of the content | Only under the thumb, semi-transparent |

### Method details

#### 1 Own padding

- **Why it exists**: It's the most common structure. Everything happens inside the area, so nothing outside changes.

#### 2 Centered

- **Why it exists**: Shrinking only the right side of centered content throws it off center. Both sides have to match for it to stay put.

#### 1 and 2 don't change the box's outer size

- If you shrink only the padding of a box whose size is fixed in `content-box` terms (`box-sizing: content-box`, such as `width: 240px`), the content area stays the same and the whole box gets smaller.
- Such boxes skip that method and move on to the next in order. The same goes for the bottom padding (height) used by a horizontal scrollbar.
- It never rewrites width or height to compensate, because percentage sizes would freeze into fixed numbers and content-driven sizes would get pinned.
- The same test applies when it shrinks the padding of a full-width child inside — if the child's content area wouldn't stay the same as without a scrollbar, that method isn't used.
- How it decides: it measures the size without a scrollbar and the size after changing the padding, and checks that they match. It only measures `content-box` boxes.

#### 3 Outside

- **Why it exists**: For structures where the padding is on the outer container rather than the scroll area (a list that fills its container). The area has no padding to shrink.
- **Bordered boxes too**: If there's room outside, it floats the scrollbar just outside the border.
- **It passes through any number of wrappers**: This applies to wrappers that enclose the area with no padding (nothing else in between, only a border).
- **It isn't used when the scrollbar would sit too far away**: If the total thickness of the borders crossed exceeds `stayClose` (12px by default), it goes to 4, because the scrollbar would look detached from its area.

Cases where it skips 3 and goes to 4:

| Case | Reason |
| --- | --- |
| The scroll area itself is clipped to a shape (`clip-path`) or has a mask (`mask` — such as an effect that fades the top and bottom edges) | A scrollbar floated outside the area gets clipped by the area itself and isn't visible |
| Another element overlaps the spot where the scrollbar would go (such as a close button floating in the padding) | So the floated scrollbar doesn't cover that element and intercept its clicks |

- Background or decoration layers that cover the whole area don't count as "an element in that spot".

#### 4 Overlay

- **Why it exists**: For structures with no room anywhere, like lists or grids whose rows reach the edge. It floats the scrollbar over the content instead of shifting it.
- **Layouts that end up here**: Layouts that don't stack children top to bottom (grid, horizontal, reverse stacking) also end up here.
- **Why it comes last**: 4 is the only method that covers content.

Even 4 doesn't cover the full scrollbar width.

- The floated scrollbar has a transparent background (the track the thumb moves along).
- Unless you've set a thumb color, the thumb is semi-transparent too (black at 35%).
- So only the part under the thumb is covered, and the content shows through even there.
- If your app code sets a thumb color (`scrollbar-color`, `::-webkit-scrollbar-thumb`), it uses that color as is.
- Clicks where the floated scrollbar sits do go to the scrollbar, though.

#### 3 and 4 float a separate scrollbar

- They hide the original scrollbar, float a separate scrollbar that looks the same, and keep the two scroll positions in sync.
- The floated one is also a native browser scrollbar, so dragging, the wheel, and its look are the same.

### Horizontal scrollbar

It's decided separately from the vertical one.

| Order | Area structure | What it does |
| --- | --- | --- |
| 1 Own padding | The scroll area's own bottom padding is at least the scrollbar height | Shrinks that padding |
| 2 Outside | There's padding or empty space below, outside the area | Floats the scrollbar just below the area |
| 3 Overlay | Neither works | Floats the scrollbar over the bottom of the content (with a transparent background, like the vertical one) |

- Browsers can't hide only one of the vertical and horizontal scrollbars.
- So if either one is floated, both original scrollbars are hidden and both are drawn as floated ones.
- Their places are still decided per axis — the vertical one can sit outside on the right while the horizontal one overlays the content.

&nbsp;

&nbsp;

## Other things it does

### Areas that reserve the scrollbar's space (`scrollbar-gutter: stable`)

- It removes that setting, and the empty strip with it, only when doing so won't shift the content.
- That's when one of the methods above can take the scrollbar, or when the content is wider than the area so nothing moves when the scrollbar appears.
- Otherwise it leaves the area alone.

### Areas that always show a scrollbar (`overflow: scroll`)

- They're treated exactly like other areas.
- When they overflow, one of the methods above takes the scrollbar.
- When they don't, it hides the original scrollbar's empty strip and floats nothing. This holds whether the structure is handled by shrinking padding or by floating (text areas excepted — see "Text areas" below).
- So "the empty scrollbar that showed even with short content" now shows only when there's something to scroll.
- The content width is the same in both cases.
- These areas are re-evaluated every time the content grows or shrinks.

### Page (browser window) scrolling

- It checks the vertical scrollbar in the same order.
- There's no outside, so 3 is skipped.
- Overlay floats the scrollbar at the right edge of the viewport.
- When the window scrollbar stays in place (methods 1 and 2), elements laid out against the viewport width are also put where they sit with no scrollbar — fixed headers, floating buttons, centered toasts, boxes pinned to a corner of the page.
  - A full-width one gives up its own right padding (or gets left padding if its content is centered), the same way a scroll area does.
  - The others are moved by the difference (`translate`).
  - To find the difference it hides the window scrollbar for an instant and measures, instead of guessing how each element was positioned.
- If the code that locks page scrolling (a modal) fills the vanished scrollbar's space with padding of its own, the values written here are kept until the scrollbar returns. Undoing them too would shift the content.

### Text areas (`textarea`)

- Not handled by default. Only with the `textarea` option on do they go through the same order ([Configuration](./configuration.md#options)).
- A shadow root can't be attached to a text area, so 3 and 4 don't apply. Only 1 (Own padding) and `manual` work.
- It decides the moment the text grows enough for a scrollbar to appear, and restores when the scrollbar goes away.
- For always-on scrollbars (`overflow: scroll`), it doesn't hide the empty strip in text areas, because it can't detect when edited text starts to overflow (only the value changes).
- With the option off, it also leaves alone the padding of a text area that's a full-width child of another scroll area.

### Nested areas

- When a scroll area contains another one (including areas inside the page itself), it decides and applies the outer one first, then decides the inner one.
- This keeps the inner area from reusing padding the outer area already shrank to make room for its own scrollbar.

&nbsp;

&nbsp;

## When it re-evaluates

All areas:

- When the size of the area or its content changes
- When elements are added or removed, or a class, style, or text changes
- When an image finishes loading
- When the window is resized

Areas floated into empty space outside also watch the size of the elements around that space:

- If a neighboring element grows (even if only its border or padding grows) and fills the space, it switches to Overlay.
- If a neighboring element keeps its size but moves into the space (moved with an inline style, or landing there when an animation ends), it also switches to Overlay.
- When the space is empty again, it moves back outside.

Areas that couldn't be attached outside because an animation was running are tried again when the animation ends.

&nbsp;

&nbsp;

## What it leaves on the page

It writes the following to scroll areas and the elements around them. When the library is uninstalled, it restores everything except the shadow root.

| What | Where | Why |
| --- | --- | --- |
| Inline styles — `padding-right`, `padding-left`, `padding-bottom`, `margin-right`, `width`, `scrollbar-gutter` | The scroll area, its inner child, and (in the fallback) the outer container | Shrinks and adds padding. `margin-right` and `width` are used only in the fallback (widening) |
| CSS variables `--sbw`, `--sbh` | The scroll area | Your app code reads them with the `manual` setting |
| Attribute `data-scrollbar-undo` | Elements whose styles above were changed | Records the original values |
| Attribute `data-scrollbar-overlay` | Areas with a floated scrollbar (`html` for the page) | Hides the original scrollbar |
| shadow root | Areas with a floated scrollbar | Keeps the floated scrollbar out of the child list. Children stay visible through a `<slot>`. **It stays after the library is uninstalled** (only the scrollbar inside is hidden) |
| Attributes `data-scrollbar-method`, `data-scrollbar-method-x`, `data-scrollbar-why` | The scroll area | Only with `debug` on. Records the chosen method and the reason |
| Element `[data-scrollbar-debug]` | End of `body` | Only with `debug` on. The layer that draws the debug overlay — it covers the whole viewport but lets clicks through, and draws inside its own shadow root |
| Attribute `data-scrollbar-nudge` | Areas with a floated scrollbar | Added and removed for an instant when re-evaluating — this makes Safari-family browsers repaint a scrollbar that was hidden |
| One `<style>` | `head` | The rule that hides the original scrollbars |
| One error listener on `window` | — | Intercepts "ResizeObserver loop" notices (only when `quiet` is true) |
| Element `[data-scrollbar-ghost-page]` | End of `body` | The floated scrollbar for the page |

Things to know:

- It **never touches a scroll area's child list.** This avoids conflicts with DOM managed by React and similar libraries.
- Outside CSS still applies to elements with an attached shadow root (the children stay in the light DOM).
- Because it uses inline styles, if your code sets the same property inline directly, that value is treated as the original value.

&nbsp;

&nbsp;

## Browser support

| Feature | Requires | Without it |
| --- | --- | --- |
| Own padding, Centered, vertical Overlay | `ResizeObserver`, shadow DOM | — |
| Floating outside · floated horizontal scrollbar · Overlay in grid and horizontal layouts | CSS anchor positioning — Chrome and Edge 125, Safari 26, Firefox 147 and later [1] | Vertical: the fallback (widening the area by `S`) or Overlay; horizontal: the original scrollbar as is. Grid and horizontal-layout areas are left alone |

Even with anchor positioning, the scrollbar may not attach in place, depending on the structure.

- Example: the scroll area itself has a `transform` or `filter`.
- Right after floating, it measures the position. If the scrollbar didn't attach or is clipped by an ancestor and invisible, the area is handled the same way as in browsers without anchor positioning.
- It tries again when an animation ends or the window is resized.

Environments actually tested are listed in [Verification status](./troubleshooting.md#verification-status).

&nbsp;

&nbsp;

## References

- [1] web.dev, New to the web platform in January 2026 — https://web.dev/blog/web-platform-01-2026 (Chrome 125, Edge 125, Firefox 147, Safari 26)
- CSS Anchor Positioning specification — https://drafts.csswg.org/css-anchor-position/
