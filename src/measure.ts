/** 재는 함수들 — 스크롤바 굵기, 스크롤 영역인지, 흐름 안의 자식, 여백을 바꿔도 상자 크기가 그대로인지. 화면을 바꾸지 않는다(`keepsBox` 만 잠깐 썼다 되돌린다). */

import { isExcluded, skipsTextarea } from "./config.js";
import { NUDGE_ATTRIBUTE, PAGE_GHOST_ATTRIBUTE } from "./constants.js";
import type { StyleChange } from "./types.js";

export const px = (value: string) => parseFloat(value) || 0;
export const scrolls = (overflowY: string) => overflowY === "auto" || overflowY === "scroll";

/**
 * 세로 스크롤바가 왼쪽에 뜨는 영역인가 — 글 방향이 오른쪽에서 왼쪽(`direction: rtl`)인 스크롤 요소.
 * 계산된 방향으로 본다: 왼쪽 스크롤바를 `clientLeft` 에 넣지 않는 엔진(WebKit)이 있어 재서는 가릴 수 없다.
 * 창 스크롤바는 방향과 상관없이 오른쪽에 뜬다(Chromium·Firefox·WebKit 에서 잼) — 페이지 전체는 늘 오른쪽으로 본다.
 */
export const barOnLeft = (el: Element) => el !== document.body && getComputedStyle(el).direction === "rtl";

/**
 * 좌우를 뒤집어 읽는 이름과 자리 — 판별은 전부 「스크롤바가 오른쪽」으로 쓰여 있다. 스크롤바가 왼쪽인 영역(`flip`)은
 * 속성 이름의 좌우를 바꾸고(`near` = 스크롤바 쪽, `far` = 반대쪽) 화면 자리의 좌우를 거울처럼 뒤집어(x → -x) 같은 식으로 잰다.
 */
export const sidesOf = (flip: boolean) =>
  flip ? ({ near: "Left", far: "Right" } as const) : ({ near: "Right", far: "Left" } as const);
export function rectOf(el: Element, flip: boolean) {
  const { left, right, top, bottom, width, height } = el.getBoundingClientRect();

  return flip ? { left: -right, right: -left, top, bottom, width, height } : { left, right, top, bottom, width, height };
}

/** `::-webkit-scrollbar` 로 스크롤바를 꾸미는 엔진인가(Chromium·WebKit). */
const WEBKIT_BARS = typeof CSS !== "undefined" && CSS.supports("selector(::-webkit-scrollbar)");

/**
 * 숨겼다 되살린 원래 스크롤바가 제 모습이 아닌가 — 아예 안 재지거나(0), `::-webkit-scrollbar` 로 꾸민 굵기와 다르게 재진다.
 * 표준 속성(`scrollbar-width`·`scrollbar-color`)을 준 영역은 꾸민 굵기가 쓰이지 않으니 비교하지 않는다.
 */
export function revivedWrong(el: HTMLElement): boolean {
  const width = scrollbarWidthOf(el);
  const height = scrollbarHeightOf(el);
  if (width === 0 && height === 0) return true;
  if (!WEBKIT_BARS) return false;
  const style = getComputedStyle(el);
  if (style.scrollbarWidth !== "auto" || style.scrollbarColor !== "auto") return false;
  const pseudo = getComputedStyle(el, "::-webkit-scrollbar");
  if (pseudo.display === "none") return false;
  const wrong = (measured: number, styled: number) => measured > 0 && styled > 0 && Math.abs(measured - styled) > 1;

  return wrong(width, px(pseudo.width)) || wrong(height, px(pseudo.height));
}

/**
 * 이 여백 변경을 써도 상자가 「스크롤바가 없을 때」와 같은가 — 스크롤 요소 자신은 바깥 크기가, 그 안쪽 자식은 내용 칸의 폭이 같아야 한다.
 * 크기를 안쪽 내용 기준(`box-sizing: content-box`)으로 못박은 상자는 여백을 줄여도 내용 칸이 안 늘고 상자만 준다 — 그런 상자에는 그 방식을 쓰지 않는다.
 * (폭·높이를 고쳐 써서 맞추지 않는다 — 비율로 준 크기가 숫자로 굳고, 내용으로 정해지는 크기를 못박게 된다.)
 * 그런 상자가 없으면 재지 않는다. 있으면 스크롤바를 잠깐 숨겨 재고, 변경을 잠깐 써서 다시 잰 뒤 둘 다 되돌린다.
 */
