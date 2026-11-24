/**
 * 판별 — 스크롤 영역 하나를 재서 어떤 방식으로 받을지 정한다(`planFor`). 읽기만 하고, 정한 것을 쓰는 일은 `engine.ts` 가 한다.
 * 세로: 자기 여백 → 가운데 정렬 → 바깥 여백 → 겹치기. 가로: 아래 여백 → 아래 바깥 → 내용 아래쪽 위.
 */

import { isExcluded, skipsTextarea } from "./config.js";
import { CENTER_TOLERANCE, DEBUG_ATTRIBUTE, NUDGE_ATTRIBUTE, PAGE_GHOST_ATTRIBUTE } from "./constants.js";
import { canAnchor, canFloatOutside, canOverlay, isShaped } from "./float.js";
import { cannotAttach, noOutside } from "./ghost.js";
import { flowChildren, keepsBox, px, scrollbarWidthOf, scrolls } from "./measure.js";
import { hasRoomBelow, isVisibleBox, planWiden, whyNot } from "./room.js";
import type { Plan, StyleChange } from "./types.js";

const NONE: Plan = { manualWidth: 0, overlay: false, changes: [], dependsOn: [] };

/**
 * 2. 가운데 정렬 — 안쪽으로 내려가며 좌우 빈 자리가 같은 내용을 찾는다.
 * `strict` 가 아니면(= `center` 표시) 빈 자리가 있기만 하면 가운데 정렬로 본다.
 */
