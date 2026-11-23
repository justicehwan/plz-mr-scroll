/**
 * 스크롤바 전역 처리의 본체 — `installMrScroll()` 로 한 번 설치하면, 화면의 세로 스크롤 영역마다 스크롤바가 생겨도 내용이 밀리지 않게 맞춘다.
 * 스크롤바 자리를 미리 잡지 않고, 브라우저 기본 스크롤바를 그대로 쓴다. 화면 코드에는 아무것도 붙이지 않아도 된다.
 *
 * 스크롤바가 뜬 영역마다 위에서부터 맞는 첫 번째 것을 쓴다:
 *  1. 자기 여백 — 스크롤 요소의 오른쪽 여백이 스크롤바보다 넓으면 그 여백을 줄인다.
 *  2. 가운데 정렬 — 안쪽 내용의 좌우 빈 자리가 같으면 왼쪽에도 같은 폭을 준다. 안쪽 래퍼 하나가 폭을 꽉 채우면 그 래퍼의 여백을 줄인다.
 *  3. 바깥 여백 — 스크롤 요소가 조상의 오른쪽 여백에 맞닿아 있거나 오른쪽 바깥이 빈 자리면, 스크롤 요소는 그대로 두고
 *     스크롤바만 그 자리에 띄운다(원래 스크롤바는 숨긴다). 띄울 수 없는 브라우저·구조에서는 그쪽으로 스크롤바 폭만큼 넓힌다 —
 *     스크롤 요소 자신이 눈에 보이는 상자(테두리·그림자·바탕과 다른 배경색)면 넓히지 않는다.
 *  4. 겹치기 — 줄일 여백도 넓힐 자리도 없으면 원래 스크롤바를 숨기고, 같은 모양의 스크롤바를 내용 위에 띄워 스크롤 위치를 맞물린다.
 * 가로 스크롤바도 같은 뜻으로, 세로와 따로 판별한다: 아래 여백을 줄이거나 → 바깥 아래에 띄우거나 → 내용 아래쪽 위에 겹친다.
 * 원래 스크롤바는 한쪽만 숨길 수 없다 — 한쪽이라도 띄우면 둘 다 숨기고 둘 다 띄운 스크롤바로 그린다(자리는 축마다 따로다).
 * 페이지 전체(브라우저 창) 스크롤도 같은 순서로 본다 — `body` 를 스크롤 영역으로 치고, 겹치기는 화면 오른쪽 끝에 고정해 띄운다.
 * 받는 설정은 `MrScrollOptions` 에 있다(바깥에 띄울 거리의 한도 · 제외 선택자 · 진단 표시 · 브라우저 알림 가로채기).
 * React 에 기대지 않는다 — React 에서는 이것을 감싼 `MrScroll` 컴포넌트를 쓴다.
 * `data-scrollbar` 로 자동 판별을 바꿀 수 있다: `off`(건드리지 않음) · `center`(좌우가 달라도 가운데 정렬로 봄) ·
 * `manual`(자동 판별을 하지 않고 원래 스크롤바를 그대로 둔 채, 세로 폭을 `--sbw`·가로 높이를 `--sbh` 로 내려 준다 —
 * 화면 코드가 `calc(여백 - var(--sbw, 0px))` 처럼 직접 받는다).
 */

const LOOP_ERROR = "ResizeObserver loop completed with undelivered notifications";
/** 좌우 빈 자리를 같다고 보는 허용 오차(px). */
const CENTER_TOLERANCE = 2;
const UNDO_ATTRIBUTE = "data-scrollbar-undo";
/** 겹치기 중인 스크롤 요소에 붙는다 — 원래 스크롤바를 숨긴다. */
const OVERLAY_ATTRIBUTE = "data-scrollbar-overlay";
/** 내용 위에 띄운 스크롤바(스크롤 요소의 shadow root 안에 있다). */
const GHOST_ATTRIBUTE = "data-scrollbar-ghost";
/** 페이지 전체(브라우저 창) 스크롤에 띄운 스크롤바 — `body` 끝에 붙이고 화면 오른쪽 끝에 고정한다. */
const PAGE_GHOST_ATTRIBUTE = "data-scrollbar-ghost-page";
/** 잠깐 붙였다 떼어 스크롤바를 다시 그리게 한다 — `sync` 의 「되살린 스크롤바가 안 그려진 경우」 참고. */
const NUDGE_ATTRIBUTE = "data-scrollbar-nudge";
/** 진단 표시(`debug`) — 스크롤 영역마다 세로·가로에 고른 방식과, 그 방식이 된 이유를 적는다. */
const METHOD_ATTRIBUTE = "data-scrollbar-method";
const METHOD_X_ATTRIBUTE = "data-scrollbar-method-x";
const WHY_ATTRIBUTE = "data-scrollbar-why";
/** 진단 표시를 그리는 층 — 화면 맨 위에 따로 띄운다(`body` 끝, shadow root 안). 스크롤 영역에는 아무것도 끼워 넣지 않는다. */
const DEBUG_ATTRIBUTE = "data-scrollbar-debug";
/**
 * 진단 층의 모양. 영역마다 아래를 겹쳐 그린다(색은 방식별):
 *  - area: 영역의 테두리와 옅은 칠 · tag: 방식·스크롤바 굵기·바꾼 값·까닭을 적은 딱지
 *  - bar: 스크롤바가 놓인 자리 · pad: 줄이거나 더한 뒤의 여백(빗금) · content: 스크롤바가 없을 때의 내용 자리(점선)
 */
const DEBUG_CSS = [
  ":host{position:fixed;inset:0;z-index:2147483647;pointer-events:none}",
  "div{position:fixed;box-sizing:border-box}",
  ".area{border:3px solid var(--c);background:var(--f)}",
  ".bar{background:var(--b)}",
  ".pad{background:repeating-linear-gradient(45deg,var(--b) 0 2px,transparent 2px 6px)}",
  ".content{border:1px dashed var(--c)}",
  ".tag{padding:0 6px;background:var(--c);color:#fff;font:600 11px/1.6 ui-monospace,Menlo,monospace;white-space:nowrap}",
  ".padding{--c:#16a34a;--f:rgba(22,163,74,.1);--b:rgba(22,163,74,.6)}",
  ".center{--c:#2563eb;--f:rgba(37,99,235,.1);--b:rgba(37,99,235,.6)}",
  ".outside{--c:#9333ea;--f:rgba(147,51,234,.1);--b:rgba(147,51,234,.6)}",
  ".overlay{--c:#ea580c;--f:rgba(234,88,12,.1);--b:rgba(234,88,12,.6)}",
  ".widen{--c:#ca8a04;--f:rgba(202,138,4,.1);--b:rgba(202,138,4,.6)}",
  ".manual{--c:#0f172a;--f:rgba(15,23,42,.08);--b:rgba(15,23,42,.5)}",
  ".none{--c:#64748b;--f:rgba(100,116,139,.08);--b:rgba(100,116,139,.5)}",
  ".none.area{border-style:dashed}",
  // 페이지 전체는 화면을 다 덮는다 — 칠하지 않고 테두리와 딱지만 그린다.
  ".page.area{background:none}",
].join("");
/** 진단 층에 그릴 조각 하나 — 화면 기준 자리와 모양 이름, 딱지면 글자. */
type Shape = { kind: string; x: number; y: number; w: number; h: number; text?: string };
/** 진단 표시용 — 그 영역에 쓴 스크롤바 굵기·띄운 자리와, 바꾼 스타일의 전·후 값. */
type DebugInfo = {
  width: number;
  height: number;
  offset?: number;
  bottomOffset?: number;
  changes: { target: HTMLElement; prop: StyleProp; from: string; to: string }[];
};
/** 진단 층에 그리지 않는 까닭 — 손댈 일이 없었던 영역이다(스크롤바가 없음, 꺼 둠, 제외함). 다 그리면 화면이 표시로 덮인다. */
const QUIET = new Set(["", "no-scrollbar", "off", "excluded"]);
const OVERLAY_CSS = `[${OVERLAY_ATTRIBUTE}]{scrollbar-width:none!important}[${OVERLAY_ATTRIBUTE}]::-webkit-scrollbar{display:none!important}[${NUDGE_ATTRIBUTE}]{overflow:hidden!important}`;
/** 스크롤 요소에 손잡이 색이 정해져 있지 않을 때 쓰는 색 — 배경을 투명하게 하려면 손잡이 색을 같이 줘야 한다. */
const DEFAULT_THUMB = "rgba(0, 0, 0, 0.35)";

