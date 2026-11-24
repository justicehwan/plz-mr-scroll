/** 스크롤바가 들어갈 바깥 자리를 찾는다 — 오른쪽 바깥(`planWiden`)과 아래 바깥(`hasRoomBelow`). 자리가 비었는지, 넓혀도 되는 상자인지도 여기서 본다. */

import { config } from "./config.js";
import { isShaped } from "./float.js";
import { boxChildren, px, scrolls } from "./measure.js";
import type { StyleChange } from "./types.js";

/** `planWiden` 이 바깥 자리를 못 찾았을 때 그 까닭 — 진단 표시에 쓴다. 판별 한 번 안에서만 읽는다. */
export let whyNot = "";
const no = (why: string) => {
  whyNot = why;

  return null;
};

/** 요소를 오른쪽으로 `by` 만큼 넓힌다. */
function widen(target: HTMLElement, by: number): StyleChange[] {
  const changes: StyleChange[] = [
    { target, prop: "marginRight", value: `${px(getComputedStyle(target).marginRight) - by}px` },
  ];
  const container = target.parentElement;
  if (!container) return changes;
  const style = getComputedStyle(container);
  const containerWidth = container.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
  // 폭이 부모를 꽉 채운 요소는 폭이 100% 로 고정돼 있을 수 있다 — 음수 마진만으로는 안 넓어지니 폭도 같이 준다.
  if (Math.abs(target.offsetWidth - containerWidth) <= 1) {
    // 폭이 안쪽 내용 기준(content-box)이면 여백·테두리가 그 밖에 더해진다 — 그만큼 빼야 바깥 폭이 `by` 만큼만 는다.
    const own = getComputedStyle(target);
    const outside =
      own.boxSizing === "content-box"
        ? px(own.paddingLeft) + px(own.paddingRight) + px(own.borderLeftWidth) + px(own.borderRightWidth)
        : 0;
    changes.push({ target, prop: "width", value: `calc(100% + ${by - outside}px)` });
  }

  return changes;
}

/** 배경·테두리·그림자가 있어 상자로 보이는 요소인가 — 그 밖으로 스크롤바가 나가면 상자에서 삐져나와 보인다. */
function looksLikeBox(style: CSSStyleDeclaration): boolean {
  const background = style.backgroundColor;

  return (
    (background !== "transparent" && background !== "rgba(0, 0, 0, 0)") ||
    px(style.borderRightWidth) > 0 ||
    style.boxShadow !== "none"
  );
}

const TRANSPARENT = "rgba(0, 0, 0, 0)";

/**
 * 스크롤 요소 자신이 눈에 보이는 상자인가 — 그러면 넓히지 않는다.
 * 넓히면 상자가 한쪽으로 길어져 좌우 여백이 달라 보이고, 스크롤바가 생기고 사라질 때 테두리가 움직인다.
 * 배경색은 뒤에 깔린 색과 다를 때만 친다(같은 색이면 넓어져도 안 보인다).
 */
export function isVisibleBox(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  if (px(style.borderRightWidth) > 0 || style.boxShadow !== "none" || style.backgroundImage !== "none") return true;
  if (style.outlineStyle !== "none" && px(style.outlineWidth) > 0) return true;
  const background = style.backgroundColor;
  if (background === "transparent" || background === TRANSPARENT) return false;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const behind = getComputedStyle(parent).backgroundColor;
    if (behind !== "transparent" && behind !== TRANSPARENT) return behind !== background;
  }

  // 조상에 배경색이 하나도 없으면 브라우저 바탕(흰색) 위에 놓인 것이다.
  return background !== "rgb(255, 255, 255)";
}

/**
 * `el` 의 오른쪽 끝에서 `gap` 만큼 떨어진 곳부터 `width` 만큼의 자리(높이는 `el` 과 같다)에 `parent` 의 다른 자식이 걸쳐 있지 않은가.
 * `below` 면 아래쪽 자리(폭은 `el` 과 같다)를 본다. 스크롤바가 놓일 자리가 비어 있는지 볼 때 쓴다.
 * `el` 전체를 덮는 자식(배경·장식 층)은 그 자리에 놓인 요소가 아니라 전체에 깔린 층이라 치지 않는다.
 */