function planCenter(
  el: HTMLElement,
  scrollbarWidth: number,
  strict: boolean,
): (Pick<Plan, "changes" | "dependsOn"> & { overlay?: boolean }) | null {
  const style = getComputedStyle(el);
  const paddingLeft = px(style.paddingLeft);
  const box = el.getBoundingClientRect();
  let left = box.left + px(style.borderLeftWidth) + paddingLeft;
  let width = el.clientWidth - paddingLeft - px(style.paddingRight);
  let node = el;
  const dependsOn: Element[] = [];
  // 깊이를 세지 않는다 — 자식이 없거나, 안쪽 스크롤 영역·목록을 만나거나, 처리할 곳을 찾으면 끝난다.
  for (;;) {
    const children = flowChildren(node);
    if (children.length === 0) return null;
    dependsOn.push(...children);
    const widest = children.reduce((a, b) => (b.offsetWidth > a.offsetWidth ? b : a));
    // 제외한 구역은 여백도 건드리지 않는다 — 그 안으로 내려가지도 않는다.
    if (isExcluded(widest)) return null;
    const child = getComputedStyle(widest);
    // 안쪽 스크롤 영역은 자기 몫을 스스로 맞춘다 — 여기서 건드리면 둘이 같은 여백을 다툰다.
    if (scrolls(child.overflowY) || scrolls(child.overflowX)) return null;
    const rect = widest.getBoundingClientRect();
    const gapLeft = rect.left - left;
    const gapRight = left + width - rect.right;
    const slack = gapLeft + gapRight;
    if (slack >= 1) {
      if (strict && Math.abs(gapLeft - gapRight) > CENTER_TOLERANCE) return null;
      // 같은 줄에 다른 자식이 나란히 있으면 격자·가로 배치다 — 가운데 칸이 1px 넓게 재져 좌우가 같아 보일 뿐, 가운데 정렬이 아니다.
      const sharesRow = (other: HTMLElement) => {
        if (other === widest) return false;
        const box = other.getBoundingClientRect();

        return box.top < rect.bottom - 1 && box.bottom > rect.top + 1;
      };
      if (strict && children.some(sharesRow)) return null;
      if (slack >= scrollbarWidth) {
        return { changes: [{ target: el, prop: "paddingLeft", value: `${paddingLeft + scrollbarWidth}px` }], dependsOn };
      }
      // 남는 자리가 스크롤바보다 좁다 — 왼쪽은 스크롤바가 없을 때의 빈 자리만큼 주고, 그래서 좁아진 만큼은 그 자식의 오른쪽 여백에서 뺀다.
      const shrink = (scrollbarWidth - slack) / 2;
      const childPaddingRight = px(child.paddingRight);
      // 입력창은 `textarea` 옵션을 켜야 건드린다 — 다른 영역의 자식으로 있을 때도 같다.
      if (children.length === 1 && childPaddingRight >= shrink && !skipsTextarea(widest)) {
        return {
          changes: [
            { target: el, prop: "paddingLeft", value: `${paddingLeft + slack + shrink}px` },
            { target: widest, prop: "paddingRight", value: `${childPaddingRight - shrink}px` },
          ],
          dependsOn,
        };
      }

      // 자식에도 줄일 여백이 없다 — 스크롤바를 내용 위에 띄우면 스크롤바가 없을 때와 같은 자리에 놓인다.
      if (canOverlay(el, scrollbarWidth)) return { changes: [], overlay: true, dependsOn };

      // ponytail: 자식이 여럿이거나 안쪽 깊이면 남는 만큼만 준다 — 스크롤바 폭의 절반까지 밀릴 수 있다.
      return { changes: [{ target: el, prop: "paddingLeft", value: `${paddingLeft + slack}px` }], dependsOn };
    }
    // 폭을 꽉 채운 자식이 여럿이면 목록이다 — 가운데 정렬이 아니다. (`center` 표시가 있으면 가장 넓은 자식을 따라 계속 내려간다.)
    if (strict && children.length > 1) return null;
    const childPaddingRight = px(child.paddingRight);
    // 스크롤바가 없으면 최대 폭에 걸려 가운데에 놓이던 자식이면, 그때의 왼쪽 빈 자리만큼은 왼쪽 여백으로 주고 나머지만 자식 여백에서 뺀다.
    // ponytail: 최대 폭에 걸린 자식은 가운데 정렬이라고 본다 — 왼쪽 정렬이면 이 구간(화면 폭 11px 범위)에서 스크롤바 폭의 절반까지 밀린다.
    const cap = child.maxWidth.endsWith("px") ? px(child.maxWidth) : Infinity;
    const gap = Math.max(0, (width + scrollbarWidth - cap) / 2);
    if (childPaddingRight >= scrollbarWidth - gap && !skipsTextarea(widest)) {
      const changes: StyleChange[] = [
        { target: widest, prop: "paddingRight", value: `${childPaddingRight - scrollbarWidth + gap}px` },
      ];
      if (gap > 0) changes.push({ target: el, prop: "paddingLeft", value: `${paddingLeft + gap}px` });

      return { changes, dependsOn };
    }
    left = rect.left + px(child.borderLeftWidth) + px(child.paddingLeft);
    width = widest.clientWidth - px(child.paddingLeft) - childPaddingRight;
    node = widest;
  }

  return null;
}