/** 우리가 바꾸는 인라인 style 속성 — 되돌릴 때도 이 목록에 있는 것만 쓴다. */
const STYLE_PROPS = ["paddingRight", "paddingLeft", "paddingBottom", "marginRight", "width", "scrollbarGutter"] as const;
type StyleProp = (typeof STYLE_PROPS)[number];
type StyleChange = { target: HTMLElement; prop: StyleProp; value: string };
/** 진단 표시에 적는 방식 이름. */
type Method = "padding" | "center" | "outside" | "overlay" | "widen" | "manual" | "none";
type Plan = {
  /** 진단 표시용 — 세로에 고른 방식, 가로에 고른 방식, 그 방식이 된 이유(더 앞선 방식을 못 쓴 까닭). */
  method?: Method;
  methodX?: Method;
  why?: string;
  /** `manual` 표시가 있을 때 `--sbw` 로 내려 줄 세로 스크롤바 폭 — 화면 코드가 직접 받는다. */
  manualWidth: number;
  /** `manual` 표시가 있을 때 `--sbh` 로 내려 줄 가로 스크롤바 높이. */
  manualHeight?: number;
  /** 세로 스크롤바를 띄운다 — 원래 스크롤바를 숨기고 내용 위에(겹치기), `offset` 이 있으면 오른쪽 바깥에 띄운다. */
  overlay: boolean;
  /** 있으면 바깥에 띄운다 — 스크롤 요소의 오른쪽 끝에서 떨어뜨릴 거리(사이에 낀 틀의 테두리 두께, 보통 0). */
  offset?: number;
  /** 겹칠 때 첫 줄에 끼워 두지 않고 안쪽 오른쪽 끝에 붙여 띄운다 — 자식을 위에서 아래로 쌓지 않는 배치(격자·가로 배치·거꾸로 쌓기)에서. */
  pinned?: boolean;
  changes: StyleChange[];
  /** 이 계획이 기대는 요소 — 붙고 떨어지거나 class·글자가 바뀌면 다시 계산한다. */
  dependsOn: Element[];
  /** 그중 크기도 지켜볼 요소 — 빈 자리에 띄웠을 때 그 자리 둘레의 요소들. 넓어져서 빈 자리를 채울 수 있다. */
  neighbors?: Element[];
  /** 스크롤바 자리를 비워 둔 영역에서 한쪽 폭으로 다시 잰 스크롤바 폭 — 띄울 때 이 값을 쓴다(양쪽에 비워 둔 영역은 바깥에서 잰 값이 두 배다). */
  width?: number;
  /** 가로 스크롤바를 띄우는 자리 — 내용 아래쪽 위(`inside`)나 스크롤 요소의 아래 바깥(`outside`). 없으면 원래 가로 스크롤바를 그대로 둔다. */
  bottom?: "inside" | "outside";
  /** 굴릴 것이 없다 — 원래 스크롤바(늘 띄워 두는 설정의 빈 띠)만 숨기고 아무것도 띄우지 않는다. */
  hidden?: boolean;
  /** 가로 스크롤바 높이 — `bottom` 이 있을 때. */
  height?: number;
  /** 아래 바깥에 띄울 때 스크롤 요소의 아래 끝에서 더 떨어뜨릴 거리 — 사이에 낀 틀의 테두리 두께. */
  bottomOffset?: number;
};
/**
 * 띄운 스크롤바 하나 — 스크롤바가 뜨는 상자와, 그 상자를 스크롤되게 하는 속.
 * `barSet`·`elSet` 은 우리가 맞춰 쓴 마지막 스크롤 위치다 — 그 값으로 난 이벤트는 되받아 쓰지 않는다.
 */
type Bar = { bar: HTMLElement; filler: HTMLElement; barSet: number; elSet: number };
/** 스크롤 요소에 띄운 스크롤바 — 자리를 잡는 틀, 그 요소를 「붙을 자리」로 부르는 이름, 세로용·가로용 상자. */
type Ghost = { anchor: HTMLElement; name: string; v: Bar; h: Bar };
type Applied = {
  target: HTMLElement;
  prop: StyleProp;
  author: string;
  applied: string;
  /** 바꾸기 전에 실제로 적용돼 있던 값 — 진단 표시를 켰을 때만 읽는다. */
  from: string;
};

/** shadow root 를 붙일 수 없는 요소(`ul`·`table` 등, 또는 다른 코드가 이미 붙인 요소) — 겹치기를 못 한다. */
const unattachable = new WeakSet<Element>();
/**
 * 스크롤바를 띄울 수 없는(= shadow root 를 붙이면 안 되거나 못 붙이는) 요소인가.
 * 웹 컴포넌트 태그(이름에 `-` 가 든 태그)에는 붙이지 않는다 — 한 번 붙인 shadow root 는 떼어 낼 수 없어,
 * 그 컴포넌트의 정의가 나중에 불러와져 자기 shadow root 를 붙일 때 예외가 나 초기화가 깨진다.
 */
const cannotAttach = (el: Element) => unattachable.has(el) || el.localName.includes("-");
/**
 * 가장자리에 붙여 띄워 봤지만 제자리에 안 붙었거나 잘려 안 보인 스크롤 요소 — 넓히기·겹치기로 받는다.
 * 움직임 효과 중이라 한때만 안 붙는 경우가 있어, 그 효과가 끝나거나 문서 전체를 다시 훑을 때 지우고 한 번 더 해 본다.
 */