function isEmptyRight(el: HTMLElement, parent: HTMLElement, width: number, below = false, gap = 0): boolean {
  // 상자가 없는 자식(display: contents)은 그 자식들이 실제로 자리를 차지한다(몇 겹이든 펼친다).
  const siblings = boxChildren(parent);
  const box = el.getBoundingClientRect();
  const from = (below ? box.bottom : box.right) + gap;
  for (const sibling of siblings) {
    if (sibling.contains(el)) continue;
    const rect = sibling.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const covers =
      rect.left <= box.left && rect.right >= box.right && rect.top <= box.top && rect.bottom >= box.bottom;
    if (covers) continue;
    const overlapsX = below
      ? rect.left < box.right && rect.right > box.left
      : rect.left < from + width && rect.right > from;
    const overlapsY = below
      ? rect.top < from + width && rect.bottom > from
      : rect.top < box.bottom && rect.bottom > box.top;
    if (overlapsX && overlapsY) return false;
  }

  return true;
}

/**
 * 3. 바깥 여백 — 스크롤 요소가 조상의 오른쪽 여백에 맞닿아 있거나, 오른쪽 바깥이 빈 자리면 그쪽으로 스크롤바 폭만큼만 넓힌다.
 *    스크롤바는 내용 바로 옆에 붙고(여백의 왼쪽 끝), 여백의 나머지는 그 오른쪽에 비어 있다.
 */
export function planWiden(
  el: HTMLElement,
  scrollbarWidth: number,
): { offset: number; widen: StyleChange[] | null; watch?: Element[]; blocked?: boolean } | null {
  whyNot = "";
  const right = el.getBoundingClientRect().right;
  // 지금까지 맞닿아 온 바깥 끝 — 여백 없이 감싼 틀의 테두리는 건너뛰어, 그 바깥의 여백에 붙어 있는지를 본다.
  let edge = right;
  const clippers: HTMLElement[] = [];
  // 지나온 틀 중에 상자로 보이는 것이 있었는가.
  let boxed = false;
  // 깊이를 세지 않는다 — 스크롤 영역과 같은 폭으로 감싸기만 한 틀은 몇 겹이든 지나가고,
  // 여백이 있는 틀·맞닿지 않은 틀·스크롤되는 틀·문서 끝을 만나면 끝난다.
  for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    // 상자가 없는 틀(display: contents)은 위치를 잴 수 없다 — 없는 것으로 치고 지나간다.
    if (style.display === "contents") continue;
    const paddingRight = px(style.paddingRight);
    const borders = px(style.borderLeftWidth) + px(style.borderRightWidth);
    const ownScrollbar = parent.offsetWidth - parent.clientWidth - borders;
    const outer = parent.getBoundingClientRect().right;
    const contentRight = outer - px(style.borderRightWidth) - ownScrollbar - paddingRight;
    const gap = contentRight - edge;
    if (Math.abs(gap) > 1) {
      // 맞닿아 있지 않다 — 가운데 놓인 기둥처럼 오른쪽이 빈 자리일 때만 그쪽을 쓴다.
      // 상자(배경·테두리)나 자르는 틀을 지나왔으면 하지 않는다 — 스크롤바가 그 상자와 떨어져 빈 데에 뜬다.
      if (gap + paddingRight < scrollbarWidth) return no("outside-too-narrow");
      if (boxed || clippers.length > 0) return no("outside-behind-box");
      // 빈 자리는 나중에 찰 수 있고(옆 패널이 붙거나 넓어짐), 옆 요소에 막힌 자리는 나중에 빌 수 있다 —
      // 어느 쪽이든 그 틀과 자식들이 바뀌면 다시 판별하게 한다. 막혀 있으면 `blocked`.
      const watch = [parent, ...parent.children];

      return isEmptyRight(el, parent, scrollbarWidth)
        ? { offset: 0, widen: widen(el, scrollbarWidth), watch }
        : { offset: 0, widen: null, watch, blocked: true };
    }
    // 이 조상도 스크롤바가 떠 있고 자기 여백으로 받을 수 있으면(1번), 그만큼은 조상의 스크롤바 몫이다.
    const room = paddingRight - (ownScrollbar > 0 && paddingRight >= ownScrollbar ? ownScrollbar : 0);
    if (room >= scrollbarWidth) {
      const offset = edge - right;
      // 건넌 테두리가 너무 두꺼우면 쓰지 않는다 — 스크롤바가 자기 영역에서 떨어져 보인다.
      if (offset > config.stayClose) return no("outside-gap-over-limit");
      // 이 여백도 나중에 차거나 빌 수 있다(닫기 버튼이 뜨고 사라짐) — 빈 자리와 같이 그 틀과 자식들을 지켜본다.
      const watch = [parent, ...parent.children];
      // 여백 안, 스크롤바가 놓일 자리에 다른 요소(닫기 버튼 등)가 떠 있으면 쓰지 않는다 — 띄운 스크롤바가 그 요소를 덮고 누름을 가로챈다.
      if (!isEmptyRight(el, parent, scrollbarWidth, false, offset)) {
        return { offset, widen: null, watch, blocked: true };
      }
      // 테두리를 건너왔으면 넓히기로는 못 받는다(넓힌 스크롤바가 그 테두리 위에 걸친다) — 띄울 때만 쓴다.
      // 같이 넓혀야 하는 자르는 틀이 눈에 보이는 상자여도 같다 — 넓히면 그 상자가 한쪽으로 길어진다.
      if (offset > 1 || clippers.some((clipper) => looksLikeBox(getComputedStyle(clipper)))) {
        return { offset, widen: null, watch };
      }
      // 스크롤바 폭만큼만 넓힌다 — 스크롤바가 내용 바로 옆(여백의 왼쪽 끝)에 붙고, 여백의 나머지는 그 오른쪽에 그대로 비어 있다.
      const changes = widen(el, scrollbarWidth);
      // 넘친 부분을 자르는 중간 래퍼는 같이 넓히고, 넓힌 만큼 오른쪽 여백을 줘서 그 안의 다른 내용은 제자리에 둔다.
      for (const clipper of clippers) {
        const value = `${px(getComputedStyle(clipper).paddingRight) + scrollbarWidth}px`;
        changes.push(...widen(clipper, scrollbarWidth), { target: clipper, prop: "paddingRight", value });
      }

      return { offset, widen: changes, watch };
    }
    // 바깥 스크롤 영역을 넓히면 그 영역의 스크롤바 자리가 바뀐다 — 건드리지 않는다.
    if (scrolls(style.overflowY)) return no("outside-is-scroller");
    if (style.overflowX !== "visible" || isShaped(style)) clippers.push(parent);
    if (looksLikeBox(style)) boxed = true;
    // 여백 없이 감싼 틀이면 그 테두리 바깥으로 넘어간다. 여백이 있으면(스크롤바보다 좁은 여백) 넘어가지 않는다 — 스크롤바는 내용 바로 옆에 붙어야 한다.
    if (paddingRight < 1) edge = outer;
  }

  return no("outside-none");
}