/** 스크롤바가 떠 있는 보통 영역의 판별 — 위에서부터 맞는 첫 번째 방식. */
function planNormal(el: HTMLElement, scrollbarWidth: number, floats = false): Plan {
  const mode = el.dataset.scrollbar;
  const style = getComputedStyle(el);
  const paddingRight = px(style.paddingRight);
  if (paddingRight >= scrollbarWidth) {
    const changes: StyleChange[] = [{ target: el, prop: "paddingRight", value: `${paddingRight - scrollbarWidth}px` }];
    if (keepsBox(el, changes)) return { ...NONE, method: "padding", changes };
  }
  if (mode === "manual") return { ...NONE, method: "manual", manualWidth: scrollbarWidth };
  const center = planCenter(el, scrollbarWidth, mode !== "center");
  if (center && keepsBox(el, center.changes)) {
    return center.overlay
      ? { ...NONE, ...center, method: "overlay", why: "center-too-narrow" }
      : { ...NONE, ...center, method: "center" };
  }
  if (mode === "center") return { ...NONE, method: "none", why: "center-not-applicable" };
  // 페이지 전체는 바깥이 없다.
  const room = el === document.body ? null : planWiden(el, scrollbarWidth);
  // 옆 요소에 막혀 있으면 지금은 못 쓴다 — 그래도 그 요소들은 계속 지켜본다(좁아져 자리가 비면 바깥으로 돌아온다).
  const free = room && !room.blocked ? room : null;
  const around = { dependsOn: room?.watch ?? [], neighbors: room?.watch };
  // 바깥에 자리가 있으면 스크롤 요소는 그대로 두고 스크롤바만 그 자리에 띄운다.
  // 스크롤 요소 자신이 오려 내거나 가림막을 씌웠으면 바깥에 띄운 것은 안 보인다 — 띄워 보기 전에 뺀다.
  const shaped = isShaped(style);
  if (free && !shaped && canFloatOutside(el, scrollbarWidth, floats)) {
    return { ...NONE, ...around, method: "outside", overlay: true, offset: free.offset };
  }
  // 바깥에 못 띄운 까닭 — 진단 표시용.
  let why = whyNot;
  if (el === document.body) why = "page-has-no-outside";
  else if (room?.blocked) why = "outside-occupied";
  else if (free && cannotAttach(el)) why = "cannot-attach";
  else if (free && (shaped || noOutside.has(el))) why = "outside-clipped-or-unanchored";
  else if (free) why = "no-anchor-positioning";
  const overlays = canOverlay(el, scrollbarWidth, false, floats);
  // 띄울 수 없을 때만 넓힌다 — 눈에 보이는 상자는 넓히지 않고 다음 방식으로 넘긴다.
  // 자신이 오려 내서 바깥을 못 쓰는 영역은 띄울 수 없는 것이 아니다 — 겹칠 수 있으면 넓히지 않고 겹친다.
  if (free?.widen && !isVisibleBox(el, style) && !(shaped && overlays)) {
    return { ...NONE, ...around, method: "widen", why, changes: free.widen };
  }
  if (overlays) return { ...NONE, ...around, method: "overlay", why, overlay: true };

  // 자식을 위에서 아래로 쌓지 않는 배치는 첫 줄에 끼워 둘 수 없다 — 가장자리에 붙여 띄울 수 있으면 그렇게 겹친다.
  return canFloatOutside(el, scrollbarWidth, floats)
    ? { ...NONE, ...around, method: "overlay", why, overlay: true, pinned: true }
    : { ...NONE, ...around, method: "none", why: cannotAttach(el) ? "cannot-attach" : "cannot-overlay" };
}

/** 자식이 모두 영역보다 넓은가(영역이 `gain` 만큼 넓어져도) — 그러면 자식 폭은 영역 폭을 따르지 않아, 스크롤바가 생겨도 움직이지 않는다. */
function widerThanArea(el: HTMLElement, gain: number): boolean {
  const style = getComputedStyle(el);
  const room = el.clientWidth - px(style.paddingLeft) - px(style.paddingRight) + gain;
  const children = flowChildren(el);

  return children.length > 0 && children.every((child) => child.offsetWidth > room + 1);
}

/**
 * 스크롤바 자리를 미리 비워 둔 영역(scrollbar-gutter: stable) — 그 설정을 풀어 빈 자리를 없앤다.
 * 원래는 안 밀리던 영역이므로, **풀어도 밀리지 않을 때만** 푼다:
 *  - 스크롤바가 생겼을 때 네 가지 방식(여백 줄이기·가운데 정렬·바깥으로 넓히기·겹치기) 중 하나로 받을 수 있거나,
 *  - 내용이 영역보다 넓어(가로 스크롤) 스크롤바가 생겨도 움직이지 않을 때.
 * 그 밖에는(겹치기도 못 하는 영역) 손대지 않는다 — 풀면 원래 안 밀리던 곳이 밀린다.
 */
