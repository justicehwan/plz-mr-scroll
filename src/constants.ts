/** 장치가 쓰는 이름과 고정 값 — 요소에 붙이는 표시(속성) 이름, 숨기기·진단 층의 CSS, 허용 오차. */

export const LOOP_ERROR = "ResizeObserver loop completed with undelivered notifications";
/** 좌우 빈 자리를 같다고 보는 허용 오차(px). */
export const CENTER_TOLERANCE = 2;
export const UNDO_ATTRIBUTE = "data-scrollbar-undo";
/** 겹치기 중인 스크롤 요소에 붙는다 — 원래 스크롤바를 숨긴다. */
export const OVERLAY_ATTRIBUTE = "data-scrollbar-overlay";
/** 내용 위에 띄운 스크롤바(스크롤 요소의 shadow root 안에 있다). */
export const GHOST_ATTRIBUTE = "data-scrollbar-ghost";
/** 페이지 전체(브라우저 창) 스크롤에 띄운 스크롤바 — `body` 끝에 붙이고 화면 오른쪽 끝에 고정한다. */
export const PAGE_GHOST_ATTRIBUTE = "data-scrollbar-ghost-page";
/** 잠깐 붙였다 떼어 스크롤바를 다시 그리게 한다 — `sync` 의 「되살린 스크롤바가 안 그려진 경우」 참고. */
export const NUDGE_ATTRIBUTE = "data-scrollbar-nudge";
/** 진단 표시(`debug`) — 스크롤 영역마다 세로·가로에 고른 방식과, 그 방식이 된 이유를 적는다. */
export const METHOD_ATTRIBUTE = "data-scrollbar-method";
export const METHOD_X_ATTRIBUTE = "data-scrollbar-method-x";
export const WHY_ATTRIBUTE = "data-scrollbar-why";
/** 진단 표시를 그리는 층 — 화면 맨 위에 따로 띄운다(`body` 끝, shadow root 안). 스크롤 영역에는 아무것도 끼워 넣지 않는다. */
export const DEBUG_ATTRIBUTE = "data-scrollbar-debug";
/**
 * 진단 층의 모양. 영역마다 아래를 겹쳐 그린다(색은 방식별):
 *  - area: 영역의 테두리와 옅은 칠 · tag: 방식·스크롤바 굵기·바꾼 값·까닭을 적은 딱지
 *  - bar: 스크롤바가 놓인 자리 · pad: 줄이거나 더한 뒤의 여백(빗금) · content: 스크롤바가 없을 때의 내용 자리(점선)
 */
export const DEBUG_CSS = [
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

/** 진단 층에 그리지 않는 까닭 — 손댈 일이 없었던 영역이다(스크롤바가 없음, 꺼 둠, 제외함). 다 그리면 화면이 표시로 덮인다. */
export const QUIET = new Set(["", "no-scrollbar", "off", "excluded"]);
export const OVERLAY_CSS = `[${OVERLAY_ATTRIBUTE}]{scrollbar-width:none!important}[${OVERLAY_ATTRIBUTE}]::-webkit-scrollbar{display:none!important}[${NUDGE_ATTRIBUTE}]{overflow:hidden!important}`;
/** 스크롤 요소에 손잡이 색이 정해져 있지 않을 때 쓰는 색 — 배경을 투명하게 하려면 손잡이 색을 같이 줘야 한다. */
export const DEFAULT_THUMB = "rgba(0, 0, 0, 0.35)";

/** 우리가 바꾸는 인라인 style 속성 — 되돌릴 때도 이 목록에 있는 것만 쓴다. */
export const STYLE_PROPS = ["paddingRight", "paddingLeft", "paddingBottom", "marginRight", "width", "scrollbarGutter", "translate"] as const;
