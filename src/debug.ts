/**
 * 진단 표시(`debug` 옵션) — 영역마다 고른 방식·스크롤바 자리·바꾼 여백을 화면 맨 위의 층에 그린다. 스크롤 영역에는 아무것도 끼워 넣지 않는다.
 * `debugInfo` — 영역마다 마지막 판별에서 쓴 값(`engine.ts` 가 채운다). `isStopped` — 장치가 내려갔는가.
 */

import { config } from "./config.js";
import { DEBUG_ATTRIBUTE, DEBUG_CSS, METHOD_ATTRIBUTE, METHOD_X_ATTRIBUTE, QUIET, WHY_ATTRIBUTE } from "./constants.js";
import { px } from "./measure.js";
import type { DebugInfo, Shape, StyleProp } from "./types.js";

export function createDebug(debugInfo: WeakMap<HTMLElement, DebugInfo>, isStopped: () => boolean) {
  /** 진단 층에 그릴 조각들 — 손댈 일이 없었던 영역이면 null. 읽기만 한다. */
  const shapesOf = (el: HTMLElement): Shape[] | null => {
    const vertical = el.getAttribute(METHOD_ATTRIBUTE) ?? "none";
    const horizontal = el.getAttribute(METHOD_X_ATTRIBUTE) ?? "none";
    const why = el.getAttribute(WHY_ATTRIBUTE) ?? "";
    if (vertical === "none" && horizontal === "none" && QUIET.has(why)) return null;
    const page = el === document.body;
    const tone = `${vertical === "none" ? horizontal : vertical}${page ? " page" : ""}`;
    // 페이지 전체(`body`)는 화면 크기로 그린다.
    const rect = page ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : el.getBoundingClientRect();
    const info = debugInfo.get(el);
    const short = (value: string) => (value.endsWith("px") ? `${Math.round(px(value) * 100) / 100}` : value || "auto");
    const css = (prop: string) => prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const parts: string[] = [];
    if (vertical !== "none") {
      const gap = vertical === "outside" && info?.offset ? ` · gap ${short(`${info.offset}px`)}` : "";
      parts.push(`↕ ${vertical}${info?.width ? ` · S ${info.width}` : ""}${gap}`);
    }
    if (horizontal !== "none") {
      const gap = horizontal === "outside" && info?.bottomOffset ? ` · gap ${short(`${info.bottomOffset}px`)}` : "";
      parts.push(`↔ ${horizontal}${info?.height ? ` · H ${info.height}` : ""}${gap}`);
    }
    for (const { target, prop, from, to } of info?.changes ?? []) {
      parts.push(`${target === el ? "" : "child "}${css(prop)} ${short(from)} → ${short(to)}`);
    }
    const text = `${parts.join(" · ") || "none"}${why ? ` — ${why}` : ""}`;
    const shapes: Shape[] = [{ kind: `${tone} area`, x: rect.left, y: rect.top, w: rect.width, h: rect.height }];
    if (info && !page) {
      const style = getComputedStyle(el);
      const left = rect.left + el.clientLeft;
      const top = rect.top + el.clientTop;
      const borderRight = px(style.borderRightWidth);
      const borderBottom = px(style.borderBottomWidth);
      // 스크롤바가 놓인 자리 — 바깥에 띄웠으면 영역 밖, 그 밖에는 안쪽 끝.
      if (vertical !== "none" && info.width > 0) {
        const x = vertical === "outside" ? rect.right + (info.offset ?? 0) : rect.right - borderRight - info.width;
        shapes.push({ kind: `${tone} bar`, x, y: top, w: info.width, h: el.clientHeight });
      }
      if (horizontal !== "none" && info.height > 0) {
        const y = horizontal === "outside" ? rect.bottom + (info.bottomOffset ?? 0) : rect.bottom - borderBottom - info.height;
        shapes.push({ kind: `${tone} bar`, x: left, y, w: el.clientWidth, h: info.height });
      }
      // 줄이거나 더한 뒤의 여백 — 바뀐 요소(영역 자신이나 그 안쪽 자식)의 그 여백 자리에 빗금.
      // 안쪽 자식은 영역보다 길 수 있다 — 영역에 보이는 부분만 그린다.
      const pad = (x: number, y: number, w: number, h: number) => {
        const x0 = Math.max(x, left);
        const y0 = Math.max(y, top);
        const x1 = Math.min(x + w, left + el.clientWidth);
        const y1 = Math.min(y + h, top + el.clientHeight);
        if (x1 > x0 && y1 > y0) shapes.push({ kind: `${tone} pad`, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      };
      for (const { target, prop, to } of info.changes) {
        const size = px(to);
        if (size <= 0 || !target.isConnected) continue;
        const box = target.getBoundingClientRect();
        const x = box.left + target.clientLeft;
        const y = box.top + target.clientTop;
        if (prop === "paddingRight") pad(x + target.clientWidth - size, y, size, target.clientHeight);
        else if (prop === "paddingLeft") pad(x, y, size, target.clientHeight);
        else if (prop === "paddingBottom") pad(x, y + target.clientHeight - size, target.clientWidth, size);
      }
      // 스크롤바가 없을 때의 내용 자리 — 원래 스크롤바가 차지한 폭을 되돌리고, 바꾸기 전 여백으로 잰다.
      const before = (prop: StyleProp, now: string) =>
        px(info.changes.find((change) => change.target === el && change.prop === prop)?.from ?? now);
      const nativeWidth = Math.max(0, el.offsetWidth - el.clientWidth - el.clientLeft - borderRight);
      const nativeHeight = Math.max(0, el.offsetHeight - el.clientHeight - el.clientTop - borderBottom);
      const x0 = left + before("paddingLeft", style.paddingLeft);
      // 예비 방식으로 넓힌 영역은 넓힌 만큼(바깥으로 민 여백)을 뺀다.
      const margin = info.changes.find((change) => change.target === el && change.prop === "marginRight");
      const widened = margin ? px(margin.from) - px(margin.to) : 0;
      const x1 = left + el.clientWidth + nativeWidth - widened - before("paddingRight", style.paddingRight);
      const y0 = top + px(style.paddingTop);
      const y1 = top + el.clientHeight + nativeHeight - before("paddingBottom", style.paddingBottom);
      if (x1 > x0 && y1 > y0) shapes.push({ kind: `${tone} content`, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    // 딱지는 맨 위에 보이게 마지막에 둔다.
    shapes.push({ kind: `${tone} tag`, x: rect.left, y: rect.top, w: 0, h: 0, text });

    return shapes;
  };
  /** 진단 층 — 표시(`data-scrollbar-method` 등)가 붙은 영역을 따라다니며 그린다. */
  let debugHost: HTMLElement | null = null;
  let debugFrame = 0;
  const debugDrawn = new Map<Element, { key: string; nodes: HTMLElement[] }>();
  // ponytail: 진단을 켠 동안 매 프레임 표시가 붙은 영역을 전부 다시 잰다 — 개발 중에만 켜는 것이라 그대로 둔다.
  const drawDebug = () => {
    debugFrame = 0;
    if (isStopped() || !config.debug) {
      debugHost?.remove();
      debugHost = null;
      debugDrawn.clear();

      return;
    }
    if (debugHost && !debugHost.isConnected) {
      // 바깥 코드가 `body` 를 다시 그려 층이 떨어져 나갔다 — 다시 만든다.
      debugHost = null;
      debugDrawn.clear();
    }
    if (!debugHost) {
      debugHost = document.createElement("div");
      debugHost.setAttribute(DEBUG_ATTRIBUTE, "");
      // 인라인으로도 준다 — 바깥 CSS(`body > div { position: relative }` 등)가 shadow root 안의 `:host` 규칙을 이기면
      // 이 층이 `body` 의 흐름 자식이 되어 페이지 전체 판별(자식 수)을 바꾼다.
      debugHost.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
      debugHost.setAttribute("aria-hidden", "true");
      const sheet = document.createElement("style");
      sheet.textContent = DEBUG_CSS;
      debugHost.attachShadow({ mode: "open" }).appendChild(sheet);
      document.body.appendChild(debugHost);
    }
    const seen = new Set<Element>();
    for (const el of document.querySelectorAll<HTMLElement>(`[${METHOD_ATTRIBUTE}]`)) {
      const shapes = shapesOf(el);
      if (!shapes) continue;
      seen.add(el);
      const key = shapes.map(({ kind, x, y, w, h, text }) => `${kind}|${x}|${y}|${w}|${h}|${text ?? ""}`).join(";");
      const drawn = debugDrawn.get(el);
      if (drawn?.key === key) continue;
      for (const node of drawn?.nodes ?? []) node.remove();
      const nodes = shapes.map(({ kind, x, y, w, h, text }) => {
        const node = document.createElement("div");
        node.className = kind;
        // 딱지는 글자 크기대로 둔다.
        node.style.cssText = text === undefined ? `left:${x}px;top:${y}px;width:${w}px;height:${h}px` : `left:${x}px;top:${y}px`;
        if (text !== undefined) node.textContent = text;

        return node;
      });
      debugHost.shadowRoot?.append(...nodes);
      debugDrawn.set(el, { key, nodes });
    }
    for (const [el, drawn] of debugDrawn) {
      if (seen.has(el)) continue;
      for (const node of drawn.nodes) node.remove();
      debugDrawn.delete(el);
    }
    debugFrame = requestAnimationFrame(drawDebug);
  };
  const startDebug = () => {
    if (config.debug && !debugFrame) debugFrame = requestAnimationFrame(drawDebug);
  };

  return { startDebug, cancelDebug: () => cancelAnimationFrame(debugFrame) };
}