function planGutter(el: HTMLElement, floats: boolean): Plan {
  const author = el.style.scrollbarGutter;
  // 오른쪽 한쪽만 잡은 상태로 놓고 잰다 — 설정을 푼 뒤 스크롤바가 뜬 모습과 같다(양쪽에 잡는 both-edges 는 왼쪽 자리도 사라지므로).
  el.style.scrollbarGutter = "stable";
  const width = scrollbarWidthOf(el);
  const plan = width > 0 ? planNormal(el, width, floats) : NONE;
  const handled = plan.changes.length > 0 || plan.manualWidth > 0 || plan.overlay;
  const safe = width > 0 && (handled || widerThanArea(el, width));
  // 스크롤바가 실제로 떠 있는가 — 비워 둔 자리만 있고 스크롤바는 없을 수 있다.
  const showing = getComputedStyle(el).overflowY === "scroll" || el.scrollHeight > el.clientHeight + 1;
  el.style.scrollbarGutter = author;
  if (!safe) return { ...NONE, method: "none", why: "gutter-kept" };
  const release: StyleChange = { target: el, prop: "scrollbarGutter", value: "auto" };

  // 잰 폭은 늘 같이 넘긴다 — 양쪽에 자리를 비워 둔 영역은 바깥에서 잰 값이 두 배다.
  return showing && handled
    ? { ...plan, width, changes: [release, ...plan.changes] }
    : { ...NONE, width, method: "none", why: "gutter-released", changes: [release] };
}

/** 세로 스크롤바의 판별. `floats` — 가로 스크롤바도 띄울 수 있다(그러면 가로로 넘쳐도 원래 스크롤바를 숨길 수 있다). */
function planVertical(el: HTMLElement, scrollbarWidth: number, floats: boolean): Plan {
  if (scrollbarWidth === 0) return NONE;
  const page = el === document.body;
  // 이 속성을 모르는 브라우저에서는 값이 없다. 페이지 전체의 설정은 `html` 에 걸린다.
  const gutter = getComputedStyle(page ? document.documentElement : el).scrollbarGutter;
  if (!String(gutter).includes("stable")) return planNormal(el, scrollbarWidth, floats);

  // 페이지 전체에 걸린 설정은 그대로 둔다.
  return page ? NONE : planGutter(el, floats);
}

/**
 * 세로(`scrollbarWidth`)와 가로(`measuredHeight`)를 따로 판별해 합친다.
 * 가로: 1. 아래 여백이 스크롤바보다 넓으면 줄인다 → 2. 바깥 아래에 자리가 있으면 거기 띄운다 → 3. 내용 아래쪽 위에 겹친다.
 * `planGutter` 가 잠깐 style 을 썼다 되돌리는 것 말고는 읽기만 한다.
 */
export function planFor(el: HTMLElement, scrollbarWidth: number, measuredHeight: number): Plan {
  const plan = planArea(el, scrollbarWidth, measuredHeight);
  // 페이지 전체에 창 스크롤바가 그대로 남는 방식이면(띄우지 않는다) 화면에 고정한 요소의 몫도 같이 정한다.
  const stays = el === document.body && scrollbarWidth > 0 && !plan.overlay && !plan.hidden;
  if (!stays || plan.why === "off" || plan.why === "excluded") return plan;
  const fixed = planFixed(scrollbarWidth, plan.changes);

  return { ...plan, changes: [...plan.changes, ...fixed.changes], dependsOn: [...plan.dependsOn, ...fixed.dependsOn] };
}