let noOutside = new Set<Element>();
/** 스크롤 요소 → 거기 띄운 스크롤바. 장치가 내려갔다 다시 올라와도 같은 것을 쓴다(상자에 리스너를 또 붙이지 않으려고). */
const ghosts = new WeakMap<HTMLElement, Ghost>();
let ghostCount = 0;
const NONE: Plan = { manualWidth: 0, overlay: false, changes: [], dependsOn: [] };
/** 설치할 때 받는 설정 — 주지 않은 것은 기본값을 쓴다. */
export type MrScrollOptions = {
  /**
   * 바깥에 띄울 때 스크롤 영역의 끝에서 떨어뜨려도 되는 거리의 한도(px). 기본 12.
   * 영역을 여백 없이 감싼 틀들의 테두리를 건너 바깥 여백에 띄우면, 건넌 테두리 두께의 합만큼 스크롤바가 영역에서 떨어진다.
   * 그 거리가 이 값을 넘으면 바깥에 띄우지 않고 내용 위에 겹친다. 제한을 없애려면 `Infinity` 를 준다.
   * 음수나 숫자가 아닌 값은 기본값으로 친다. 맞닿음을 1px 오차로 보므로 한도 근처에서는 1~2px 어긋날 수 있다.
   */
  stayClose?: number;
  /**
   * 진단 표시. 켜면 스크롤 영역마다 고른 방식을 `data-scrollbar-method`(세로)·`data-scrollbar-method-x`(가로)에,
   * 그 방식이 된 까닭을 `data-scrollbar-why` 에 적고, 화면 위에 따로 띄운 층에 영역마다 방식별 색의 테두리와 딱지(방식·까닭)를 그린다.
   * 스크롤 영역에는 아무것도 끼워 넣지 않고, 판별 결과도 바꾸지 않는다. 손댈 일이 없었던 영역(스크롤바 없음·꺼 둠·제외)은 그리지 않는다.
   */
  debug?: boolean;
  /**
   * 제외 선택자. 이 CSS 선택자에 걸린 요소와 그 아래의 스크롤 영역은 찾지도 건드리지도 않는다 —
   * 마크업에 `data-scrollbar="off"` 를 붙일 수 없는 외부 위젯을 빼는 데 쓴다. 쉼표로 여럿을 줄 수 있다.
   */
  exclude?: string;
  /**
   * 브라우저가 남기는 「ResizeObserver loop」 알림을 가로챌지. 기본 true.
   * 스크롤바가 생긴 것을 알아챈 그 자리에서 여백을 고치기 때문에 브라우저가 이 알림을 자주 남긴다(동작에는 문제가 없다).
   * 가로채면 이 장치보다 나중에 등록된 오류 리스너(오류 수집 도구 등)에 닿지 않는다. 다른 코드가 낸 같은 알림도 같이 가려지므로,
   * 그 알림을 직접 보고 싶으면 false 를 준다.
   */
  quiet?: boolean;
  /**
   * 입력창(`textarea`)도 볼지. 기본 false — 입력창은 높이를 내용에 맞추는 코드와 얽히기 쉬워 기본으로는 건드리지 않는다
   * (스크롤 영역으로도, 다른 스크롤 영역을 꽉 채운 자식으로도).
   * 켜면 다른 스크롤 영역과 같은 순서로 판별한다. 다만 입력창에는 스크롤바를 띄울 수 없어(shadow root 를 못 붙인다)
   * 「바깥 여백」「겹치기」는 안 된다 — 오른쪽 여백이 스크롤바 폭 이상이면 그 여백을 줄이고, `data-scrollbar="manual"` 이면 폭만 내려 준다.
   * 여백을 줄여도 상자 크기를 못 지키는 입력창(폭을 `box-sizing: content-box` 로 못박은 것 — 브라우저 기본값)은 그대로 둔다.
   * 늘 띄워 두는 스크롤바(`overflow: scroll`)의 빈 띠는 입력창에서는 숨기지 않는다.
   */
  textarea?: boolean;
};
type Config = Required<MrScrollOptions>;
const DEFAULTS: Config = { stayClose: 12, debug: false, exclude: "", quiet: true, textarea: false };
let config = DEFAULTS;
/** 제외 선택자(`exclude`)에 걸린 요소이거나 그 아래에 있는가. */
const isExcluded = (el: Element) => config.exclude !== "" && el.closest(config.exclude) !== null;
/** 입력창은 `textarea` 옵션을 켰을 때만 본다. */
const skipsTextarea = (el: Element) => !config.textarea && el instanceof HTMLTextAreaElement;
/** `planWiden` 이 바깥 자리를 못 찾았을 때 그 까닭 — 진단 표시에 쓴다. 판별 한 번 안에서만 읽는다. */
let whyNot = "";
const no = (why: string) => {
  whyNot = why;

  return null;
};
const px = (value: string) => parseFloat(value) || 0;
const scrolls = (overflowY: string) => overflowY === "auto" || overflowY === "scroll";

/** `::-webkit-scrollbar` 로 스크롤바를 꾸미는 엔진인가(Chromium·WebKit). */
const WEBKIT_BARS = typeof CSS !== "undefined" && CSS.supports("selector(::-webkit-scrollbar)");

/**
 * 숨겼다 되살린 원래 스크롤바가 제 모습이 아닌가 — 아예 안 재지거나(0), `::-webkit-scrollbar` 로 꾸민 굵기와 다르게 재진다.
 * 표준 속성(`scrollbar-width`·`scrollbar-color`)을 준 영역은 꾸민 굵기가 쓰이지 않으니 비교하지 않는다.
 */
