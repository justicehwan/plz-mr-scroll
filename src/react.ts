"use client";

/**
 * MrScroll — 앱 맨 위에 한 번 두면, 화면의 스크롤 영역마다 스크롤바가 생겨도 내용이 밀리지 않게 맞춘다.
 * 화면 코드에는 아무것도 붙이지 않아도 된다. 화면에 있는 동안만 돌고, 사라지면 바꿔 둔 것을 되돌린다.
 * 하는 일은 `installMrScroll`(React 에 기대지 않는 본체)을 설치하고 걷는 것뿐이다.
 */

import { useEffect } from "react";
import { installMrScroll, type MrScrollOptions } from "./index.js";

export type { MrScrollOptions };

export function MrScroll({ stayClose, debug, exclude, quiet, textarea }: MrScrollOptions): null {
  useEffect(
    () => installMrScroll({ stayClose, debug, exclude, quiet, textarea }),
    [stayClose, debug, exclude, quiet, textarea],
  );

  return null;
}