/** 화면 폭을 따라 자리가 정해질 수 있는 요소인가 — 화면에 고정했거나(`fixed`), 페이지 자체를 기준으로 겹쳐 띄웠다(`body` 기준의 `absolute`). */
export function followsViewport(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  // 자리 잡는 방식부터 본다 — 크기와 기준 요소(`offsetWidth`·`offsetParent`)는 읽을 때 레이아웃을 다시 계산하게 하므로, 대부분의 요소가 여기서 걸러진 뒤에만 읽는다.
  const { position } = getComputedStyle(el);
  if (position !== "fixed" && position !== "absolute") return false;
  if (el.hasAttribute(PAGE_GHOST_ATTRIBUTE) || el.hasAttribute(DEBUG_ATTRIBUTE) || isExcluded(el)) return false;
  if (el.offsetWidth === 0) return false;

  return position === "fixed" || el.offsetParent === document.body;
}

/**
 * 창 스크롤바가 떠 있는 동안, 화면 폭을 따라 자리가 정해지는 요소들의 몫 — 화면에 고정한 요소(`position: fixed`)와 페이지 구석에 붙여 둔 요소(`body` 기준의 `absolute`).
 * 창 스크롤바를 잠깐 숨겨 「스크롤바가 없을 때」의 자리를 재고, 지금 자리와의 차이만큼 맞춘다(어떻게 붙여 놨는지 추측하지 않는다):
 *  - 폭이 달라지는 요소(화면 폭을 꽉 채운 헤더) — 스크롤 영역과 같은 뜻으로 자기 오른쪽 여백을 줄이거나(1), 가운데 정렬이면 왼쪽을 준다(2).
 *  - 자리만 달라지는 요소(오른쪽에 붙인 버튼, 가운데 띄운 알림) — 그 차이만큼 옮긴다(`translate`).
 * 옮기면 창 스크롤바 뒤로 들어가 가려지는 요소, 줄일 여백이 없는 요소는 그대로 둔다 — 가리는 것보다 밀리는 쪽이 낫다.
 */
function planFixed(scrollbarWidth: number, pageChanges: StyleChange[]): Pick<Plan, "changes" | "dependsOn"> {
  const root = document.documentElement;
  // ponytail: 문서의 요소를 전부 훑어 계산된 스타일을 읽는다 — 무거우면 찾은 것을 기억해 두고 요소가 붙고 떨어질 때만 다시 찾는다.
  const found = [...document.body.querySelectorAll<HTMLElement>("*")].filter(followsViewport);
  if (found.length === 0) return { changes: [], dependsOn: [] };
  const edge = root.clientWidth;
  // 「지금 자리」는 페이지 전체의 판별이 정한 변경을 쓴 상태로 잰다 — 본문을 따라 놓이는 요소(자리를 주지 않은 absolute)는 본문과 같이 제자리로 가므로 또 옮기면 안 된다.
  // 인라인 style 은 통째로 되돌린다(`keepsBox` 와 같다).
  const targets = [...new Set(pageChanges.map(({ target }) => target))];
  const saved = targets.map((target) => target.getAttribute("style"));
  for (const { target, prop, value } of pageChanges) target.style[prop] = value;
  const now = found.map((el) => el.getBoundingClientRect());
  targets.forEach((target, index) => {
    const style = saved[index];
    if (style === null) target.removeAttribute("style");
    else target.setAttribute("style", style);
  });
  // 창 스크롤바는 overflow 를 잠깐 막아 숨긴다(`keepsBox` 와 같다) — 스크롤바만 숨기는 표시는 그 자리에서 바로 반영하지 않는 엔진(WebKit)이 있다. 스크롤 위치는 그대로다.
  root.setAttribute(NUDGE_ATTRIBUTE, "");
  const bare = found.map((el) => el.getBoundingClientRect());
  root.removeAttribute(NUDGE_ATTRIBUTE);
  const changes: StyleChange[] = [];
  const dependsOn: Element[] = [];
  found.forEach((el, i) => {
    const moved = bare[i].left - now[i].left;
    const grown = bare[i].width - now[i].width;
    if (Math.abs(moved) < 0.5 && Math.abs(grown) < 0.5) return;
    dependsOn.push(el);
    const style = getComputedStyle(el);
    const paddingRight = px(style.paddingRight);
    if (Math.abs(grown) >= 0.5) {
      if (paddingRight >= scrollbarWidth) {
        changes.push({ target: el, prop: "paddingRight", value: `${paddingRight - scrollbarWidth}px` });

        return;
      }
      const center = planCenter(el, scrollbarWidth, true);
      if (!center || center.overlay) return;
      changes.push(...center.changes);
      dependsOn.push(...center.dependsOn);

      return;
    }
    // 이미 `translate` 를 쓰는 요소는 건드리지 않는다. 옮긴 요소는 그 안의 고정 요소에게 기준 틀이 되므로, 고정 요소를 품은 것도 뺀다.
    if (style.translate !== "none" || found.some((other) => other !== el && el.contains(other))) return;
    // 옮기면 창 스크롤바 뒤로 들어가는 만큼은 그 요소의 오른쪽 여백이어야 한다.
    if (now[i].right + moved - edge > paddingRight + 0.5) return;
    changes.push({ target: el, prop: "translate", value: `${moved}px 0px` });
  });

  return { changes, dependsOn };
}

