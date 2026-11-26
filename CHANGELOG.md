# Changelog

Changes that affect people using the library. The newest version is at the top.

## 0.3.0 - 2026-11-26

### Added

- **Right-to-left areas (`direction: rtl`).** A scroll area whose text runs right to left shows its scrollbar on the left; before, the library still adjusted the right side and the content moved by the scrollbar's width. Such areas now go through the same four methods with left and right swapped. It is decided per area, so mixed pages work, and there is nothing to configure. See [How it works](./docs/en/how-it-works.md#right-to-left-areas-direction-rtl).
- Page scrolling in right-to-left documents is covered by tests. The window scrollbar stays on the right in Chromium, Firefox and WebKit, so nothing changed there.

### Changed

- **Which border makes a wrapper count as a visible box.** When looking for room below an area for the horizontal scrollbar, the library now checks the wrapper's bottom border (it used to check the right one). A horizontal scrollbar no longer floats below a wrapper's bottom border line; it is overlaid on the content instead.

### Known limits

- WebKit shifts a right-to-left area that also scrolls sideways by itself; vertical writing modes are evaluated as horizontal. See [Limitations](./docs/en/troubleshooting.md#limitations).

## 0.2.2 - 2026-11-26

### Fixed

- **Styles left behind when a scroll area is removed.** In browsers without anchor positioning, an area that was widened together with a wrapper that clips overflow left the wrapper's margin, width and padding changed after the area was removed from the page.
- **Slow pages when the content keeps growing.** While the window scrollbar stays visible, every change in the page's height walked the whole document, twice. Height-only changes are now skipped (on a 10,000-element page, about 27 ms less per change).
- Uninstalling restores values in reverse order, so an element changed twice ends at its original value.

### Docs

- Limitations: inline `!important` is not kept on padding, margin or width the library changes.

## 0.2.1 - 2026-11-24

- README only: a link to this changelog, a bigger demo button, more room around the GIFs. No code changes.

## 0.2.0 - 2026-11-24

### Changed

- **Page (browser window) scrolling keeps more than the content in place.** When the window scrollbar stays visible, elements laid out against the viewport width now stay where they sit with no scrollbar:
  - a full-width fixed header gives up its own right padding, the same way a scroll area does;
  - floating buttons, centered toasts and boxes pinned to a corner of the page are moved by the difference (`translate`);
  - elements added later are picked up too.
- Elements that already use `translate`, that contain another fixed element, or that would slide behind the scrollbar are left alone. See [Limitations](./docs/en/troubleshooting.md#limitations).

### Fixed

- **Modals that pad `body` for the missing scrollbar (Bootstrap, MUI).** Content shifted by half the scrollbar's width while the modal was open, and on pages with `body` padding the padding stayed changed after it was closed. The library now keeps its own values while the modal fills the scrollbar's space, and puts them back when the scrollbar returns.
- **Code that restores the whole `style` of `body` after unlocking page scrolling.** A value the library had already taken back was read as the page's own, so padding piled up on every open and close.
- **Modals that lock scrolling with an attribute and a stylesheet (Radix).** The page is now re-evaluated when `html` or `body` attributes change, so fixed elements are released while the scrollbar is gone.
- **WebKit: a window scrollbar styled with `::-webkit-scrollbar`.** When the page scrollbar was floated it was not hidden, and it did not come back when re-measured.

### Added

- **Use without a build step.** The README shows how to load the library straight from a CDN with `<script type="module">`. No new files — the published package already works this way.
- README: one line at the top on how this differs from `scrollbar-gutter: stable`, and that React is optional.

### Internal

- The core was split from one 2,000-line file into modules by role (planning, measuring, floating, the engine). The public API is unchanged: `installMrScroll` and `<MrScroll />`.
- Tests for page scrolling: three layouts across Chromium, Firefox and WebKit, through the scrollbar appearing and disappearing and three ways of locking scroll.

## 0.1.1 - 2026-11-23

### Fixed

- The floated scrollbar now copies the styled thumb's border.
- An outside scrollbar is given one more frame before it is given up on (Safari).

### Added

- Live demo page.

## 0.1.0 - 2026-11-20

- Initial release, with the `textarea` option and docs in four languages.
