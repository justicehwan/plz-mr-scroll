/**
 * 띄운 스크롤바 — 스크롤 요소의 shadow root 안에 만들어 두는 스크롤바 상자와, 그 상자와 내용의 스크롤 위치를 서로 맞물리는 일.
 * 어느 요소에 띄울 수 없는지·띄워 봤는데 안 붙었는지도 여기서 기억한다. 어디에 어떻게 놓을지는 `bars.ts` 가 정한다.
 */

import { DEFAULT_THUMB, GHOST_ATTRIBUTE } from "./constants.js";
import type { Bar, Ghost } from "./types.js";

/** shadow root 를 붙일 수 없는 요소(`ul`·`table` 등, 또는 다른 코드가 이미 붙인 요소) — 겹치기를 못 한다. */
const unattachable = new WeakSet<Element>();
/**
 * 스크롤바를 띄울 수 없는(= shadow root 를 붙이면 안 되거나 못 붙이는) 요소인가.
 * 웹 컴포넌트 태그(이름에 `-` 가 든 태그)에는 붙이지 않는다 — 한 번 붙인 shadow root 는 떼어 낼 수 없어,
 * 그 컴포넌트의 정의가 나중에 불러와져 자기 shadow root 를 붙일 때 예외가 나 초기화가 깨진다.
 */
export const cannotAttach = (el: Element) => unattachable.has(el) || el.localName.includes("-");
/**
 * 가장자리에 붙여 띄워 봤지만 제자리에 안 붙었거나 잘려 안 보인 스크롤 요소 — 넓히기·겹치기로 받는다.
 * 움직임 효과 중이라 한때만 안 붙는 경우가 있어, 그 효과가 끝나거나 문서 전체를 다시 훑을 때 지우고 한 번 더 해 본다.
 */
export const noOutside = new Set<Element>();
/** 스크롤 요소 → 거기 띄운 스크롤바. 장치가 내려갔다 다시 올라와도 같은 것을 쓴다(상자에 리스너를 또 붙이지 않으려고). */
export const ghosts = new WeakMap<HTMLElement, Ghost>();
let ghostCount = 0;

/** 스크롤 요소에 정해 둔 손잡이 색 — 없으면 기본 색. 배경을 투명하게 하려면 손잡이 색을 같이 줘야 한다. */
export function thumbOf(style: CSSStyleDeclaration) {
  const thumb = /^(rgba?\([^)]*\)|\S+)/.exec(style.scrollbarColor)?.[0];

  return !thumb || thumb === "auto" ? DEFAULT_THUMB : thumb;
}

/** 내용이 굴러간 자리(`at`)로 띄운 스크롤바를 맞춘다. */
export function follow(bar: Bar, at: number, vertical: boolean) {
  // 띄운 스크롤바를 따라가느라 우리가 쓴 값이면 넘긴다(끄는 중인 손잡이를 뒤로 당기지 않으려고).
  if (Math.abs(at - bar.elSet) <= 1) return;
  if (vertical) bar.bar.scrollTop = at;
  else bar.bar.scrollLeft = at;
  // 범위 끝에서 잘린 값일 수 있어, 쓴 값이 아니라 실제로 들어간 값을 적는다.
  bar.barSet = vertical ? bar.bar.scrollTop : bar.bar.scrollLeft;
  bar.elSet = NaN;
}

/** 띄운 스크롤바를 끌거나 그 위에서 굴리면 내용이 따라가게 한다. `move` 가 내용을 옮기고 실제로 옮겨진 자리를 돌려준다. */
export function lead(bar: Bar, vertical: boolean, move: (at: number) => number) {
  bar.bar.addEventListener(
    "scroll",
    () => {
      const at = vertical ? bar.bar.scrollTop : bar.bar.scrollLeft;
      // 내용을 따라가느라 우리가 쓴 값이면 넘긴다 — 되받아 쓰면 굴러가는 중인 내용을 한 프레임 전 자리로 당겨 스크롤이 덜컹거린다.
      if (Math.abs(at - bar.barSet) <= 1) return;
      bar.elSet = move(at);
      bar.barSet = NaN;
    },
    { passive: true },
  );
}