function revivedWrong(el: HTMLElement): boolean {
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
function keepsBox(scroller: HTMLElement, changes: StyleChange[]): boolean {
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
function isScroller(el: Element): el is HTMLElement {
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
const overflowOf = (style: string | null) =>
  style?.match(/(?:^|;)\s*overflow(?:-[xy])?\s*:[^;]*/g)?.join(";") ?? "";
const isStyleSheet = (node: Node) =>
  node instanceof HTMLStyleElement ||
  (node instanceof HTMLLinkElement && node.relList.contains("stylesheet"));

/** 크기를 지켜볼 자식 — 상자가 없는 자식(display: contents)은 크기 감시가 안 불려 그 자식들을 본다. */
const boxChildren = (node: Element): Element[] =>
  [...node.children].flatMap((child) =>
    getComputedStyle(child).display === "contents" ? boxChildren(child) : [child],
  );

/** 지금 떠 있는 세로 스크롤바 폭 — 스크롤이 없거나 겹쳐 뜨는 스크롤바면 0. */
function scrollbarWidthOf(el: HTMLElement) {
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
function scrollbarHeightOf(el: HTMLElement) {
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
function flowChildren(node: HTMLElement) {
  const children: HTMLElement[] = [];
  for (const child of node.children) {
    if (!(child instanceof HTMLElement) || child.offsetWidth === 0) continue;
    const { position } = getComputedStyle(child);
    if (position !== "absolute" && position !== "fixed") children.push(child);
  }

  return children;
}

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
function isVisibleBox(el: HTMLElement, style: CSSStyleDeclaration): boolean {
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
function planWiden(
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

/** 4. 겹치기 — 세로를 숨긴 뒤에도 남는 가로 넘침이 없고, 자식을 위에서 아래로 쌓는 배치일 때만 쓴다. */
function canOverlay(el: HTMLElement, scrollbarWidth: number, outside = false, floats = false) {
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
function isShaped(style: CSSStyleDeclaration): boolean {
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
function clippedAway(el: HTMLElement, rect: DOMRect, vertical: boolean): boolean {
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
function canAnchor(el: HTMLElement) {
  return (
    el !== document.body &&
    !noOutside.has(el) &&
    !cannotAttach(el) &&
    typeof CSS !== "undefined" &&
    CSS.supports("left", "anchor(--a right)")
  );
}

/** 3. 세로 스크롤바를 바깥에 띄울 수 있는가. */
function canFloatOutside(el: HTMLElement, scrollbarWidth: number, floats = false) {
  return canAnchor(el) && canOverlay(el, scrollbarWidth, true, floats);
}

/**
 * 바깥 아래에 가로 스크롤바(`height`)가 들어갈 자리가 있는가 — `planWiden` 의 오른쪽 판정을 아래쪽으로 옮긴 것.
 * 스크롤 요소의 아래 끝이 조상의 아래 여백에 맞닿아 있거나, 아래 바깥이 빈 자리일 때다.
 * 자리가 있으면 스크롤 요소의 아래 끝에서 더 떨어뜨릴 거리(사이에 낀 틀의 테두리 두께)와 지켜볼 요소를, 없으면 null 을 돌려준다.
 * 자리는 있는데 옆 요소가 차지하고 있으면 `blocked` 와 지켜볼 요소를 돌려준다.
 */
function hasRoomBelow(
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
function planFor(el: HTMLElement, scrollbarWidth: number, measuredHeight: number): Plan {
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

/** 스크롤 요소에 정해 둔 손잡이 색 — 없으면 기본 색. 배경을 투명하게 하려면 손잡이 색을 같이 줘야 한다. */
function thumbOf(style: CSSStyleDeclaration) {
  const thumb = /^(rgba?\([^)]*\)|\S+)/.exec(style.scrollbarColor)?.[0];

  return !thumb || thumb === "auto" ? DEFAULT_THUMB : thumb;
}

/** 내용이 굴러간 자리(`at`)로 띄운 스크롤바를 맞춘다. */
function follow(bar: Bar, at: number, vertical: boolean) {
  // 띄운 스크롤바를 따라가느라 우리가 쓴 값이면 넘긴다(끄는 중인 손잡이를 뒤로 당기지 않으려고).
  if (Math.abs(at - bar.elSet) <= 1) return;
  if (vertical) bar.bar.scrollTop = at;
  else bar.bar.scrollLeft = at;
  // 범위 끝에서 잘린 값일 수 있어, 쓴 값이 아니라 실제로 들어간 값을 적는다.
  bar.barSet = vertical ? bar.bar.scrollTop : bar.bar.scrollLeft;
  bar.elSet = NaN;
}

/** 띄운 스크롤바를 끌거나 그 위에서 굴리면 내용이 따라가게 한다. `move` 가 내용을 옮기고 실제로 옮겨진 자리를 돌려준다. */
function lead(bar: Bar, vertical: boolean, move: (at: number) => number) {
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
function ghostOf(el: HTMLElement): Ghost | null {
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

/** 바꿔 둔 스타일·표시를 전부 원래대로 — 장치가 내려갈 때와, 앞선 장치가 남긴 것이 있을 때 쓴다. */
function restoreAll() {
  for (const target of document.querySelectorAll<HTMLElement>(`[${UNDO_ATTRIBUTE}]`)) {
    for (const entry of (target.getAttribute(UNDO_ATTRIBUTE) ?? "").split("|")) {
      const [name, author = ""] = entry.split("=");
      const prop = STYLE_PROPS.find((known) => known === name);
      if (prop) target.style[prop] = author;
    }
    target.removeAttribute(UNDO_ATTRIBUTE);
  }
  for (const el of document.querySelectorAll<HTMLElement>(`[${OVERLAY_ATTRIBUTE}]`)) {
    el.removeAttribute(OVERLAY_ATTRIBUTE);
    el.shadowRoot?.querySelector<HTMLElement>(`[${GHOST_ATTRIBUTE}]`)?.style.setProperty("display", "none");
  }
  // ponytail: `--sbw`·`--sbh` 는 이 장치가 쓰는 이름이다 — 앱이 같은 이름을 인라인으로 쓰면 여기서 같이 지워진다.
  for (const el of document.querySelectorAll<HTMLElement>('[style*="--sb"]')) {
    el.style.removeProperty("--sbw");
    el.style.removeProperty("--sbh");
  }
  for (const el of document.querySelectorAll(`[${METHOD_ATTRIBUTE}]`)) {
    for (const name of [METHOD_ATTRIBUTE, METHOD_X_ATTRIBUTE, WHY_ATTRIBUTE]) el.removeAttribute(name);
  }
  document.querySelector(`[${PAGE_GHOST_ATTRIBUTE}]`)?.remove();
  document.querySelector(`[${DEBUG_ATTRIBUTE}]`)?.remove();
}

function start() {
  const applied = new WeakMap<HTMLElement, Applied[]>();
  const observed = new WeakSet<Element>();
  /** 계획이 기대는 안쪽 요소 → 그 스크롤 요소. */
  const dependents = new WeakMap<Node, Set<HTMLElement>>();
  /** 스크롤 요소 → 그 계획이 기대던 요소들. 다시 판별하거나 그 영역이 사라질 때 `dependents` 에서 지운다. */
  const dependedBy = new WeakMap<HTMLElement, Element[]>();
  const forget = (el: HTMLElement) => {
    for (const node of dependedBy.get(el) ?? []) dependents.get(node)?.delete(el);
    dependedBy.delete(el);
  };
  // 빈 자리에 띄운 스크롤바는 옆 요소가 넓어져 그 자리를 채우면 그 위에 남는다 — 요소가 붙거나 class 가 바뀌지 않아도(폭만 바뀌어도) 다시 판별한다.
  /** 둘레 요소 → 그 크기를 지켜보게 한 스크롤 요소들. (`dependents` 와 따로 둔다 — 크기가 바뀌었다고 그 요소에 기대는 영역을 전부 깨우지 않는다.) */
  const neighborOwners = new WeakMap<Element, Set<HTMLElement>>();
  const neighborObserver = new ResizeObserver((entries) => {
    const els = new Set<HTMLElement>();
    for (const { target } of entries) {
      for (const owner of neighborOwners.get(target) ?? []) if (owner.isConnected && observed.has(owner)) els.add(owner);
    }
    if (els.size > 0) sync([...els]);
  });
  /** 이번 판별에서 우리가 style 을 쓴 요소 — 그 변화로 둘레 요소를 지켜보는 영역을 다시 깨우지 않으려고 적어 둔다(다음 마이크로태스크에 비운다). */
  const wrote = new Set<Element>();
  let clearing = false;
  const markWritten = (target: Element) => {
    wrote.add(target);
    if (clearing) return;
    clearing = true;
    // style 변화 알림(MutationObserver)은 우리가 쓰는 순간 예약돼, 이 비우기보다 먼저 온다.
    queueMicrotask(() => {
      wrote.clear();
      clearing = false;
    });
  };
  /**
   * `node` 가 자리를 옮겼을 수 있을 때(인라인 style 이 바뀜, 움직임 효과가 끝남) 다시 판별할 영역들을 `into` 에 담는다.
   * 크기 감시는 크기가 그대로인 채 자리만 옮긴 것(transform·left·margin)을 못 잡는다.
   * 그 영역 자신과 그 영역을 품은 틀은 뺀다 — 옆 요소가 아니다.
   */
  const wakeNeighbors = (node: Element, into: Set<HTMLElement>) => {
    for (const owner of neighborOwners.get(node) ?? []) {
      if (owner !== node && !node.contains(owner) && owner.isConnected && observed.has(owner)) into.add(owner);
    }
  };
  /** 스크롤 요소 → 크기를 지켜보는 둘레 요소들. */
  const neighborsOf = new WeakMap<HTMLElement, Element[]>();
  const watchNeighbors = (el: HTMLElement, next: Element[]) => {
    const keep = new Set(next);
    for (const node of neighborsOf.get(el) ?? []) {
      // 그대로 남는 요소는 건드리지 않는다 — 뗐다 다시 걸면 첫 알림이 또 와서 끝없이 다시 판별한다.
      if (keep.has(node)) continue;
      const owners = neighborOwners.get(node);
      owners?.delete(el);
      if (owners && owners.size > 0) continue;
      neighborObserver.unobserve(node);
      neighborOwners.delete(node);
    }
    for (const node of next) {
      const owners = neighborOwners.get(node);
      if (owners) {
        owners.add(el);
        continue;
      }
      neighborOwners.set(node, new Set([el]));
      // 테두리·안쪽 여백만 늘어도 자리를 덮을 수 있다 — 테두리까지 포함한 크기를 본다.
      neighborObserver.observe(node, { box: "border-box" });
    }
    if (next.length > 0) neighborsOf.set(el, next);
    else neighborsOf.delete(el);
  };
  // 앞선 장치가 기억해 둔 실패는 그때의 화면 상태다 — 다시 해 본다.
  noOutside = new Set();
  /**
   * 넘친 크기를 기억해 둔 영역 → 판별 직후의 넘친 폭·높이. 스크롤바를 띄웠거나 받을 방식이 없어 손대지 않은 영역이다 —
   * 이런 영역은 안쪽 요소만 넓어지고 좁아질 때 영역 크기가 그대로라 크기 감시가 안 불린다. 안에서 뭔가 바뀔 때 다시 재서 가린다.
   */
  const scrollSizes = new WeakMap<HTMLElement, string>();
  /** 원래 스크롤바는 숨겼는데 띄운 막대가 없는 영역(굴릴 것이 없다) — 굴릴 것이 생기면 다시 판별해야 한다. */
  const barless = new WeakSet<HTMLElement>();
  /** 진단 표시용 — 영역마다 마지막 판별에서 쓴 굵기·자리·바꾼 값. */
  const debugInfo = new WeakMap<HTMLElement, DebugInfo>();
  const scrollBoxOf = (el: HTMLElement) => (el === document.body ? document.documentElement : el);
  const scrollSizeOf = (el: HTMLElement) => `${scrollBoxOf(el).scrollWidth}x${scrollBoxOf(el).scrollHeight}`;
  /** `node` 를 품은 영역 중 넘친 크기를 기억해 둔 것을 `touched` 에 담는다. */
  const touch = (node: Element | null, touched: Set<HTMLElement>) => {
    for (let el = node; el; el = el.parentElement) {
      if (el instanceof HTMLElement && scrollSizes.has(el)) touched.add(el);
    }
  };
  /** 그중 넘친 크기가 기억과 달라진 영역 — 다시 판별할 것. 우리가 쓴 값으로 난 변화는 판별 뒤에 잰 기억과 같아 걸리지 않는다. */
  const resized = (touched: Set<HTMLElement>) =>
    [...touched].filter((el) => el.isConnected && scrollSizeOf(el) !== scrollSizes.get(el));
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
    const look = customThumb
      ? `[${GHOST_ATTRIBUTE}]>div::-webkit-scrollbar{width:${scrollbarWidth}px;height:${height}px}[${GHOST_ATTRIBUTE}]>div::-webkit-scrollbar-thumb{background:${customThumb.backgroundColor};border-radius:${customThumb.borderRadius}}`
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
        if (!again || stopped || !el.isConnected || again()) return;
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

  /** 되돌리기 기록에서 그 항목 하나만 지운다 — 같은 요소를 다른 스크롤 영역도 바꿔 뒀을 수 있다. */
  const dropUndo = (target: HTMLElement, entry: string) => {
    const entries = (target.getAttribute(UNDO_ATTRIBUTE) ?? "").split("|");
    const at = entries.indexOf(entry);
    if (at >= 0) entries.splice(at, 1);
    if (entries.length > 0) target.setAttribute(UNDO_ATTRIBUTE, entries.join("|"));
    else target.removeAttribute(UNDO_ATTRIBUTE);
  };
  /**
   * 스크롤 영역들을 다시 판별한다. 한 묶음에 바깥 영역과 그 안의 영역이 같이 있으면 바깥 것부터 판별해 적용한 뒤에 안쪽 것을 판별한다 —
   * 한꺼번에 하면 안쪽 영역이 「바깥 영역의 처리가 잠깐 되돌려진 상태」를 보고 판단한다
   * (바깥 영역이 줄여 둔 여백이 원래 폭으로 보여, 그 여백에 자기 스크롤바를 띄우려 든다).
   */
  const sync = (els: HTMLElement[]) => {
    const inner = els.filter((el) =>
      els.some((other) => other !== el && (other === document.body ? el !== document.body : other.contains(el))),
    );
    if (inner.length === 0) {
      syncBatch(els);

      return;
    }
    syncBatch(els.filter((el) => !inner.includes(el)));
    sync(inner);
  };
  // 읽기와 쓰기를 단계로 나눈다 — 요소마다 번갈아 하면 스크롤 영역 수만큼 레이아웃을 다시 계산한다.
  const syncBatch = (els: HTMLElement[]) => {
    for (const el of els) {
      for (const { target, prop, author, applied: value } of applied.get(el) ?? []) {
        // 우리가 쓴 값 그대로일 때만 되돌린다 — 그 사이 다른 코드가 바꿨으면 그 값이 원래 값이다.
        if (target.style[prop] === value) target.style[prop] = author;
        dropUndo(target, `${prop}=${author}`);
      }
      applied.delete(el);
      // 겹치기 중이면 원래 스크롤바를 잠깐 되살려, 다른 영역과 같은 상태에서 재고 판별한다(그리기 전이라 보이지 않는다).
      const host = el === document.body ? document.documentElement : el;
      const floated = host.hasAttribute(OVERLAY_ATTRIBUTE);
      host.removeAttribute(OVERLAY_ATTRIBUTE);
      // 되살린 스크롤바가 제대로 되살아나지 않은 경우 — WebKit 은 `::-webkit-scrollbar` 로 꾸민 스크롤바를 한 번 그린 뒤 숨겼다 되살리면
      // 다시 만들지 않거나(넘치는데 폭이 0 으로 재진다), 꾸미지 않은 기본 스크롤바로 만든다(Safari 26 — 꾸민 폭 10px 이 14px 로 재졌다).
      // 그대로 두면 「스크롤바 없음」으로 판별해 띄운 것까지 거두거나, 틀린 폭으로 자리를 찾는다.
      // overflow 를 잠깐 바꿨다 돌려놓으면 다시 만든다(스크롤 위치는 그대로다).
      if (floated && el !== document.body && revivedWrong(el)) {
        const { overflowX, overflowY } = getComputedStyle(el);
        const tall = scrolls(overflowY) && (overflowY === "scroll" || el.scrollHeight - el.clientHeight > 1);
        const wide = scrolls(overflowX) && (overflowX === "scroll" || el.scrollWidth - el.clientWidth > 1);
        if (tall || wide) {
          el.setAttribute(NUDGE_ATTRIBUTE, "");
          void el.offsetHeight;
          el.removeAttribute(NUDGE_ATTRIBUTE);
        }
      }
    }
    const widths = els.map(scrollbarWidthOf);
    const heights = els.map(scrollbarHeightOf);
    const plans = els.map((el, i) => planFor(el, widths[i], heights[i]));
    // 스크롤바를 늘 띄워 두는 영역(overflow: scroll)은 내용이 늘고 줄어도 영역 크기가 그대로라 크기 감시가 안 불린다 —
    // 넘치는지에 따라 처리가 갈리므로(넘치면 받고, 아니면 빈 띠를 숨김) 띄운 영역처럼 자식 크기와 넘친 크기를 지켜본다.
    const always = els.map((el) => {
      const { overflowX, overflowY } = getComputedStyle(scrollBoxOf(el));

      return overflowX === "scroll" || overflowY === "scroll";
    });
    /** 스크롤바를 띄우지 못한 영역 — 못 띄운 이유를 기억해 뒀으니 다시 판별하면 다른 방식이 나온다. */
    const retry: HTMLElement[] = [];
    /** 찾은 뒤에 제외 선택자에 걸리게 된 영역 — 남긴 것을 지우고 더 보지 않는다. */
    const excluded = els.filter((_, i) => plans[i].why === "excluded");
    els.forEach((el, i) => {
      const { manualWidth, manualHeight = 0, overlay, bottom, hidden, changes, dependsOn, width = widths[i] } = plans[i];
      markWritten(el);
      if (plans[i].why === "excluded") {
        hideOverlay(el);
        el.style.removeProperty("--sbw");
        el.style.removeProperty("--sbh");

        return;
      }
      // manual 이 아닌 스크롤 요소는 0 으로 끊어 바깥 영역의 값이 안쪽으로 새지 않게 한다.
      el.style.setProperty("--sbw", `${manualWidth}px`);
      el.style.setProperty("--sbh", `${manualHeight}px`);
      if (hidden) {
        // 굴릴 것이 없다 — 띄운 것은 거두고 원래 스크롤바의 빈 띠만 숨긴다. 내용이 늘어 넘치면 알아채게 자식 크기를 지켜본다.
        hideOverlay(el);
        scrollBoxOf(el).setAttribute(OVERLAY_ATTRIBUTE, "");
        if (el !== document.body) watchChildren(el);
      } else if (!overlay && !bottom) {
        hideOverlay(el);
        if (always[i] && el !== document.body) watchChildren(el);
      } else if (!showOverlay(el, width, plans[i])) retry.push(el);
      forget(el);
      for (const node of dependsOn) {
        const owners = dependents.get(node);
        if (owners) owners.add(el);
        else dependents.set(node, new Set([el]));
      }
      if (dependsOn.length > 0) dependedBy.set(el, dependsOn);
      watchNeighbors(el, plans[i].neighbors ?? []);
      if (changes.length === 0) return;
      const done: Applied[] = [];
      // 바꾸기 전 값은 쓰기 전에 한꺼번에 읽는다 — 같은 요소의 다른 속성을 먼저 바꾸면 값이 달라진다.
      const befores = changes.map(({ target, prop }) => (config.debug ? getComputedStyle(target)[prop] : ""));
      changes.forEach(({ target, prop, value }, index) => {
        const author = target.style[prop];
        const from = befores[index];
        markWritten(target);
        target.style[prop] = value;
        done.push({ target, prop, author, applied: target.style[prop], from });
        // 바꾼 값을 요소에도 적어 둔다 — 장치가 내려갈 때 남김없이 되돌리려고.
        const undo = target.getAttribute(UNDO_ATTRIBUTE);
        target.setAttribute(UNDO_ATTRIBUTE, `${undo ? `${undo}|` : ""}${prop}=${author}`);
      });
      applied.set(el, done);
    });
    els.forEach((el, i) => {
      const { manualWidth, manualHeight = 0, overlay, bottom, changes } = plans[i];
      const gone = plans[i].why === "excluded";
      const floated = overlay || bottom !== undefined;
      const idle = !floated && changes.length === 0 && manualWidth === 0 && manualHeight === 0;
      const shown = widths[i] > 0 || heights[i] > 0;
      const tracked = floated || idle || always[i];
      if (!gone && shown && el.dataset.scrollbar !== "off" && tracked) scrollSizes.set(el, scrollSizeOf(el));
      else scrollSizes.delete(el);
      // 띄우기로 정했어도 굴릴 것이 없으면 실제로는 아무것도 띄우지 않는다(`showOverlay`).
      const box = scrollBoxOf(el);
      const still = overlay && box.scrollHeight - box.clientHeight <= 1;
      const stillX = bottom !== undefined && box.scrollWidth - box.clientWidth <= 1;
      if (!gone && (plans[i].hidden || still || stillX)) barless.add(el);
      else barless.delete(el);
      if (!config.debug || gone) {
        if (el.hasAttribute(METHOD_ATTRIBUTE)) {
          for (const name of [METHOD_ATTRIBUTE, METHOD_X_ATTRIBUTE, WHY_ATTRIBUTE]) el.removeAttribute(name);
        }

        return;
      }
      const why = !shown ? "no-scrollbar" : still ? "nothing-to-scroll" : plans[i].why;
      debugInfo.set(el, {
        width: still ? 0 : (plans[i].width ?? widths[i]),
        height: stillX ? 0 : (plans[i].height ?? heights[i]),
        offset: plans[i].offset,
        bottomOffset: plans[i].bottomOffset,
        changes: (applied.get(el) ?? []).map(({ target, prop, from, applied: to }) => ({ target, prop, from, to })),
      });
      el.setAttribute(METHOD_ATTRIBUTE, still ? "none" : (plans[i].method ?? "none"));
      el.setAttribute(METHOD_X_ATTRIBUTE, stillX ? "none" : (plans[i].methodX ?? "none"));
      if (why) el.setAttribute(WHY_ATTRIBUTE, why);
      else el.removeAttribute(WHY_ATTRIBUTE);
    });
    for (const el of excluded) unobserve(el);
    if (retry.length > 0) sync(retry);
  };
  const onResize = (entries: ResizeObserverEntry[]) => {
    sync([...new Set(entries.map((entry) => entry.target as HTMLElement))]);
  };
  // 스크롤바가 생기고 사라지면 그 영역의 내용 폭이 바뀌어 불린다 — 화면에 그리기 전이라 여백이 튀지 않는다.
  const contentObserver = new ResizeObserver(onResize);
  // 폭이 내용 크기로 정해지는 스크롤 요소는 스크롤바가 바뀌어도 내용 폭이 그대로고 바깥 폭이 바뀐다.
  const borderObserver = new ResizeObserver(onResize);
  const observe = (el: Element) => {
    if (observed.has(el)) return;
    observed.add(el);
    contentObserver.observe(el);
    borderObserver.observe(el, { box: "border-box" });
  };
  const unobserve = (el: Element) => {
    if (!observed.delete(el)) return;
    if (el instanceof HTMLElement) {
      forget(el);
      watchNeighbors(el, []);
      noOutside.delete(el);
      scrollSizes.delete(el);
      unwatchChildren(el);
    }
    contentObserver.unobserve(el);
    borderObserver.unobserve(el);
  };
  /** `root` 와 그 아래 요소를 하나씩 돈다. */
  const walk = (root: Element, run: (el: Element) => void) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node: Node | null = root; node; node = walker.nextNode()) {
      if (node instanceof Element) run(node);
    }
  };
  // ponytail: 요소마다 계산된 스타일을 읽어 요소 수에 비례한다 — 무거우면 requestIdleCallback 으로 나눠 훑는다.
  // `:hover`·`:has()`·컨테이너 쿼리처럼 속성·DOM 변화 없이 스크롤 영역이 되는 요소는 다음 훑기 때 찾는다. shadow root·iframe 안은 보지 않는다.
  /** `root` 아래의 새 스크롤 영역을 등록하고, 겹치기 중인 영역은 `overlaid` 에 담는다(크기 감시가 안 불려 직접 다시 판별해야 한다). */
  const scan = (root: Element, overlaid: Set<HTMLElement>) =>
    walk(root, (el) => {
      if (!observed.has(el)) {
        if (isScroller(el)) observe(el);
      } else if (
        el instanceof HTMLElement &&
        // 조상의 class 가 바뀌어 뒤늦게 제외 선택자에 걸린 영역도 담는다 — 다시 판별하면서 남긴 것을 지운다.
        ((el === document.body ? document.documentElement : el).hasAttribute(OVERLAY_ATTRIBUTE) || isExcluded(el))
      ) {
        overlaid.add(el);
      }
    });
  let stopped = false;
  let rescan = 0;
  /** 다음 프레임에 문서 전체를 한 번 훑는다 — 창 크기 변화(미디어 쿼리)·스타일시트 도착처럼 어디가 바뀌었는지 모를 때. */
  const scheduleScan = () => {
    if (stopped || rescan) return;
    rescan = requestAnimationFrame(() => {
      rescan = 0;
      // 가장자리에 못 붙던 영역도 화면이 바뀌었으니 한 번 더 해 본다 — 넓히기로 물러나 겹치기 표시가 없는 영역까지.
      const overlaid = new Set<HTMLElement>();
      for (const el of noOutside) if (el instanceof HTMLElement && el.isConnected && observed.has(el)) overlaid.add(el);
      noOutside = new Set();
      scan(document.body, overlaid);
      if (overlaid.size > 0) sync([...overlaid]);
    });
  };
  /** 우리가 쓰는 표시 — 바뀌어도 훑지 않는다. */
  const ownAttributes = new Set([
    UNDO_ATTRIBUTE,
    OVERLAY_ATTRIBUTE,
    NUDGE_ATTRIBUTE,
    METHOD_ATTRIBUTE,
    METHOD_X_ATTRIBUTE,
    WHY_ATTRIBUTE,
  ]);
  // 새로 붙는 요소, 사라지는 요소, 속성·글자가 바뀐 요소, 계획이 기대던 안쪽 요소의 변화를 잡는다. style 은 `styleObserver` 가 본다.
  const mutationObserver = new MutationObserver((mutations) => {
    const again = new Set<HTMLElement>();
    const roots = new Set<Element>();
    const touched = new Set<HTMLElement>();
    for (const mutation of mutations) {
      const { type, target, attributeName } = mutation;
      if (attributeName === "style" || (attributeName && ownAttributes.has(attributeName)))
        continue;
      const el = target instanceof Element ? target : target.parentElement;
      touch(el, touched);
      if (el && isStyleSheet(el)) scheduleScan();
      if (type === "characterData") {
        // 상자 안 글자는 높이가 바뀌면 자식 크기 감시가 잡는다 — 판별이 기대는 요소와 영역 바로 아래 글자만 다시 판별한다.
        for (const owner of (el && dependents.get(el)) ?? []) if (observed.has(owner)) again.add(owner);
        if (el instanceof HTMLElement && observed.has(el) && el.hasAttribute(OVERLAY_ATTRIBUTE)) {
          again.add(el);
        }
        continue;
      }
      // 판별 결과가 기대는 변화(요소가 붙고 떨어짐, class·표시)일 때만 다시 판별한다.
      if (type === "childList" || attributeName === "class" || attributeName === "data-scrollbar") {
        for (const owner of (el && dependents.get(el)) ?? []) if (observed.has(owner)) again.add(owner);
        // 겹치기 중에는 내용이 늘거나 줄어도 영역 크기가 그대로라 크기 감시가 안 불린다.
        const overlaid = el?.closest<HTMLElement>(`[${OVERLAY_ATTRIBUTE}]`);
        if (overlaid && observed.has(overlaid)) again.add(overlaid);
        // ponytail: 페이지 전체가 겹치기 중이면 문서 어디에서 바뀌든 다시 판별한다 — 무거우면 묶어서 한 번만 돌린다.
        if (overlaid === document.documentElement) again.add(document.body);
      }
      if (type === "attributes") {
        const restyled = attributeName === "class" || attributeName === "data-scrollbar";
        if (restyled && target instanceof HTMLElement && observed.has(target)) again.add(target);
        // 속성 하나로 그 아래 요소의 스타일이 바뀔 수 있다(`[data-state=open] > div` 등). `html` 이면 문서 전체.
        if (target instanceof Element)
          roots.add(target === document.documentElement ? document.body : target);
        continue;
      }
      for (const node of mutation.removedNodes) {
        if (isStyleSheet(node)) scheduleScan();
        if (node instanceof Element) walk(node, unobserve);
      }
      for (const node of mutation.addedNodes) {
        if (isStyleSheet(node)) {
          scheduleScan();
          // `<link>` 는 붙은 뒤에 내려받아 적용된다.
          node.addEventListener("load", scheduleScan, { once: true });
        }
        if (node instanceof Element) roots.add(node);
      }
    }
    const covered = (root: Element) => {
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
        if (roots.has(parent)) return true;
      }

      return false;
    };
    const overlaid = new Set<HTMLElement>();
    for (const root of roots) {
      if (root.isConnected && !covered(root)) scan(root, overlaid);
    }
    for (const el of overlaid) again.add(el);
    for (const el of resized(touched)) again.add(el);
    if (again.size > 0) sync([...again].filter((el) => el.isConnected));
  });
  // 여백·`--sbw` 는 우리도 style 로 쓴다 — 인라인 overflow 선언이 바뀐 요소만 본다(전부에 반응하면 끝없이 돈다).
  const styleObserver = new MutationObserver((mutations) => {
    const again = new Set<HTMLElement>();
    const touched = new Set<HTMLElement>();
    for (const { target, oldValue } of mutations) {
      if (!(target instanceof HTMLElement)) continue;
      // ponytail: style 이 바뀔 때마다 조상을 훑는다 — 매 프레임 style 을 쓰는 움직임 효과가 많아 무거우면 프레임당 한 번으로 묶는다.
      touch(target, touched);
      // 옆 요소가 인라인 style 로 자리를 옮겼을 수 있다(우리가 쓴 style 이면 넘긴다).
      if (!wrote.has(target)) wakeNeighbors(target, again);
      if (overflowOf(oldValue) === overflowOf(target.getAttribute("style"))) continue;
      // 페이지 전체의 overflow 는 `html`·`body` 어느 쪽에 걸려도 `body` 로 다룬다.
      const el = target === document.documentElement ? document.body : target;
      if (observed.has(el)) again.add(el);
      else if (isScroller(el)) observe(el);
    }
    for (const el of resized(touched)) again.add(el);
    if (again.size > 0) sync([...again].filter((el) => el.isConnected));
  });
  // 늦게 뜬 이미지가 안쪽 상자만 넓히면 영역 크기가 그대로라 크기 감시가 안 불린다.
  const onLoad = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const touched = new Set<HTMLElement>();
    touch(event.target, touched);
    const els = resized(touched);
    if (els.length > 0) sync(els);
  };
  // 스크롤 요소나 그 조상(팝업·카드)이 커지며 나타나는 것 같은 움직임 효과 중에는 가장자리에 못 붙는다 —
  // 효과가 끝나면, 움직인 요소와 그 아래에서 못 붙었던 영역을 한 번 더 해 본다.
  // 움직임 효과가 끝난 요소가 다른 영역의 옆 요소면, 끝난 자리가 그 영역의 스크롤바 자리를 덮었을 수 있다 — 그 영역도 다시 판별한다.
  const retryAnchor = (event: Event) => {
    const moved = event.target;
    if (!(moved instanceof Element)) return;
    const again = new Set<HTMLElement>();
    for (const el of noOutside) {
      if (!(el instanceof HTMLElement) || !moved.contains(el) || !observed.has(el)) continue;
      noOutside.delete(el);
      again.add(el);
    }
    wakeNeighbors(moved, again);
    if (again.size > 0) sync([...again]);
  };
  // 콜백 안에서 여백을 고쳐 크기를 다시 바꾸므로 브라우저가 "루프" 오류 이벤트를 남긴다(다음 프레임에 끝난다).
  // 다음 프레임으로 미루면 이벤트는 없지만 한 프레임 밀려 보여서 미루지 않고, 이 이벤트만 나중에 등록된 리스너에 닿지 않게 막는다.
  // 캡처 단계라 이미지·스크립트 로드 실패 이벤트(message 가 없는 일반 Event)도 여기로 온다 — 문구가 있는 것만 본다.
  const swallowLoopError = (event: Event) => {
    if (!config.quiet) return;
    const message: unknown = "message" in event ? event.message : undefined;
    if (typeof message === "string" && message.startsWith(LOOP_ERROR)) event.stopImmediatePropagation();
  };
  // 내용을 굴리면 띄운 스크롤바가 따라간다. 내용 높이가 크기 변화 없이 바뀌었으면 손잡이 길이도 여기서 다시 맞춘다.
  const followScroll = (event: Event) => {
    // 굴릴 때 넘친 폭을 다시 본다 — 요소 변화 없이 바뀐 것(마우스를 올렸을 때의 모양, 늦게 적용된 글꼴)을 여기서 바로잡는다.
    // 높이만 바뀐 것은 아래에서 손잡이 길이만 맞춘다(굴릴 때마다 높이가 바뀌는 목록에서 매번 다시 판별하지 않으려고).
    const scrolled = event.target === document ? document.body : event.target;
    // 띄운 막대가 없는 영역(굴릴 것이 없었다)은 높이도 본다 — 굴렸다는 것은 굴릴 것이 생겼다는 뜻이다.
    if (
      scrolled instanceof HTMLElement &&
      scrollSizes.has(scrolled) &&
      (!scrollSizes.get(scrolled)?.startsWith(`${scrollBoxOf(scrolled).scrollWidth}x`) ||
        (barless.has(scrolled) && scrollSizeOf(scrolled) !== scrollSizes.get(scrolled)))
    ) {
      sync([scrolled]);

      return;
    }
    if (event.target === document) {
      const root = document.documentElement;
      if (!pageGhost || !root.hasAttribute(OVERLAY_ATTRIBUTE)) return;
      const height = `${root.scrollHeight}px`;
      if (pageGhost.filler.style.height !== height) pageGhost.filler.style.height = height;
      follow(pageGhost, window.scrollY, true);

      return;
    }
    const el = event.target;
    if (!(el instanceof HTMLElement) || !el.hasAttribute(OVERLAY_ATTRIBUTE)) return;
    const ghost = ghosts.get(el);
    if (!ghost) return;
    const height = `${el.scrollHeight}px`;
    if (ghost.v.filler.style.height !== height) ghost.v.filler.style.height = height;
    follow(ghost.v, el.scrollTop, true);
    follow(ghost.h, el.scrollLeft, false);
  };

  // 앞선 장치가 되돌리지 못하고 남긴 것이 있으면 지우고 시작한다.
  restoreAll();
  window.addEventListener("error", swallowLoopError, true);
  document.addEventListener("scroll", followScroll, { capture: true, passive: true });
  document.addEventListener("load", onLoad, true);
  document.addEventListener("animationend", retryAnchor, true);
  document.addEventListener("transitionend", retryAnchor, true);
  window.addEventListener("resize", scheduleScan);
  scan(document.body, new Set());
  // 페이지 전체(브라우저 창) 스크롤 — 창 스크롤바가 생기고 사라지면 `body` 폭이 바뀐다.
  if (!isExcluded(document.body)) observe(document.body);
  // `html` 의 속성(테마 class 등)·`head` 의 스타일시트도 스타일을 바꿔 문서 전체를 본다.
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  styleObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
    attributeOldValue: true,
  });

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
    if (stopped || !config.debug) {
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
  /** 설정이 바뀌었을 때 — 새로 대상이 된 영역을 찾고, 보던 영역은 전부 다시 판별한다. */
  const refresh = () => {
    startDebug();
    const known: HTMLElement[] = [];
    walk(document.body, (el) => {
      if (el instanceof HTMLElement && observed.has(el)) known.push(el);
    });
    scan(document.body, new Set());
    if (!isExcluded(document.body)) observe(document.body);
    if (known.length > 0) sync(known);
  };
  startDebug();
  const stop = () => {
    stopped = true;
    // 떨어져 나간 요소를 붙잡고 있지 않게 비운다.
    noOutside = new Set();
    cancelAnimationFrame(debugFrame);
    mutationObserver.disconnect();
    styleObserver.disconnect();
    contentObserver.disconnect();
    borderObserver.disconnect();
    childObserver.disconnect();
    neighborObserver.disconnect();
    window.removeEventListener("resize", scheduleScan);
    cancelAnimationFrame(rescan);
    window.removeEventListener("error", swallowLoopError, true);
    document.removeEventListener("scroll", followScroll, { capture: true });
    document.removeEventListener("load", onLoad, true);
    document.removeEventListener("animationend", retryAnchor, true);
    document.removeEventListener("transitionend", retryAnchor, true);
    overlayStyle.remove();
    restoreAll();
  };

  return { stop, refresh };
}

/** 틀린 선택자는 없는 것으로 친다 — 선택자 오타 하나로 화면 전체가 죽지 않게. */
function validSelector(selector: string) {
  if (selector === "") return "";
  try {
    document.documentElement.matches(selector);

    return selector;
  } catch {
    return "";
  }
}

/** 여러 번 설치해도 장치는 하나만 돈다 — 마지막 것을 걷을 때 멈춘다. 설정은 가장 나중에 설치한 것의 값을 쓴다. */
const installed: Config[] = [];
let engine: ReturnType<typeof start> | null = null;

/** 장치를 띄운다 — `body` 가 생긴 뒤에만. 설치가 다 걷혔거나 이미 떠 있으면 아무것도 하지 않는다. */
function boot() {
  if (engine || installed.length === 0 || !document.body) return;
  engine = start();
}

/**
 * 스크롤바 전역 처리를 설치한다. 돌려주는 함수를 부르면 걷는다(바꿔 둔 여백·변수·표시를 되돌린다).
 * 브라우저에서만 돈다 — 문서나 크기·변화 감시(ResizeObserver·MutationObserver)가 없는 곳(서버, 일부 테스트 도구)에서 부르면 아무것도 하지 않는다.
 * `body` 가 아직 없을 때(`<head>` 의 스크립트) 부르면 문서를 다 읽은 뒤에 시작한다.
 */
export function installMrScroll(options: MrScrollOptions = {}): () => void {
  if (
    typeof document === "undefined" ||
    typeof ResizeObserver === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return () => {};
  }
  const gap = options.stayClose;
  const mine: Config = {
    // 음수·숫자가 아닌 값은 쓸 수 없다 — 기본값으로 친다(`Infinity` 는 「한도 없음」이라 받는다).
    stayClose: typeof gap === "number" && gap >= 0 ? gap : DEFAULTS.stayClose,
    debug: options.debug ?? DEFAULTS.debug,
    exclude: validSelector(options.exclude ?? DEFAULTS.exclude),
    quiet: options.quiet ?? DEFAULTS.quiet,
    textarea: options.textarea ?? DEFAULTS.textarea,
  };
  installed.push(mine);
  config = mine;
  if (engine) engine.refresh();
  else if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });

  return () => {
    const at = installed.indexOf(mine);
    // 두 번 걷어도 한 번만 한다.
    if (at < 0) return;
    installed.splice(at, 1);
    const last = installed[installed.length - 1];
    if (last) {
      config = last;
      engine?.refresh();

      return;
    }
    engine?.stop();
    engine = null;
    config = DEFAULTS;
  };
}
