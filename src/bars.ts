/**
 * 스크롤바를 화면에 띄우고 거둔다 — 원래 스크롤바를 숨기고, 띄운 스크롤바를 내용 위·오른쪽 바깥·아래에 놓는다(페이지 전체는 화면 오른쪽 끝).
 * 띄운 동안에는 영역 크기가 그대로라 내용이 늘고 줄어도 알 길이 없어, 자식 크기를 따로 지켜본다.
 * `sync` — 다시 판별해야 할 영역을 넘길 곳. `isStopped` — 장치가 내려갔는가.
 */

import { GHOST_ATTRIBUTE, NUDGE_ATTRIBUTE, OVERLAY_ATTRIBUTE, OVERLAY_CSS, PAGE_GHOST_ATTRIBUTE } from "./constants.js";
import { clippedAway } from "./float.js";
import { follow, ghostOf, ghosts, lead, noOutside, thumbOf } from "./ghost.js";
import { boxChildren, px } from "./measure.js";
import type { Bar, Plan } from "./types.js";

export function createBars(sync: (els: HTMLElement[]) => void, isStopped: () => boolean) {
  const overlayStyle = document.createElement("style");
  overlayStyle.textContent = OVERLAY_CSS;
  document.head.appendChild(overlayStyle);

  let pageGhost: Bar | null = null;
  /** 페이지 전체에 띄울 스크롤바 — 창 스크롤바를 숨기고(`html` 에 표시), 화면 오른쪽 끝에 고정한 상자를 창 스크롤과 맞물린다. */
  const showPageOverlay = (scrollbarWidth: number) => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const width = style.scrollbarWidth;
    const thumb = thumbOf(style);
    if (!pageGhost) {
      const bar = document.createElement("div");
      bar.setAttribute(PAGE_GHOST_ATTRIBUTE, "");
      bar.setAttribute("aria-hidden", "true");
      bar.tabIndex = -1;
      const filler = document.createElement("div");
      bar.appendChild(filler);
      document.body.appendChild(bar);
      pageGhost = { bar, filler, barSet: NaN, elSet: NaN };
      lead(pageGhost, true, (top) => {
        window.scrollTo({ top, left: window.scrollX, behavior: "instant" });

        return window.scrollY;
      });
    }
    // 바깥 코드가 `body` 를 다시 그려 막대가 떨어져 나갔으면 다시 붙인다.
    if (!pageGhost.bar.isConnected) document.body.appendChild(pageGhost.bar);
    root.setAttribute(OVERLAY_ATTRIBUTE, "");
    // `::-webkit-scrollbar` 로 꾸민 창 스크롤바는 숨기는 표시를 붙여도 그대로 남는 엔진이 있다(WebKit) —
    // 아직 폭을 차지하고 있으면 overflow 를 잠깐 바꿨다 돌려놓아 스크롤바를 다시 만들게 한다(스크롤 위치는 그대로다).
    if (window.innerWidth - root.clientWidth >= 2) {
      root.setAttribute(NUDGE_ATTRIBUTE, "");
      void root.offsetHeight;
      root.removeAttribute(NUDGE_ATTRIBUTE);
    }
    // ponytail: 창 스크롤바는 `scrollbar-width`·`scrollbar-color` 만 옮긴다(`::-webkit-scrollbar` 로 꾸민 모양은 옮기지 않는다).
    // 굴릴 것이 없으면 띄우지 않는다(위 `showOverlay` 와 같다) — 화면 오른쪽 끝의 누름을 가로채지 않게.
    const display = root.scrollHeight - root.clientHeight > 1 ? "block" : "none";
    pageGhost.bar.style.cssText = `display:${display};position:fixed;top:0;right:0;width:${scrollbarWidth}px;height:100dvh;overflow:hidden scroll;z-index:2147483647;background:transparent;scrollbar-width:${width};scrollbar-color:${thumb} transparent`;
    pageGhost.filler.style.cssText = `width:1px;height:${root.scrollHeight}px`;
    pageGhost.bar.scrollTop = window.scrollY;
    pageGhost.barSet = pageGhost.bar.scrollTop;
  };
  // 겹치기 중에는 원래 스크롤바가 숨어 내용 높이만 바뀌면 영역 감시가 안 불린다 — 자식 크기를 따로 지켜본다.
  // ponytail: 자식마다 감시를 건다 — 행이 아주 많은 목록에서 무거우면 끝에 둔 표지 요소 하나로 내용 높이를 잰다.
  /** 겹치기 중인 영역 → 지켜보는 자식들. */
  const watching = new Map<HTMLElement, Element[]>();
  /** 지켜보는 자식 → 그 영역. */
  const watchedBy = new WeakMap<Element, HTMLElement>();
  const childObserver = new ResizeObserver((entries) => {
    const els = new Set<HTMLElement>();
    for (const { target } of entries) {
      const el = watchedBy.get(target);
      if (el?.isConnected) els.add(el);
    }
    if (els.size > 0) sync([...els]);
  });
  const watchChildren = (el: HTMLElement) => {
    const children = boxChildren(el);
    for (const child of children) {
      // 이미 지켜보는 자식에 다시 걸면 첫 알림이 또 와서 끝없이 다시 판별한다.
      if (watchedBy.get(child) === el) continue;
      watchedBy.set(child, el);
      childObserver.observe(child);
    }
    const current = new Set(children);
    for (const child of watching.get(el) ?? []) {
      // 다른 영역으로 옮겨 간 자식은 그 영역이 지켜보고 있다 — 여기서 끊지 않는다.
      if (current.has(child) || watchedBy.get(child) !== el) continue;
      childObserver.unobserve(child);
      watchedBy.delete(child);
    }
    watching.set(el, children);
  };
  const unwatchChildren = (el: HTMLElement) => {
    for (const child of watching.get(el) ?? []) {
      if (watchedBy.get(child) !== el) continue;
      childObserver.unobserve(child);
      watchedBy.delete(child);
    }
    watching.delete(el);
  };
  /**
   * 스크롤바를 띄운다 — 못 띄웠으면 false(다시 판별해야 한다).
   * 세로(`overlay`)는 내용 위(첫 줄에 끼워 둠)나 오른쪽 바깥(`offset` 이 있을 때)에, 가로(`bottom`)는 내용 아래쪽 위나 아래 바깥에 띄운다.
   */
  const showOverlay = (el: HTMLElement, scrollbarWidth: number, plan: Plan): boolean => {
    if (el === document.body) {
      showPageOverlay(scrollbarWidth);

      return true;
    }
    const ghost = ghostOf(el);
    if (!ghost) return false;
    const { overlay, offset, bottom, bottomOffset = 0, height = 0 } = plan;
    const outside = offset !== undefined;
    watchChildren(el);
    // 원래 스크롤바를 숨기기 전에 그 모양을 읽어 둔다(숨긴 뒤에는 값이 바뀐다).
    const style = getComputedStyle(el);
    const width = style.scrollbarWidth;
    const paddingTop = px(style.paddingTop);
    const paddingRight = px(style.paddingRight);
    const borderTop = px(style.borderTopWidth);
    const borderRight = px(style.borderRightWidth);
    const borderBottom = px(style.borderBottomWidth);
    const borderLeft = px(style.borderLeftWidth);
    const rowGap = style.display === "flex" ? px(style.rowGap) : 0;
    // `::-webkit-scrollbar` 로 꾸민 스크롤바면 그 굵기·손잡이 모양을 옮긴다.
    const pseudo = getComputedStyle(el, "::-webkit-scrollbar");
    const custom =
      width === "auto" &&
      Math.abs(overlay ? px(pseudo.width) - scrollbarWidth : px(pseudo.height) - height) <= 1;
    const customThumb = custom ? getComputedStyle(el, "::-webkit-scrollbar-thumb") : null;
    // 손잡이의 테두리와 칠 범위도 옮긴다 — 투명한 테두리를 둘러 손잡이를 가늘어 보이게 하는 꾸밈
    // (`border: 3px solid transparent` + `background-clip: content-box`)이 흔하다. 빼면 띄운 손잡이만 굵어진다.
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const thumbBorder = customThumb
      ? `border-style:${sides.map((side) => customThumb[`border${side}Style`]).join(" ")};` +
        `border-width:${sides.map((side) => customThumb[`border${side}Width`]).join(" ")};` +
        `border-color:${sides.map((side) => customThumb[`border${side}Color`]).join(" ")};` +
        `background-clip:${customThumb.backgroundClip}`
      : "";
    const look = customThumb
      ? `[${GHOST_ATTRIBUTE}]>div::-webkit-scrollbar{width:${scrollbarWidth}px;height:${height}px}[${GHOST_ATTRIBUTE}]>div::-webkit-scrollbar-thumb{background:${customThumb.backgroundColor};border-radius:${customThumb.borderRadius};${thumbBorder}}`
      : `[${GHOST_ATTRIBUTE}]>div{scrollbar-width:${width};scrollbar-color:${thumbOf(style)} transparent}`;

    el.setAttribute(OVERLAY_ATTRIBUTE, "");
    // 굴릴 것이 없으면 띄우지 않는다 — 스크롤바를 늘 띄워 두는 영역(overflow: scroll)은 넘치지 않아도 스크롤바가 재지는데,
    // 그대로 띄우면 손잡이 없는 투명한 막대가 내용 끝을 덮고 누름을 가로챈다. 원래 스크롤바의 빈 띠는 숨긴 채로 둔다.
    const showV = overlay && el.scrollHeight - el.clientHeight > 1;
    const showH = bottom !== undefined && el.scrollWidth - el.clientWidth > 1;
    // 세로를 가장자리에 붙여 띄우는가 — 바깥이거나, 가로와 같이 띄울 때. 그 밖에는(세로만 내용 위에) 첫 줄에 끼워 둔다.
    const pinned = showV && (outside || bottom !== undefined || plan.pinned === true);
    const anchored = pinned || showH;
    const sheet = ghost.anchor.previousElementSibling;
    // 가장자리에 붙일 때는 스크롤 요소 자신을 「붙을 자리」로 이름 붙인다 — 이름과 그걸 쓰는 쪽이 같은 shadow root 안이라 바깥 CSS 와 얽히지 않는다.
    if (sheet) sheet.textContent = anchored ? `${look}:host{anchor-name:${ghost.name}}` : look;
    // 스크롤 요소 밖은 잘려서 안 보인다 — 화면에 고정한 상자(fixed)를 스크롤 요소의 가장자리에 붙여 둔다.
    // 스크롤 요소가 움직이거나 바깥이 스크롤되면 브라우저가 따라 옮긴다. 흐름에서 빠져 있어 스크롤 요소의 배치를 안 흔든다.
    const pin = `position:fixed;position-anchor:${ghost.name};pointer-events:auto;z-index:1;position-visibility:anchors-visible;`;
    const tall = `width:${scrollbarWidth}px;height:${el.clientHeight}px;overflow:hidden scroll`;
    ghost.anchor.style.cssText = "display:contents";
    if (!showV) {
      ghost.v.bar.style.cssText = "display:none";
    } else if (outside) {
      ghost.v.bar.style.cssText = `${pin}left:anchor(right);top:anchor(top);margin:${borderTop}px 0 0 ${offset}px;${tall}`;
    } else if (pinned) {
      ghost.v.bar.style.cssText = `${pin}right:anchor(right);top:anchor(top);margin:${borderTop}px ${borderRight}px 0 0;${tall}`;
    } else {
      // 높이 0 인 첫 줄로 두고 스크롤 영역 위쪽에 붙여 둔다(sticky) — 스크롤해도 제자리에 있다. flex 의 줄 간격은 음수 여백으로 지운다.
      ghost.anchor.style.cssText = `display:block;position:sticky;top:${paddingTop}px;height:0;flex:none;align-self:stretch;margin:0 0 ${-rowGap}px;pointer-events:none;z-index:1`;
      ghost.v.bar.style.cssText = `position:absolute;top:${-paddingTop}px;right:${-paddingRight}px;${tall};pointer-events:auto`;
    }
    if (!showH) {
      ghost.h.bar.style.cssText = "display:none";
    } else {
      const wide = `width:${el.clientWidth}px;height:${height}px;overflow:scroll hidden`;
      ghost.h.bar.style.cssText =
        bottom === "outside"
          ? `${pin}top:anchor(bottom);left:anchor(left);margin:${bottomOffset}px 0 0 ${borderLeft}px;${wide}`
          : `${pin}bottom:anchor(bottom);left:anchor(left);margin:0 0 ${borderBottom}px ${borderLeft}px;${wide}`;
    }
    ghost.v.filler.style.cssText = `width:1px;height:${el.scrollHeight}px`;
    ghost.h.filler.style.cssText = `height:1px;width:${el.scrollWidth}px`;
    ghost.v.bar.scrollTop = el.scrollTop;
    ghost.v.barSet = ghost.v.bar.scrollTop;
    ghost.h.bar.scrollLeft = el.scrollLeft;
    ghost.h.barSet = ghost.h.bar.scrollLeft;
    if (!anchored) {
      pendingFit.delete(el);

      return true;
    }
    // ponytail: 띄운 자리를 바로 재서 확인한다(가장자리에 붙인 영역마다 레이아웃을 한 번 더 계산한다). 무거우면 한 번 붙은 영역은 다시 재지 않는다.
    // ponytail: 세로·가로를 둘 다 내용 위에 띄우면 오른쪽 아래 모서리에서 두 손잡이가 겹칠 수 있다 — 거슬리면 서로의 굵기만큼 줄이고 스크롤 위치를 비율로 맞춘다.
    // 제자리에 붙었고, 조상에 잘려 안 보이는 자리도 아닌가.
    const fits = () => {
      const box = el.getBoundingClientRect();
      const stuck = (target: HTMLElement, left: number, top: number, vertical: boolean) => {
        const at = target.getBoundingClientRect();

        return Math.abs(at.left - left) <= 1 && Math.abs(at.top - top) <= 1 && !clippedAway(el, at, vertical);
      };
      const verticalLeft = outside ? box.right + offset : box.right - borderRight - scrollbarWidth;
      const horizontalTop =
        bottom === "outside" ? box.bottom + bottomOffset : box.bottom - borderBottom - height;

      return (
        (!pinned || stuck(ghost.v.bar, verticalLeft, box.top + borderTop, true)) &&
        (!showH || stuck(ghost.h.bar, box.left + borderLeft, horizontalTop, false))
      );
    };
    if (fits()) {
      pendingFit.delete(el);

      return true;
    }
    // 안 붙었거나 잘린다. 다만 방금 붙인 자리를 그 자리에서 재면 아직 안 잡혀 있는 엔진이 있다(Safari 26 — 다음 화면 갱신에서야 잡힌다).
    // 바로 포기하고 원래 스크롤바를 되살려 다시 재면, 그 엔진은 꾸민 스크롤바 대신 기본 스크롤바의 폭을 돌려준다 —
    // 한 번은 띄운 채로 두고 다음 화면 갱신 때 다시 잰다. 그때도 아니면 기억해 두고 넓히기·겹치기로 다시 판별한다.
    const waiting = pendingFit.has(el);
    pendingFit.set(el, fits);
    if (!waiting) {
      requestAnimationFrame(() => {
        const again = pendingFit.get(el);
        pendingFit.delete(el);
        if (!again || isStopped() || !el.isConnected || again()) return;
        noOutside.add(el);
        sync([el]);
      });
    }

    return true;
  };
  /** 가장자리에 붙인 스크롤바가 제자리에 붙었는지 다음 화면 갱신 때 다시 재기로 한 영역 — 그때 쓸 검사. */
  const pendingFit = new Map<HTMLElement, () => boolean>();
  const hideOverlay = (el: HTMLElement) => {
    pendingFit.delete(el);
    if (el === document.body) pageGhost?.bar.style.setProperty("display", "none");
    else ghosts.get(el)?.anchor.style.setProperty("display", "none");
    unwatchChildren(el);
  };
  /** 창을 굴리면 페이지 전체에 띄운 스크롤바가 따라간다. 문서 높이가 바뀌었으면 손잡이 길이도 맞춘다. */
  const followPage = () => {
    const root = document.documentElement;
    if (!pageGhost || !root.hasAttribute(OVERLAY_ATTRIBUTE)) return;
    const height = `${root.scrollHeight}px`;
    if (pageGhost.filler.style.height !== height) pageGhost.filler.style.height = height;
    follow(pageGhost, window.scrollY, true);
  };
  /** 장치가 내려갈 때 — 자식 크기 감시를 끊고 원래 스크롤바를 숨기던 스타일을 걷는다. */
  const dispose = () => {
    childObserver.disconnect();
    overlayStyle.remove();
  };

  return { showOverlay, hideOverlay, watchChildren, unwatchChildren, followPage, dispose };
}
