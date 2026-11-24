/** 설치할 때 받는 설정과, 지금 쓰는 설정으로 요소를 거르는 물음(제외 선택자·입력창). */

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
export type Config = Required<MrScrollOptions>;
export const DEFAULTS: Config = { stayClose: 12, debug: false, exclude: "", quiet: true, textarea: false };
export let config = DEFAULTS;
/** 설정을 바꾼다 — 설치·걷기(`installMrScroll`)만 부른다. 다른 파일은 `config` 를 읽기만 한다. */
export const setConfig = (next: Config) => {
  config = next;
};
/** 제외 선택자(`exclude`)에 걸린 요소이거나 그 아래에 있는가. */
export const isExcluded = (el: Element) => config.exclude !== "" && el.closest(config.exclude) !== null;
/** 입력창은 `textarea` 옵션을 켰을 때만 본다. */
export const skipsTextarea = (el: Element) => !config.textarea && el instanceof HTMLTextAreaElement;
