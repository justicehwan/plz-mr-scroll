/** 판별 결과(`Plan`)와 띄운 스크롤바·바꾼 스타일·진단 표시를 적는 모양. */

import type { STYLE_PROPS } from "./constants.js";

export type StyleProp = (typeof STYLE_PROPS)[number];
export type StyleChange = { target: HTMLElement; prop: StyleProp; value: string };
/** 진단 표시에 적는 방식 이름. */
export type Method = "padding" | "center" | "outside" | "overlay" | "widen" | "manual" | "none";
export type Plan = {
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
export type Bar = { bar: HTMLElement; filler: HTMLElement; barSet: number; elSet: number };
/** 스크롤 요소에 띄운 스크롤바 — 자리를 잡는 틀, 그 요소를 「붙을 자리」로 부르는 이름, 세로용·가로용 상자. */
export type Ghost = { anchor: HTMLElement; name: string; v: Bar; h: Bar };
export type Applied = {
  target: HTMLElement;
  prop: StyleProp;
  author: string;
  applied: string;
  /** 바꾸기 전에 실제로 적용돼 있던 값 — 진단 표시를 켰을 때만 읽는다. */
  from: string;
};

/** 진단 층에 그릴 조각 하나 — 화면 기준 자리와 모양 이름, 딱지면 글자. */
export type Shape = { kind: string; x: number; y: number; w: number; h: number; text?: string };
/** 진단 표시용 — 그 영역에 쓴 스크롤바 굵기·띄운 자리와, 바꾼 스타일의 전·후 값. */
export type DebugInfo = {
  width: number;
  height: number;
  offset?: number;
  bottomOffset?: number;
  changes: { target: HTMLElement; prop: StyleProp; from: string; to: string }[];
};