function planArea(el: HTMLElement, scrollbarWidth: number, measuredHeight: number): Plan {
  const mode = el.dataset.scrollbar;
  if (mode === "off") return { ...NONE, why: "off" };
  // 찾은 뒤에 제외 선택자에 걸리게 된 영역(class 가 바뀜, 설정이 바뀜)도 여기서 걸러 손대지 않는다.
  // 보던 입력창도 `textarea` 옵션이 꺼지면 같은 길로 손을 뗀다.
  if (isExcluded(el) || skipsTextarea(el)) return { ...NONE, why: "excluded" };
  // 굴릴 것이 없는데 스크롤바가 재진다 — 늘 띄워 두는 설정(overflow: scroll)의 빈 띠다. 어느 방식으로 받을 구조든 띠만 숨긴다
  // (여백을 줄여 받는 구조도 마찬가지다 — 띠를 숨기면 내용 폭이 넘칠 때와 같아진다).
  // 서로 때문에만 생긴 넘침(가로 스크롤바 높이만큼의 세로 넘침, 세로 스크롤바 폭만큼의 가로 넘침)은 넘침으로 치지 않는다.
  // `manual` 은 원래 스크롤바를 그대로 두는 설정이고, 비워 둔 스크롤바 자리는 `planGutter` 가 따로 본다.
  const box = el === document.body ? document.documentElement : el;
  const overflows =
    box.scrollHeight - box.clientHeight > measuredHeight + 1 || box.scrollWidth - box.clientWidth > scrollbarWidth + 1;
  // 입력창은 뺀다 — 글이 바뀌어 넘치게 돼도(값만 바뀐다) 알아챌 길이 없어, 숨긴 스크롤바가 그대로 남는다.
  if (
    !overflows &&
    (scrollbarWidth > 0 || measuredHeight > 0) &&
    mode !== "manual" &&
    !(el instanceof HTMLTextAreaElement) &&
    !String(getComputedStyle(box).scrollbarGutter).includes("stable")
  ) {
    return { ...NONE, hidden: true, method: "none", why: "nothing-to-scroll" };
  }
  // 가로 넘침이 세로 스크롤바 때문에만 생겼으면(넘친 폭이 세로 스크롤바 폭 이하) 가로 스크롤바는 없는 것으로 본다 — 세로를 받으면 같이 사라진다.
  // 넘치지 않는데 늘 떠 있는 가로 스크롤바(overflow-x: scroll)도 같다 — 생겼다 사라지지 않으니 손대지 않는다.
  // `manual` 은 원래 스크롤바를 그대로 두는 설정이다 — 가로도 띄우지 않고 높이만 내려 준다.
  // 세로 스크롤바를 장치가 받지 않으니 그 때문에 생긴 가로 스크롤바도 실제로 남는다 — 잰 높이를 그대로 쓴다.
  const manual = mode === "manual";
  const scrollbarHeight =
    manual || (measuredHeight > 0 && el.scrollWidth - el.clientWidth > scrollbarWidth + 1) ? measuredHeight : 0;
  if (scrollbarWidth === 0 && scrollbarHeight === 0) return NONE;
  // ponytail: 가로는 가장자리에 붙여 띄울 수 있을 때만 띄운다 — 못 하는 브라우저·구조에서는 원래 가로 스크롤바를 그대로 둔다.
  const floats = !manual && scrollbarHeight > 0 && canAnchor(el);
  const vertical = planVertical(el, scrollbarWidth, floats);
  if (scrollbarHeight === 0) return vertical;
  const style = getComputedStyle(el);
  const paddingBottom = px(style.paddingBottom);
  // 세로가 원래 스크롤바를 쓰는 방식이면 가로도 원래 스크롤바로 아래 여백 안에 받는다.
  if (paddingBottom >= scrollbarHeight && !vertical.overlay) {
    const change: StyleChange = { target: el, prop: "paddingBottom", value: `${paddingBottom - scrollbarHeight}px` };
    if (keepsBox(el, [change])) return { ...vertical, methodX: "padding", changes: [...vertical.changes, change] };
  }
  if (manual) return { ...vertical, methodX: "manual", manualHeight: scrollbarHeight };
  if (!floats) return vertical;
  const released = vertical.changes.filter(({ prop }) => prop === "scrollbarGutter");
  // 스크롤바 자리를 비워 뒀는데 풀 수 없는 영역(풀면 밀리거나, 세로는 스크롤되지 않는 영역)은 원래 스크롤바를 숨기면
  // 비워 둔 자리가 같이 사라져 내용이 움직인다 — 가로도 원래 스크롤바 그대로 둔다.
  if (String(style.scrollbarGutter).includes("stable") && released.length === 0) return vertical;
  // 여기부터는 원래 스크롤바를 둘 다 숨긴다. 세로가 여백 줄이기·가운데 정렬이었으면 여백은 그대로 두고 안쪽 오른쪽 끝에 띄운다 —
  // 스크롤바와 내용의 자리는 같다(사용자 결정: 이 경우 바깥을 다시 찾지 않는다).
  // 아래 여백이 넉넉하면 가로도 그 여백 위에 띄운다. 그 여백은 끝까지 굴려야 보이는 자리라, 그 전에는 내용 맨 아래 줄 위에 놓인다.
  const below = paddingBottom < scrollbarHeight && !isShaped(style) ? hasRoomBelow(el, scrollbarHeight) : null;
  // 세로 스크롤바는 실제로 세로로 넘칠 때만 띄운다 — 가로 스크롤바 때문에만 생겼거나 비워 둔 자리뿐이면 숨기는 것으로 끝난다.
  const tall = scrollbarWidth > 0 && el.scrollHeight - el.clientHeight > scrollbarHeight + 1;

  const under = below && !below.blocked;

  return {
    ...NONE,
    method: !tall ? "none" : vertical.offset !== undefined ? "outside" : "overlay",
    methodX: under ? "outside" : "overlay",
    why: vertical.why,
    overlay: tall,
    offset: vertical.offset,
    width: vertical.width,
    // 비워 둔 스크롤바 자리를 푸는 것만 남긴다.
    changes: released,
    // 세로가 옆 요소에 막혀 바깥을 못 쓴 경우에도 그 요소들을 계속 지켜본다(비면 바깥으로 돌아온다).
    dependsOn: [...vertical.dependsOn, ...(below?.watch ?? [])],
    neighbors: [...(vertical.neighbors ?? []), ...(below?.watch ?? [])],
    bottom: below && !below.blocked ? "outside" : "inside",
    bottomOffset: below && !below.blocked ? below.offset : 0,
    height: scrollbarHeight,
  };
}
