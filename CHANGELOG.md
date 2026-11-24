# Changelog

Changes that affect people using the library. The newest version is at the top.

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
