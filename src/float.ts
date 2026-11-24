/** 스크롤바를 띄울 수 있는 요소·구조인가 — 내용 위에 겹칠 수 있는지, 가장자리에 붙여 띄울 수 있는지, 띄운 것이 조상에 잘려 안 보이는지. */

import { cannotAttach, noOutside } from "./ghost.js";
import { scrollbarHeightOf } from "./measure.js";

/** 4. 겹치기 — 세로를 숨긴 뒤에도 남는 가로 넘침이 없고, 자식을 위에서 아래로 쌓는 배치일 때만 쓴다. */
export function canOverlay(el: HTMLElement, scrollbarWidth: number, outside = false, floats = false) {
  // 원래 스크롤바를 숨기면 가로 스크롤바도 사라진다 — 세로 스크롤바 폭보다 더 넘쳐 숨긴 뒤에도 가로로 넘치면 하지 않는다.
  if (el === document.body) {
    const root = document.documentElement;
    const horizontal = window.innerHeight - root.clientHeight >= 2;

    // 페이지 전체는 화면 오른쪽 끝에 고정해 띄우므로 배치를 가리지 않는다.
    return !(horizontal && root.scrollWidth - root.clientWidth > scrollbarWidth + 1);
  }
  if (cannotAttach(el)) return false;
  // 가로 스크롤바도 같이 띄울 수 있으면(`floats`) 숨겨도 된다.
  if (!floats && scrollbarHeightOf(el) > 0 && el.scrollWidth - el.clientWidth > scrollbarWidth + 1) return false;
  const { display, flexDirection } = getComputedStyle(el);

  // 띄운 스크롤바는 스크롤 요소의 첫 줄에 높이 0 으로 끼어든다 — 자식을 위에서 아래로 쌓는 배치에서만 자리를 안 흔든다.
  // 바깥에 띄우거나 가로와 같이 띄울 때는 흐름에서 빠져 있어(화면 고정) 배치를 가리지 않는다.
  return (
    outside ||
    floats ||
    display === "block" ||
    display === "flow-root" ||
    (display === "flex" && flexDirection === "column")
  );
}

/**
 * 모양대로 오려 내거나(clip-path) 가림막(mask)을 씌운 요소인가 — 그 상자 밖으로 나간 것은 화면에 고정해 띄운 것까지 전부 안 보인다.
 * ponytail: 상자 밖으로 나갔는지만 본다 — 상자 안쪽을 오려 내는 모양(원 등)에 걸리는지는 보지 않는다.
 */
export function isShaped(style: CSSStyleDeclaration): boolean {
  return ["clip-path", "mask-image", "-webkit-mask-image"].some((name) => {
    const value = style.getPropertyValue(name);

    return value !== "" && value !== "none";
  });
}

/** 화면 고정 상자(position: fixed)의 기준이 되는 틀인가 — 그런 틀 아래에서는 고정 상자가 화면이 아니라 그 틀을 기준으로 놓이고 그 틀에 잘린다. */
function containsFixed(style: CSSStyleDeclaration): boolean {
  const on = (name: string, off: string) => {
    const value = style.getPropertyValue(name);

    return value !== "" && value !== off;
  };

  return (
    ["transform", "translate", "scale", "rotate", "perspective", "filter", "backdrop-filter"].some((name) =>
      on(name, "none"),
    ) ||
    on("container-type", "normal") ||
    /paint|layout|strict|content/.test(style.contain) ||
    /transform|translate|scale|rotate|perspective|filter/.test(style.willChange) ||
    style.getPropertyValue("content-visibility") === "auto"
  );
}

/**
 * 화면 고정으로 `rect` 자리에 띄운 스크롤바가 `el` 의 조상에 잘려 안 보이는가.
 * 고정 상자는 기준이 되는 틀(`containsFixed`)과 그 위쪽 틀에만 잘린다 — 그 아래의 틀은 넘친 부분을 잘라도 고정 상자는 자르지 않는다.
 * 오려 내거나 가림막을 씌운 틀(`isShaped`)은 어디에 있든 자른다.
 * 세로 스크롤바는 좌우로, 가로 스크롤바는 위아래로 벗어났는지만 본다(스크롤 요소가 바깥 스크롤에 반쯤 가려진 것은 잘린 것으로 치지 않는다).
 */
export function clippedAway(el: HTMLElement, rect: DOMRect, vertical: boolean): boolean {
  const outside = (box: DOMRect) =>
    vertical
      ? rect.left < box.left - 1 || rect.right > box.right + 1
      : rect.top < box.top - 1 || rect.bottom > box.bottom + 1;
  // 스크롤 영역 자신이 오려 내거나 가림막을 씌웠으면(위아래 끝을 흐리게 하는 mask 등), 띄운 스크롤바도 그 자손이라 같이 잘린다.
  if (isShaped(getComputedStyle(el)) && outside(el.getBoundingClientRect())) return true;
  let contained = false;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (containsFixed(style)) contained = true;
    // 오려 내기·가림막은 기준 틀이 아니어도 자른다. 넘친 부분을 자르는 틀은 기준 틀이거나 그 위쪽일 때만 고정 상자를 자른다.
    // ponytail: `html`·`body` 가 화면 전체를 자르는 경우도 그 상자로 견준다 — 실제로는 안 잘리는데 잘린다고 볼 수 있다(그러면 겹치기로 간다. 놓치는 것보다 낫다).
    const clips =
      isShaped(style) ||
      (contained &&
        (style.overflowX !== "visible" ||
          style.overflowY !== "visible" ||
          /paint|strict|content/.test(style.contain) ||
          style.getPropertyValue("content-visibility") === "auto"));
    if (!clips) continue;
    if (outside(parent.getBoundingClientRect())) return true;
  }

  return false;
}

/**
 * 스크롤 요소의 가장자리에 붙여 띄울 수 있는가 — 요소를 다른 요소 옆에 붙여 두는 CSS(anchor positioning: Chrome 125·Safari 26·Firefox 147 부터)가 있어야 한다.
 * 있어도 구조에 따라 안 붙을 수 있다(스크롤 요소에 transform·filter 가 걸린 경우 등) — 그건 띄운 뒤에 자리를 재서 가린다.
 */
export function canAnchor(el: HTMLElement) {
  return (
    el !== document.body &&
    !noOutside.has(el) &&
    !cannotAttach(el) &&
    typeof CSS !== "undefined" &&
    CSS.supports("left", "anchor(--a right)")
  );
}

/** 3. 세로 스크롤바를 바깥에 띄울 수 있는가. */
export function canFloatOutside(el: HTMLElement, scrollbarWidth: number, floats = false) {
  return canAnchor(el) && canOverlay(el, scrollbarWidth, true, floats);
}
