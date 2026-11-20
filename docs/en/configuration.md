# Configuration

**English** · [한국어](../ko/configuration.md) · [日本語](../ja/configuration.md) · [简体中文](../zh-CN/configuration.md)

[← README](../../README.md)

**Contents**

- [Scope](#scope--where-you-place-the-component-sets-the-scope) — where you place it sets the scope
- [Options](#options) — `stayClose` · `exclude` · `debug` · `quiet` · `textarea`
- [Per-area settings](#per-area-settings) — `data-scrollbar="off"` · `"center"` · `"manual"`
- [Recommendations](#recommendations)

## Scope — where you place the component sets the scope

While it runs, it handles the scroll areas of the whole page (the entire document). So where you place it (without React, when you install and uninstall it) decides the scope.

| Scope | Where to place it |
| --- | --- |
| The whole app | The app's root layout |
| Specific pages (routes) only | The layout of that page or group of pages. It runs only while you're on that page and restores everything when you leave |

- **Gradual adoption**: This is how you turn it on for one page first and expand from there.
- **Shared areas are included**: While it's on, it applies not only to that page's main content but also to the shared areas shown with it (sidebar, header, modals). Moving between pages with and without it can make the scrollbars in shared areas look different.
- **No partial enablement**: There's no option yet to turn it on for only part of the page (a single container). To **exclude** part of it, use `exclude`.

## Options

Every option applies to the whole page. To vary behavior per area, see [Per-area settings](#per-area-settings).

| Option | Value | Default | Meaning |
| --- | --- | --- | --- |
| `stayClose` | number (px) | `12` | How far from the area's edge the scrollbar may sit when floated outside |
| `exclude` | CSS selector string | none | Elements matching this selector, and everything inside them, are left alone |
| `debug` | boolean | `false` | Turns on the debug overlay — draws what it did to each area on the page |
| `quiet` | boolean | `true` | Intercepts the "ResizeObserver loop" notices the browser emits |
| `textarea` | boolean | `false` | Also handles text areas (`textarea`) |

```tsx
<MrScroll stayClose={4} exclude=".some-widget, .third-party" textarea debug />
```

```ts
installMrScroll({ stayClose: 4, exclude: ".some-widget, .third-party", textarea: true, debug: true });
```

### `stayClose` — how far the scrollbar may sit when floated outside

- **What it measures**: When the scrollbar is floated into the outer padding across the border of a card or container that wraps the area with no padding, the scrollbar ends up away from the area by the total thickness of the borders it crosses.
- **When exceeded**: If that distance exceeds this value, the scrollbar overlays the content instead of floating outside.
- **Default (12px)**: Common borders (1px to 4px) stay under it.
- **To remove the limit**: Pass `Infinity`.
- **Axes**: Applies to both vertical and horizontal.
- **Invalid values**: Negative or non-numeric values fall back to the default.
- **Tolerance**: Whether the edges touch is judged with a 1px tolerance, so near the limit it can be off by 1px or 2px.

### `exclude` — regions to leave alone

- **Scope**: Scroll areas in the matching elements and **everything inside them** are neither discovered nor touched.
- **Outer areas leave them alone too**: An outer scroll area won't shrink that region's padding to make room for its own scrollbar.
- **When to use it**: To exclude third-party widgets whose markup you can't add `data-scrollbar="off"` to.
- **Multiple selectors**: Separate them with commas.
- **Invalid selectors**: Treated as if none was given.

### `debug` — debug overlay

It draws the following over every scroll area it touched.

- A border in the method's color
- Where the scrollbar sits
- Padding it shrank or added
- Where the content sits without a scrollbar
- A label with the method, scrollbar thickness, changed values, and reason

Things to know:

- The same information is also written as attributes on the area.
- It inserts nothing into scroll areas, doesn't intercept clicks, and doesn't change detection results.
- While it's on, it re-measures the position of every area on every frame, so turn it on only during development.
- How to read it is in [Troubleshooting](./troubleshooting.md#troubleshooting).

### `quiet` — intercepting browser notices

- **Why it exists**: Because it adjusts padding right when it detects that a scrollbar appeared, the browser often emits the notice `ResizeObserver loop completed with undelivered notifications`. Nothing is broken, but these pile up in error tracking tools.
- **Default (`true`)**: Intercepts the notice so it doesn't reach listeners registered after the library.
- **Caution**: **The same notice from other code is hidden too.**
- **To turn it off**: Pass `false` if you want to see those notices yourself.

### `textarea` — handling text areas too

- **Default (`false`)**: Text areas are left alone, because they easily get tangled up with code that sizes their height to the content.
- **When on**: They're decided in the same order as other scroll areas.
- **Only two outcomes work**: A scrollbar can't be floated on a text area (it's a tag that can't take a shadow root).

| Text area | Result |
| --- | --- |
| Right padding is at least the scrollbar width | Shrinks that padding. The width available to the text stays the same, so line breaks don't change |
| Right padding is narrower than the scrollbar | Left as is. The text shifts by the scrollbar width |
| Width fixed in `box-sizing: content-box` terms (the browser default) | Left as is. Shrinking the padding wouldn't widen the text; it would only shrink the box |
| Has `data-scrollbar="manual"` | You get the width (`--sbw`) and adjust it yourself |

- **To make it fit**: Give the text area horizontal padding at least the scrollbar width, and give text areas with a numeric width `box-sizing: border-box` (most CSS resets already do).
- **The text area's size never changes**: Width and height are never rewritten.
- **Same for child text areas**: With the option off, it also leaves alone the padding of a text area that's a full-width child of another scroll area.
- **Always-on scrollbars stay as they are**: The empty scrollbar of a text area with `overflow: scroll` isn't hidden, because it can't detect when edited text starts to overflow.
- **Restoring**: Turning the option off or uninstalling restores the original values.

### When installed more than once

- The options of the most recent install are used.
- Uninstalling that one falls back to the previous one.
- When the options change, every area it was watching is re-evaluated.

## Per-area settings

For areas where automatic detection gets it wrong, add `data-scrollbar` to the scroll element. This is the only per-area setting. Leaving it off is the default.

| Value | Behavior | When to use it |
| --- | --- | --- |
| `off` | Excludes the area from detection and changes. Both the vertical and horizontal scrollbars stay as they were | Areas the library must not touch — components that manage their own scrollbar. For third-party widgets whose markup you can't edit, use the `exclude` option |
| `center` | **Forces detection to the Centered method (2)** even if the space on the left and right differs | Areas that are centered, but whose left and right space differs by more than 2px, so automatic detection couldn't pick 2 |
| `manual` | **You control it.** It only passes down the vertical scrollbar width as the CSS variable `--sbw` and the horizontal scrollbar height as `--sbh`, with no automatic detection. Your app code decides where and how to use those values | Areas where you want to set the padding yourself instead of relying on automatic detection — lists with padding on each row, areas where you want to set the gap between the scrollbar and the content yourself, and list tags, tables, and text areas that can't take a floated scrollbar (text areas only get the values with the `textarea` option on) |

```html
<!-- leave this area alone -->
<div data-scrollbar="off" style="overflow-y: auto">…</div>

<!-- pin it to method 2 -->
<div data-scrollbar="center" style="overflow-y: auto">
  <article style="max-width: 720px; margin-left: 40px">…</article>
</div>
```

### `center` — it doesn't move content to the center

- It pins detection to method 2.
- It adds left padding equal to the scrollbar width, so content that's already centered stays put when the scrollbar appears.
- If the structure can't take method 2 (for example, there's no free space inside), it does nothing instead of moving on to 3 or 4.
- If the scroll area's own right padding is wide enough, method 1 applies first.

### `manual` — get the scrollbar width and adjust it yourself

Automatic detection means "the library picks for you"; `manual` means "here's the width, you decide."

- In areas with this setting, the original scrollbar shows as usual. The library does no centering, floating outside, or overlaying.
- All it does is write two values on the area.
  - `--sbw` is the vertical scrollbar's width, and `--sbh` is the horizontal scrollbar's height.
  - When the scrollbar is showing, the value is its thickness (such as `11px`); otherwise it's `0px`.
- Any element inside the area can read those values with `var(--sbw, 0px)` and `var(--sbh, 0px)` — rows, header rows, footer button rows, anywhere.

| Goal | Expression | Result |
| --- | --- | --- |
| Keep content from shifting | `padding-right: calc(16px - var(--sbw, 0px))` | The padding shrinks by the scrollbar width, so the content stays in place when the scrollbar appears |
| Keep at least 8px between the scrollbar and content | `padding-right: max(8px, calc(16px - var(--sbw, 0px)))` | The content stays at least 8px away even from a thick scrollbar. It shifts by whatever falls short |
| Leave more room when there's a scrollbar | `padding-right: calc(24px - var(--sbw, 0px))` | 24px without a scrollbar; with one, the gap between the content and the scrollbar is `24px − scrollbar width` |
| Align a row outside the scroll area with the scrollbar width | The element reading the value has to be inside the area | Elements outside the area don't get the value |

```html
<ul data-scrollbar="manual" style="overflow-y: auto">
  <li style="padding-right: calc(16px - var(--sbw, 0px))">…</li>
</ul>
```

Things to know:

| Situation | Details |
| --- | --- |
| To avoid shifting | "Right padding + scrollbar width" has to stay the same with or without a scrollbar. The first row of the table above is that expression. Write it differently and the content shifts by the difference — that's your call |
| Padding smaller than the scrollbar | The value goes negative and the declaration is ignored. Wrap it in `max(0px, …)` |
| Method 1 (Own padding) comes first | If the scroll area's own right padding is at least the scrollbar width, the library shrinks that padding and `--sbw` is 0 |
| Horizontal works the same way | If the scroll area's own bottom padding is at least the scrollbar height, the library shrinks that padding and `--sbh` is 0. Otherwise it passes the height down as `--sbh` and doesn't float the horizontal scrollbar either |
| Horizontal overflow caused only by the vertical scrollbar | `--sbh` is 0, because handling the vertical scrollbar makes that overflow go away too |
| Another scroll area nested inside | The values reset to 0 inside it. The outer area's values don't leak into the inner one |

## Recommendations

### Give left and right padding to the same element, with the same value

- For example, `padding: 0 16px`.
- If the left padding is on the outer container and the right padding is on the scroll area, they look the same but detection treats them differently.

### Don't add extra right padding for the scrollbar

- The library can't tell whether a value like `padding-right: 17px` is for the scrollbar or part of the design, so it doesn't remove it.
- It corrects the shift when the scrollbar appears, but the right side still looks wider when there's no scrollbar.
- Remove the value and it lines up automatically.

### Don't reserve space for the scrollbar in advance

- Reserved space (`scrollbar-gutter`) is released where possible.
- Still, results are more predictable without it in the first place.

### Remove any custom script that measures the scrollbar width to adjust padding

- Both would be handling the same padding.
- Even after the library hides the original scrollbar, the value that script measured stays, and the padding is applied twice (testing confirmed the left padding growing by an extra scrollbar width).
- If you can't remove it, add `data-scrollbar="off"` to that area.