/**
 * 바깥 아래에 가로 스크롤바(`height`)가 들어갈 자리가 있는가 — `planWiden` 의 오른쪽 판정을 아래쪽으로 옮긴 것.
 * 스크롤 요소의 아래 끝이 조상의 아래 여백에 맞닿아 있거나, 아래 바깥이 빈 자리일 때다.
 * 자리가 있으면 스크롤 요소의 아래 끝에서 더 떨어뜨릴 거리(사이에 낀 틀의 테두리 두께)와 지켜볼 요소를, 없으면 null 을 돌려준다.
 * 자리는 있는데 옆 요소가 차지하고 있으면 `blocked` 와 지켜볼 요소를 돌려준다.
 */
export function hasRoomBelow(
  el: HTMLElement,
  height: number,
): { offset: number; watch?: Element[]; blocked?: boolean } | null {
  const bottom = el.getBoundingClientRect().bottom;
  // 지금까지 맞닿아 온 바깥 끝 — 여백 없이 감싼 틀의 테두리는 건너뛴다(`planWiden` 과 같다).
  let edge = bottom;
  let clipped = false;
  let boxed = false;
  for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === "contents") continue;
    const paddingBottom = px(style.paddingBottom);
    const borders = px(style.borderTopWidth) + px(style.borderBottomWidth);
    const ownScrollbar = parent.offsetHeight - parent.clientHeight - borders;
    const outer = parent.getBoundingClientRect().bottom;
    const contentBottom = outer - px(style.borderBottomWidth) - ownScrollbar - paddingBottom;
    const gap = contentBottom - edge;
    if (Math.abs(gap) > 1) {
      if (gap + paddingBottom < height || boxed || clipped) return null;
      const watch = [parent, ...parent.children];

      return isEmptyRight(el, parent, height, true) ? { offset: 0, watch } : { offset: 0, watch, blocked: true };
    }
    if (paddingBottom >= height) {
      const offset = edge - bottom;
      if (offset > config.stayClose) return null;
      const watch = [parent, ...parent.children];

      // 아래 여백 안, 스크롤바가 놓일 자리에 다른 요소가 떠 있으면 쓰지 않는다.
      return isEmptyRight(el, parent, height, true, offset) ? { offset, watch } : { offset, watch, blocked: true };
    }
    if (scrolls(style.overflowY) || scrolls(style.overflowX)) return null;
    if (style.overflowY !== "visible" || isShaped(style)) clipped = true;
    if (looksLikeBox(style)) boxed = true;
    if (paddingBottom < 1) edge = outer;
  }

  return null;
}