export function keepsBox(scroller: HTMLElement, changes: StyleChange[]): boolean {
  // 페이지 전체는 스크롤바가 창의 것이라 이렇게 잴 수 없다 — 하던 대로 둔다.
  if (scroller === document.body) return true;
  const padded = changes.filter(
    ({ target, prop }) =>
      (prop === "paddingRight" || prop === "paddingLeft" || prop === "paddingBottom") &&
      getComputedStyle(target).boxSizing === "content-box",
  );
  if (padded.length === 0) return true;
  const measure = () =>
    padded.map(({ target, prop }) => {
      if (target === scroller) return prop === "paddingBottom" ? target.offsetHeight : target.offsetWidth;
      const style = getComputedStyle(target);

      return target.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
    });
  // 변경을 쓴 상태를 먼저 잰다 — 스크롤바를 숨겼다 되돌리면 그 자리에서 바로 다시 그리지 않는 엔진(WebKit)이 있다.
  // 인라인 style 은 통째로 되돌린다 — 속성 하나씩 되돌리면 `!important` 가 떨어진다.
  const targets = [...new Set(changes.map(({ target }) => target))];
  const saved = targets.map((target) => target.getAttribute("style"));
  for (const { target, prop, value } of changes) target.style[prop] = value;
  const after = measure();
  targets.forEach((target, index) => {
    const style = saved[index];
    if (style === null) target.removeAttribute("style");
    else target.setAttribute("style", style);
  });
  scroller.setAttribute(NUDGE_ATTRIBUTE, "");
  const base = measure();
  scroller.removeAttribute(NUDGE_ATTRIBUTE);

  return base.every((size, index) => Math.abs(size - after[index]) < 1);
}

/**
 * 세로 스크롤 영역인가 — 계산된 스타일로 본다(class 이름·CSS 를 어떻게 썼든 같다).
 * 페이지 전체(`html`·`body`)는 따로 다루고, 우리가 띄운 페이지 스크롤바는 뺀다.
 */
export function isScroller(el: Element): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el !== document.body &&
    el !== document.documentElement &&
    !el.hasAttribute(PAGE_GHOST_ATTRIBUTE) &&
    !isExcluded(el) &&
    !skipsTextarea(el) &&
    // 가로로만 스크롤되는 영역(세로는 hidden)도 본다.
    (scrolls(getComputedStyle(el).overflowY) || scrolls(getComputedStyle(el).overflowX))
  );
}

/** 인라인 style 의 overflow 선언만 — `text-overflow`·`overflow-wrap` 은 뺀다. */
export const overflowOf = (style: string | null) =>
  style?.match(/(?:^|;)\s*overflow(?:-[xy])?\s*:[^;]*/g)?.join(";") ?? "";
export const isStyleSheet = (node: Node) =>
  node instanceof HTMLStyleElement ||
  (node instanceof HTMLLinkElement && node.relList.contains("stylesheet"));

/** 크기를 지켜볼 자식 — 상자가 없는 자식(display: contents)은 크기 감시가 안 불려 그 자식들을 본다. */
export const boxChildren = (node: Element): Element[] =>
  [...node.children].flatMap((child) =>
    getComputedStyle(child).display === "contents" ? boxChildren(child) : [child],
  );

/** 지금 떠 있는 세로 스크롤바 폭 — 스크롤이 없거나 겹쳐 뜨는 스크롤바면 0. */
export function scrollbarWidthOf(el: HTMLElement) {
  // 페이지 전체(브라우저 창) 스크롤은 `body` 로 대표한다 — 창 폭에서 문서 폭을 빼면 창 스크롤바 폭이다.
  if (el === document.body) {
    const width = window.innerWidth - document.documentElement.clientWidth;

    return width < 2 ? 0 : width;
  }
  const { overflowY, borderLeftWidth, borderRightWidth } = getComputedStyle(el);
  if (!scrolls(overflowY)) return 0;
  const width = el.offsetWidth - el.clientWidth - px(borderLeftWidth) - px(borderRightWidth);

  // offsetWidth·clientWidth 는 정수로 반올림돼, 화면 배율에 따라 스크롤바가 없어도 1 이 나올 수 있다.
  return width < 2 ? 0 : width;
}

/** 지금 떠 있는 가로 스크롤바 높이 — 없거나 겹쳐 뜨는 스크롤바면 0. */
export function scrollbarHeightOf(el: HTMLElement) {
  // ponytail: 페이지 전체(브라우저 창)의 가로 스크롤바는 다루지 않는다 — 필요해지면 세로처럼 화면 아래 끝에 고정해 띄운다.
  if (el === document.body) return 0;
  const { overflowX, borderTopWidth, borderBottomWidth } = getComputedStyle(el);
  if (!scrolls(overflowX)) return 0;
  const height = el.offsetHeight - el.clientHeight - px(borderTopWidth) - px(borderBottomWidth);

  return height < 2 ? 0 : height;
}

/**
 * 흐름 안에 놓인 자식(절대 위치·안 보이는 것 제외) 전부.
 * ponytail: 개수로 끊지 않는다 — 앞쪽만 보면 뒤쪽의 폭이 다른 자식을 놓쳐 판별이 틀린다. 자식이 아주 많아 무거우면 자식이 바뀔 때까지 결과를 기억한다.
 */
export function flowChildren(node: HTMLElement) {
  const children: HTMLElement[] = [];
  for (const child of node.children) {
    if (!(child instanceof HTMLElement) || child.offsetWidth === 0) continue;
    const { position } = getComputedStyle(child);
    if (position !== "absolute" && position !== "fixed") children.push(child);
  }

  return children;
}
