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
 * 글 방향이 오른쪽에서 왼쪽인 영역(`direction: rtl`)은 세로 스크롤바가 왼쪽에 뜬다 — 좌우를 뒤집어 같은 순서로 판별한다(영역마다 가린다).
 * 페이지 전체(브라우저 창) 스크롤도 같은 순서로 본다 — `body` 를 스크롤 영역으로 치고, 겹치기는 화면 오른쪽 끝에 고정해 띄운다.
 * 창 스크롤바가 그대로 남는 방식이면, 화면 폭을 따라 놓이는 요소(화면에 고정한 헤더·버튼·알림)도 스크롤바가 없을 때의 자리에 맞춘다.
 * 스크롤을 잠그는 코드(모달)가 사라진 창 스크롤바 자리를 여백으로 대신 채웠으면, 써 둔 값을 되돌리지 않고 쥐고 있는다.
 * 받는 설정은 `MrScrollOptions` 에 있다(바깥에 띄울 거리의 한도 · 제외 선택자 · 진단 표시 · 브라우저 알림 가로채기).
 * React 에 기대지 않는다 — React 에서는 이것을 감싼 `MrScroll` 컴포넌트를 쓴다.
 * `data-scrollbar` 로 자동 판별을 바꿀 수 있다: `off`(건드리지 않음) · `center`(좌우가 달라도 가운데 정렬로 봄) ·
 * `manual`(자동 판별을 하지 않고 원래 스크롤바를 그대로 둔 채, 세로 폭을 `--sbw`·가로 높이를 `--sbh` 로 내려 준다 —
 * 화면 코드가 `calc(여백 - var(--sbw, 0px))` 처럼 직접 받는다).
 *
 * 파일 구성 — 이 파일은 설치·걷기만 맡는다:
 *  - `engine.ts` 영역을 찾아 지켜보다 다시 판별해 화면에 쓴다 · `plan.ts` 어떤 방식으로 받을지 정한다
 *  - `room.ts` 바깥 자리를 찾는다 · `float.ts` 띄울 수 있는지 본다 · `measure.ts` 굵기·자식·상자 크기를 잰다
 *  - `bars.ts` 스크롤바를 띄우고 거둔다 · `ghost.ts` 띄운 스크롤바와 내용의 스크롤을 맞물린다 · `debug.ts` 진단 표시를 그린다
 *  - `config.ts` 설정 · `constants.ts` 표시 이름과 고정 값 · `types.ts` 판별 결과의 모양
 */

import { DEFAULTS, setConfig, type Config, type MrScrollOptions } from "./config.js";
import { start } from "./engine.js";

export type { MrScrollOptions } from "./config.js";

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
  setConfig(mine);
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
      setConfig(last);
      engine?.refresh();

      return;
    }
    engine?.stop();
    engine = null;
    setConfig(DEFAULTS);
  };
}