/**
 * 스크롤 요소에 띄울 스크롤바를 만든다(이미 있으면 그것). 스크롤 요소의 자식 목록은 건드리지 않으려고 shadow root 에 둔다.
 * 리스너는 여기서 한 번만 붙는다 — 장치가 다시 올라오거나 스크롤 요소가 DOM 안에서 옮겨져도 같은 것을 쓴다.
 */
export function ghostOf(el: HTMLElement): Ghost | null {
  const known = ghosts.get(el);
  if (known) return known;
  if (cannotAttach(el)) return null;
  let anchor = el.shadowRoot?.querySelector<HTMLElement>(`[${GHOST_ATTRIBUTE}]`) ?? null;
  if (!anchor) {
    let root: ShadowRoot;
    try {
      // 이미 shadow root 가 있거나(다른 코드의 것) 붙일 수 없는 태그면 여기서 예외가 난다.
      root = el.attachShadow({ mode: "open" });
    } catch {
      unattachable.add(el);

      return null;
    }
    anchor = document.createElement("div");
    anchor.setAttribute(GHOST_ATTRIBUTE, "");
    anchor.setAttribute("aria-hidden", "true");
    root.append(document.createElement("style"), anchor, document.createElement("slot"));
  }
  // 앞선 버전의 장치가 남긴 상자는 리스너가 붙어 있을 수 있다 — 버리고 새로 만든다.
  anchor.replaceChildren();
  const make = (vertical: boolean): Bar => {
    const bar = document.createElement("div");
    // 스크롤되는 요소는 탭 이동 대상이 될 수 있다 — 띄운 스크롤바는 빼 둔다.
    bar.tabIndex = -1;
    const filler = document.createElement("div");
    bar.appendChild(filler);
    anchor.appendChild(bar);
    const made: Bar = { bar, filler, barSet: NaN, elSet: NaN };
    // 부드러운 스크롤(scroll-behavior: smooth)이 걸려 있어도 바로 옮긴다 — 천천히 따라오면 다음 프레임에 손잡이가 중간 자리로 끌려가 떨린다.
    lead(made, vertical, (at) => {
      el.scrollTo({ [vertical ? "top" : "left"]: at, behavior: "instant" });

      return vertical ? el.scrollTop : el.scrollLeft;
    });
    bar.addEventListener(
      "wheel",
      (event) => {
        // 화면에 고정해 띄운 상자는 굴림이 스크롤 영역으로 이어지지 않는다 — 이 상자가 못 받는 방향의 굴림을 직접 넘긴다.
        // 확대·축소(Ctrl+휠, 트랙패드에서 두 손가락 벌리기)는 굴림이 아니다 — 브라우저에 맡긴다.
        if (event.ctrlKey) return;
        const cross = vertical ? event.deltaX : event.deltaY;
        if (cross === 0 || bar.style.position !== "fixed") return;
        // ponytail: 줄 단위 굴림은 한 줄을 16px 로 친다.
        const page = vertical ? el.clientWidth : el.clientHeight;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page : 1;
        el.scrollBy({ [vertical ? "left" : "top"]: cross * unit, behavior: "instant" });
        // 이 상자가 받을 방향의 굴림이 없으면 문서로 넘어가지 않게 막는다.
        if ((vertical ? event.deltaY : event.deltaX) === 0) event.preventDefault();
      },
      { passive: false },
    );

    return made;
  };
  ghostCount += 1;
  // 붙을 자리 이름은 요소마다 다르게 한다 — 브라우저가 shadow root 별로 이름을 나누지 않아도 서로 섞이지 않는다.
  const ghost: Ghost = { anchor, name: `--scrollbar-host-${ghostCount}`, v: make(true), h: make(false) };
  ghosts.set(el, ghost);

  return ghost;
}
