import { clsx, type ClassValue } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { MrScroll } from "plz-mr-scroll/react";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * MrScroll 눈 확인용 화면 · 자동 테스트 대상 — 스크롤 영역의 경우의 수를 한 화면에 모아, 적용 전·후를 나란히 본다.
 *
 * 두 칸의 뜻
 * - 적용 전: 전역 장치를 끔(`data-scrollbar="off"`) — 스크롤바가 내용을 미는 브라우저 기본 동작.
 * - 자동: 같은 구조에 아무 표시도 붙이지 않고 전역 장치에 맡김 — 화면 코드가 실제로 쓰는 방식.
 * 경우마다 「자동」이 골라야 하는 방식을 제목 아래에 적어 둔다.
 *
 * 보는 법: 「줄 많게」로 스크롤바를 만들었다 없앴다 하며, 각 상자 위 기준 줄(▼)과 내용의 좌우 끝이 맞는지 본다.
 */
type Variant = "before" | "auto";

const VARIANTS: { key: Variant; label: string; hint: string }[] = [
  { key: "before", label: "적용 전", hint: "전역 장치 끔 — 스크롤바가 내용을 민다" },
  { key: "auto", label: "자동", hint: "같은 구조, 표시 없음 — 전역 장치가 고른다" },
];

/** 겹쳐 뜨는 스크롤바 환경(macOS 기본)에서도 폭을 차지하는 스크롤바를 보려고, 이 화면 안에서만 11px 스크롤바를 강제한다. */
const FORCED_SCROLLBAR =
  "[scrollbar-color:auto] [scrollbar-width:auto] [&::-webkit-scrollbar]:h-[0.6875rem] [&::-webkit-scrollbar]:w-[0.6875rem] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-gray-200";

const BOX = "flex h-56 w-72 flex-col overflow-hidden rounded-[0.5rem] border border-gray-400 bg-primary-wt";
const MARK = "flex justify-between body5 text-red-600";
const LINE = "body4 text-gray-900";
/** 영역 색 — 여백이 눈에 보이게 칠한다. 바깥 영역 / 스크롤 영역 / 행·안쪽 래퍼 / 내용. */
const OUTER = "bg-purple-100";
const SCROLLER = "bg-orange-100";
const INNER = "bg-blue-100";
const CONTENT = "bg-green-100";

function lines(many: boolean) {
  return Array.from({ length: many ? 30 : 3 }, (_, i) => i + 1);
}

/** 내용의 좌우 끝이 와야 할 자리를 가리키는 기준 줄 — 스크롤 영역 밖에 둬서 스크롤바 영향을 받지 않는다. */
function Mark({ className }: { className?: string }) {
  return (
    <div className={cn(MARK, className)}>
      <span>▼ 왼쪽 끝</span>
      <span>오른쪽 끝 ▼</span>
    </div>
  );
}

function Rows({ many, className }: { many: boolean; className?: string }) {
  return (
    <>
      {lines(many).map((n) => (
        <p key={n} className={cn(LINE, INNER, className)}>
          <span className={cn("flex justify-between", CONTENT)}>
            <span>|내용 {n}</span>
            <span>끝|</span>
          </span>
        </p>
      ))}
    </>
  );
}

/** 스크롤 영역 바로 아래 자식의 크기는 그대로 두고, 그 안의 요소만 넓혔다 되돌린다 — 크기 감시로는 안 잡히는 변화. */
function InnerWide({ variant, many, scroll }: { variant: Variant; many: boolean; scroll: string }) {
  const [wide, setWide] = useState(false);

  return (
    <div className={BOX}>
      <label className="flex items-center gap-1 px-4 pt-2 body5 text-gray-900">
        <input type="checkbox" checked={wide} onChange={(event) => setWide(event.target.checked)} />
        안쪽만 넓게
      </label>
      <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-auto", SCROLLER, scroll)}>
        <div className="w-full">
          <div style={{ width: wide ? "37.5rem" : undefined }}>
            <Rows many={many} className="border-b border-gray-300 px-4 py-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 가로 스크롤 경우 — 「가로로 길게」로 가로 스크롤바를 만들었다 없앤다.
 * `tall` 이 아니면 영역 높이가 내용에 맞춰져, 가로 스크롤바가 생길 때 아래 줄(▲)이 밀리는지 볼 수 있다.
 */
function Wide({
  variant,
  many,
  scroll,
  outer,
  area,
  tall = false,
  startWide = false,
}: {
  variant: Variant;
  many: boolean;
  scroll: string;
  outer?: string;
  area?: string;
  tall?: boolean;
  /** 처음부터 가로로 길게 — 열자마자 가로 스크롤바가 보이게. */
  startWide?: boolean;
}) {
  const [wide, setWide] = useState(startWide);

  return (
    <div className={cn(BOX, OUTER, outer)}>
      <label className="flex items-center gap-1 body5 text-gray-900">
        <input type="checkbox" checked={wide} onChange={(event) => setWide(event.target.checked)} />
        가로로 길게
      </label>
      <div
        data-scrollbar={marker(variant)}
        className={cn("overflow-auto", tall && "min-h-0 flex-1", SCROLLER, area, scroll)}
      >
        <div style={{ width: wide ? "37.5rem" : undefined }}>
          <Rows many={tall && many} />
        </div>
      </div>
      {!tall && <p className={MARK}>▲ 이 줄이 밀리면 안 됨</p>}
    </div>
  );
}

/** 목록 옆의 빈 자리가, 옆 패널이 넓어져서 찬다 — 요소가 붙거나 class 가 바뀌지 않고 폭(인라인 style)만 바뀐다. */
function NeighborGrows({ variant, many, scroll }: { variant: Variant; many: boolean; scroll: string }) {
  const [wide, setWide] = useState(false);

  return (
    <div className={cn(BOX, "flex-row")}>
      <div className="flex min-h-0 w-40 flex-none flex-col py-2">
        <label className="flex items-center gap-1 body5 text-gray-900">
          <input type="checkbox" checked={wide} onChange={(event) => setWide(event.target.checked)} />
          옆 패널 넓게
        </label>
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
          <Rows many={many} />
        </div>
      </div>
      <div className={cn("ml-auto flex-none", OUTER)} style={{ width: wide ? "7.875rem" : "1rem" }} />
    </div>
  );
}

/** 목록 옆의 빈 자리를, 옆 패널이 크기는 그대로인 채 자리만 옮겨 와서 덮는다(transform). */
function NeighborMoves({ variant, many, scroll }: { variant: Variant; many: boolean; scroll: string }) {
  const [moved, setMoved] = useState(false);

  return (
    <div className={cn(BOX, "flex-row")}>
      <div className="flex min-h-0 w-40 flex-none flex-col py-2">
        <label className="flex items-center gap-1 body5 text-gray-900">
          <input type="checkbox" checked={moved} onChange={(event) => setMoved(event.target.checked)} />
          옆 패널 옮기기
        </label>
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
          <Rows many={many} />
        </div>
      </div>
      <div className={cn("ml-auto w-24 flex-none", OUTER)} style={{ transform: moved ? "translateX(-1.875rem)" : undefined }} />
    </div>
  );
}

type CaseDef = {
  title: string;
  desc: string;
  /** 「자동」 칸에서 전역 장치가 골라야 하는 방식과 그때 보여야 하는 모습. */
  expect: string;
  render: (variant: Variant, many: boolean, scroll: string) => ReactNode;
};

/** variant 별 `data-scrollbar` — 적용 전은 끄고, 자동은 아무것도 붙이지 않는다. */
function marker(variant: Variant) {
  return variant === "before" ? "off" : undefined;
}

const CASES: CaseDef[] = [
  {
    title: "A. 기본 — 스크롤 영역 자신에 여백",
    desc: "스크롤 영역에 px-6.",
    expect: "1 자기 여백 — 오른쪽 여백이 스크롤바 폭만큼 줄고, 스크롤바가 그 여백 자리에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-6 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-2", SCROLLER, scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "B. 바깥 여백 — 여백이 부모에 있음",
    desc: "부모 p-4, 스크롤 영역은 여백도 테두리도 배경색도 없는 틀.",
    expect: "3 바깥에 띄우기 — 스크롤 영역은 그대로고, 스크롤바만 내용 바로 옆(부모 여백의 왼쪽 끝)에 뜬다. 그 오른쪽에 보라 여백 5px 이 남는다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div
          data-scrollbar={marker(variant)}
          className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}
        >
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "B2. 바깥 여백 — 스크롤 영역이 테두리 있는 상자",
    desc: "부모 p-4, 스크롤 영역에 테두리와 배경색. 상자를 넓히면 한쪽으로 길어지므로 상자는 건드리지 않는다.",
    expect: "3 바깥에 띄우기 — 상자는 제자리에 있고(좌우 보라 여백 16 / 16), 스크롤바가 상자 테두리 바로 밖 보라 여백에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div
          data-scrollbar={marker(variant)}
          className={cn("min-h-0 flex-1 overflow-y-auto border-2 border-sky-500", SCROLLER, scroll)}
        >
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "B3. 바깥 여백 — 사이에 카드가 끼어 있음",
    desc: "부모 p-4, 그 안에 여백 없는 흰 카드, 카드 안에 꽉 찬 목록이 스크롤된다.",
    expect: "3 바깥에 띄우기 — 카드와 목록은 그대로고, 스크롤바가 카드 바로 밖 보라 여백에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col bg-primary-wt">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B4. 바깥 여백 — 사이에 낀 카드가 넘친 부분을 자름",
    desc: "B3 과 같고 카드에 overflow-hidden 이 있다. 넓히기로는 카드까지 같이 넓혀야 했다.",
    expect: "3 바깥에 띄우기 — 카드 폭은 그대로고(좌우 보라 여백 16 / 16), 스크롤바가 카드 바로 밖 보라 여백에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-primary-wt">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B6. 바깥 여백 — 사이에 낀 카드가 자르면서 흐림 효과가 걸려 있음",
    desc: "B4 와 같고 카드에 backdrop-blur 가 있다. 이런 카드는 화면 고정 상자의 기준 틀이 되어, 카드 밖에 띄운 스크롤바를 잘라 낸다.",
    expect: "4 겹치기 — 바깥에 띄우면 스크롤바가 통째로 잘려 안 보이므로, 카드 안 내용 위에 띄운다. 스크롤바가 보이고 끌 수 있어야 한다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-primary-wt backdrop-blur-sm">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B5. 바깥 여백 — 사이에 낀 카드에 굵은 테두리",
    desc: "B3 과 같고 카드에 2px 테두리가 있다. 목록의 끝과 바깥 여백 사이에 테두리 두께만큼 틈이 있다.",
    expect: "3 바깥에 띄우기 — 카드와 목록은 그대로고, 스크롤바가 카드 테두리 바로 밖 보라 여백에 뜬다(테두리 위에 걸치지 않는다).",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col border-2 border-sky-500 bg-primary-wt">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B7. 바깥 여백 — 사이에 낀 카드가 모양대로 오려 냄(clip-path)",
    desc: "B3 과 같고 카드에 clip-path: inset(0) 이 있다. 카드 밖으로 나간 것은 화면에 고정해 띄운 것까지 전부 안 보인다.",
    expect: "4 겹치기 — 바깥에 띄우면 스크롤바가 오려져 안 보이므로, 카드 안 내용 위에 띄운다. 스크롤바가 보여야 한다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col bg-primary-wt [clip-path:inset(0)]">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B8. 바깥 여백 — 사이에 낀 카드에 가림막(mask)",
    desc: "B3 과 같고 카드에 mask-image 가 있다. 가림막은 카드 상자 안만 보여 준다.",
    expect: "4 겹치기 — B7 과 같다. 스크롤바가 보여야 한다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div className="flex min-h-0 flex-1 flex-col bg-primary-wt [mask-image:linear-gradient(#000,#000)]">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B9. 바깥 여백 — 그 여백 안에 버튼이 떠 있음",
    desc: "B 와 같고, 부모의 오른쪽 여백 안(스크롤바가 놓일 자리)에 빨간 버튼이 떠 있다.",
    expect: "4 겹치기 — 스크롤바가 놓일 자리에 다른 요소가 있으므로 바깥에 띄우지 않고 내용 위에 띄운다. 빨간 버튼을 가리지 않는다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "relative p-4")}>
        <Mark />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
          <Rows many={many} />
        </div>
        <button type="button" aria-label="닫기" className="absolute right-1 top-16 size-3 bg-red-500" />
      </div>
    ),
  },
  {
    title: "B10. 바깥 여백 — 카드 전체를 덮는 장식 층이 있음",
    desc: "B 와 같고, 부모 전체를 덮는 옅은 파란 층(absolute inset-0)이 있다. 여백 안에 놓인 요소가 아니라 전체를 덮는 층이다.",
    expect: "3 바깥에 띄우기 — 전체를 덮는 층은 「자리를 차지한 요소」로 치지 않는다. B 와 같이 부모 여백에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "relative p-4")}>
        <div className="pointer-events-none absolute inset-0 bg-blue-500/10" />
        <Mark />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "B11. 바깥 여백 — 사이에 낀 카드의 테두리가 아주 굵음(16px)",
    desc: "B5 와 같고 카드 테두리가 16px 다. 바깥에 띄우면 스크롤바가 내용에서 16px 떨어진다.",
    expect: "4 겹치기 — 떨어뜨릴 거리가 한도(stayClose, 기본 12px)를 넘으므로 바깥에 띄우지 않고 내용 위에 띄운다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark className="px-4" />
        <div className="flex min-h-0 flex-1 flex-col border-[1rem] border-sky-500 bg-primary-wt">
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "B12. 바깥 여백 — 스크롤 영역 자신이 모양대로 오려 냄(clip-path)",
    desc: "B 와 같고 스크롤 영역 자신에 clip-path: inset(0) 이 있다(위아래 끝을 흐리게 하는 mask 도 같은 경우다). 영역 밖에 띄운 것은 영역 자신에 오려져 안 보인다.",
    expect: "4 겹치기 — 바깥에 띄우면 스크롤바가 안 보이므로 내용 위에 띄운다. 스크롤바가 보여야 한다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "p-4")}>
        <Mark />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto [clip-path:inset(0)]", scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "C. 가운데 정렬 — 좌우에 빈 자리",
    desc: "내용 폭 10rem 을 가운데에 둔다.",
    expect: "2 가운데 정렬 — 왼쪽에 스크롤바 폭만큼 여백이 생겨 내용이 가운데에 그대로 있다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="mx-auto w-40 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto py-2", SCROLLER, scroll)}>
          <div className="mx-auto w-40">
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "C2. 가운데 정렬 — 내용이 폭을 꽉 채움",
    desc: "안쪽 래퍼가 w-full px-4. 좁은 화면의 페이지 틀과 같은 구조.",
    expect: "2 가운데 정렬(꽉 참) — 안쪽 래퍼의 오른쪽 여백이 줄고, 스크롤바가 그 자리에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-4 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto py-2", SCROLLER, scroll)}>
          <div className={cn("mx-auto w-full max-w-[40rem] px-4", INNER)}>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "D. 목록 — 행이 가장자리까지 참 (여백 16px)",
    desc: "행 px-4 + 밑줄. 스크롤 영역에도 바깥에도 여백이 없다.",
    expect: "4 겹치기 — 원래 스크롤바가 사라지고 밑줄이 끝까지 간다. 손잡이만 행 위에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-4 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}>
          <Rows
            many={many}
            className="border-b border-gray-300 px-4 py-2"
          />
        </div>
      </div>
    ),
  },
  {
    title: "D2. 목록 — 행 여백이 스크롤바보다 좁음 (8px)",
    desc: "행 p-2. 행 여백이 스크롤바보다 좁다.",
    expect: "4 겹치기 — D 와 같다. 손잡이가 「끝|」 글자 일부 위에 겹친다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-2 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}>
          <Rows
            many={many}
            className="border-b border-gray-300 p-2"
          />
        </div>
      </div>
    ),
  },
  {
    title: "E. 여백 없음 — 격자가 가장자리까지 참",
    desc: "7칸 격자. 위 요일 줄과 세로선이 맞아야 한다.",
    expect: "4 겹치기 — 격자가 요일 줄과 맞고, 손잡이가 「토」 칸 위에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <div className="grid grid-cols-7 border-b border-gray-400 body5 text-red-600">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day} className="border-r border-gray-300 py-1 text-center last:border-r-0">
              {day}
            </span>
          ))}
        </div>
        <div
          data-scrollbar={marker(variant)}
          className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}
        >
          <div className="grid grid-cols-7">
            {Array.from({ length: many ? 70 : 14 }, (_, i) => (
              <span key={i} className={cn("h-10 border-b border-r border-gray-300 p-1 body5 text-gray-900 [&:nth-child(7n)]:border-r-0", CONTENT)}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "F. 중첩 — 스크롤 영역 안의 스크롤 영역",
    desc: "바깥 px-6, 안쪽 px-3. 줄이 적어도 바깥은 늘 스크롤된다.",
    expect: "1 자기 여백 — 바깥·안쪽이 각자 자기 여백을 줄인다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-6 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-2", SCROLLER, scroll)}>
          <Rows many={false} />
          <div
            data-scrollbar={marker(variant)}
            className={cn("my-2 h-20 overflow-y-auto rounded-[0.25rem] border border-gray-400 px-3 py-1", "bg-yellow-100", scroll)}
          >
            <Rows many={many} />
          </div>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "F2. 중첩 — 바깥 영역이 줄인 여백을 안쪽 영역도 쓰려 함",
    desc: "바깥 영역 안에 폭을 꽉 채운 틀(pr-5)이 하나 있고, 안쪽 영역(노랑)이 그 틀의 여백에 맞닿아 있다. 「줄 많게」로 둘이 같은 순간에 넘친다.",
    expect: "바깥은 2 가운데 정렬(꽉 참) — 틀의 오른쪽 여백을 줄여 자기 스크롤바를 받는다. 안쪽은 4 겹치기 — 그 여백은 바깥 영역이 이미 썼으므로(남은 폭이 스크롤바보다 좁다) 바깥에 띄우지 않는다. 두 스크롤바가 겹치지 않는다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="pr-5 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}>
          <div className={cn("pr-5", INNER)}>
            <div data-scrollbar={marker(variant)} className={cn("h-20 overflow-y-auto", "bg-yellow-100", scroll)}>
              <Rows many={many} />
            </div>
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "G. 가운데 기둥 안의 꽉 찬 목록 — 바깥이 빈 자리",
    desc: "폭 10rem 기둥을 가운데에 두고 목록이 기둥을 꽉 채운다. 여백은 없지만 기둥 오른쪽이 비어 있다.",
    expect: "3 바깥에 띄우기(빈 자리) — 스크롤 영역은 그대로고, 스크롤바가 기둥 바로 밖 빈 자리에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <div className="mx-auto flex min-h-0 w-40 flex-1 flex-col py-2">
          <Mark />
          <div
            data-scrollbar={marker(variant)}
            className={cn("min-h-0 flex-1 overflow-y-auto", scroll)}
          >
            <Rows many={many} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "G2. 오른쪽에 다른 요소가 붙어 있음 — 넓히면 안 됨",
    desc: "목록 바로 오른쪽에 패널이 있다. 빈 자리가 아니므로 넓히면 안 된다.",
    expect: "4 겹치기 — 스크롤바가 옆 패널(보라)을 침범하지 않고 목록 위에 뜬다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, "flex-row")}>
        <div className="flex min-h-0 w-40 flex-col py-2">
          <Mark />
          <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}>
            <Rows many={many} />
          </div>
        </div>
        <div className={cn("flex-1 p-2 text-[0.6875rem]", OUTER)}>옆 패널</div>
      </div>
    ),
  },
  // ── 좌우 여백이 다르게 적힌 코드 — 라이브러리가 어디까지 해 주는지 본다 ──
  {
    title: "G3. 옆 요소가 넓어져 빈 자리가 참",
    desc: "목록 오른쪽이 비어 있다가, 「옆 패널 넓게」를 켜면 보라 패널이 목록 바로 옆까지 넓어진다(폭만 바뀐다).",
    expect: "3 바깥에 띄우기(빈 자리) → 「옆 패널 넓게」를 켜면 4 겹치기로 바뀌어 패널을 침범하지 않고, 끄면 다시 바깥에 뜬다.",
    render: (variant, many, scroll) => <NeighborGrows variant={variant} many={many} scroll={scroll} />,
  },
  {
    title: "G4. 옆 요소가 자리만 옮겨 와 빈 자리를 덮음",
    desc: "목록 오른쪽이 비어 있다가, 「옆 패널 옮기기」를 켜면 보라 패널이 크기는 그대로인 채 목록 바로 옆으로 옮겨 온다(transform).",
    expect: "3 바깥에 띄우기(빈 자리) → 「옆 패널 옮기기」를 켜면 4 겹치기로 바뀌고, 끄면 다시 바깥에 뜬다.",
    render: (variant, many, scroll) => <NeighborMoves variant={variant} many={many} scroll={scroll} />,
  },
  {
    title: "H. 좌우 여백이 다른 요소에 — 왼쪽은 바깥, 오른쪽은 스크롤 영역",
    desc: "바깥 pl-4, 스크롤 영역 pr-4. 화면에서는 좌우 16 / 16 이다(스크롤바를 가장자리에 붙이려고 흔히 쓰는 구조).",
    expect: "1 자기 여백 — 스크롤바가 오른쪽 16 안에 뜨고, 좌우 16 / 16 이 그대로다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "pl-4")}>
        <Mark className="pr-4" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto pr-4", SCROLLER, scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "H2. 오른쪽에 여백을 더 얹음 — 얹은 값이 스크롤바보다 큼",
    desc: "바깥 px-4 인데 스크롤 영역이 pr-3 을 더 준다. 스크롤바가 없어도 왼쪽 16 / 오른쪽 28 이다.",
    expect: "1 자기 여백 — 안 밀린다. 하지만 오른쪽이 12 더 넓은 것은 그대로 남는다(라이브러리가 고치지 않는다 — 화면 코드에서 pr-3 을 지운다).",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "px-4")}>
        <Mark className="pr-3" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto pr-3", SCROLLER, scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "H3. 오른쪽에 여백을 더 얹음 — 얹은 값이 스크롤바보다 작음",
    desc: "바깥 px-4, 스크롤 영역 pr-1. 왼쪽 16 / 오른쪽 20 이다.",
    expect: "3 바깥에 띄우기 — 얹은 4 로는 모자라 스크롤바를 바깥 여백에 띄운다. 안 밀린다. 오른쪽이 4 더 넓은 것은 남는다.",
    render: (variant, many, scroll) => (
      <div className={cn(BOX, OUTER, "px-4")}>
        <Mark className="pr-1" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto pr-1", scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "H4. 한 요소에 좌우 값이 다르게 적힘",
    desc: "스크롤 영역 pl-6 pr-4. 왼쪽 24 / 오른쪽 16 이다.",
    expect: "1 자기 여백 — 안 밀린다. 왼쪽 24 / 오른쪽 16 은 그대로다(화면 코드에서 값을 맞춘다).",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="pl-6 pr-4 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-auto py-2 pl-6 pr-4", SCROLLER, scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "H5. 스크롤바 자리를 미리 잡음 — 오른쪽 여백 없음",
    desc: "pl-2 + scrollbar-gutter: stable. 오른쪽은 미리 잡힌 스크롤바 자리가 여백 노릇을 한다.",
    expect: "자리 비워 두기를 푼다 — 스크롤바가 없을 때 오른쪽 빈 자리가 사라진다(왼쪽 8 / 오른쪽 0). 스크롤바가 생기면 4 겹치기로 받아 내용이 그대로다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="pl-2 pr-[0.6875rem] pt-2" />
        <div
          data-scrollbar={marker(variant)}
          className={cn("min-h-0 flex-1 overflow-y-auto py-2 pl-2 [scrollbar-gutter:stable]", SCROLLER, scroll)}
        >
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "H6. 스크롤바 자리를 미리 잡음 — 좌우 여백 있음",
    desc: "px-6 + scrollbar-gutter: stable. 그대로 두면 왼쪽 24 / 오른쪽 24 + 스크롤바 폭이다.",
    expect: "자리 비워 두기를 푼다 — 스크롤바가 없을 때 빈 자리가 사라져 좌우 24 / 24. 스크롤바가 생기면 1 자기 여백으로 받아 그대로 24 / 24.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-6 pt-2" />
        <div
          data-scrollbar={marker(variant)}
          className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-2 [scrollbar-gutter:stable]", SCROLLER, scroll)}
        >
          <Rows many={many} />
        </div>
      </div>
    ),
  },
  {
    title: "I. 안쪽 요소만 넓어짐 — 바로 아래 자식의 크기는 그대로",
    desc: "D 와 같은 목록. 「안쪽만 넓게」를 켜면 두 겹 안쪽 요소만 37.5rem 으로 넓어져 가로로 넘친다.",
    expect: "4 겹치기 → 「안쪽만 넓게」를 켜면 가로 스크롤바가 내용 아래쪽 위에 같이 뜨고(세로는 그대로), 끄면 가로 스크롤바만 사라진다.",
    render: (variant, many, scroll) => <InnerWide variant={variant} many={many} scroll={scroll} />,
  },
  {
    title: "J. 가로 스크롤 — 스크롤 영역 자신에 아래 여백",
    desc: "스크롤 영역 pb-4, 높이는 내용에 맞춤. 「가로로 길게」를 켜면 가로 스크롤바가 생긴다.",
    expect: "가로 1 아래 여백 — 아래 여백이 스크롤바 높이만큼 줄고 스크롤바가 그 자리에 뜬다. 아래 줄(▲)이 안 밀린다.",
    render: (variant, many, scroll) => <Wide variant={variant} many={many} scroll={scroll} area="pb-4" />,
  },
  {
    title: "J2. 가로 스크롤 — 바깥 아래에 여백",
    desc: "부모 p-4, 스크롤 영역이 부모의 아래 여백에 맞닿아 있다.",
    expect: "가로 2 바깥에 띄우기 — 스크롤 영역은 그대로고, 가로 스크롤바가 영역 바로 아래 보라 여백에 뜬다.",
    render: (variant, _many, scroll) => <Wide variant={variant} many={false} scroll={scroll} outer="p-4" tall />,
  },
  {
    title: "J3. 가로 스크롤 — 여백 없음, 바로 아래에 다른 내용",
    desc: "스크롤 영역에도 바깥에도 아래 여백이 없고, 바로 아래에 줄이 붙어 있다.",
    expect: "가로 3 겹치기 — 가로 스크롤바가 마지막 줄 위에 뜨고, 아래 줄(▲)이 안 밀린다.",
    render: (variant, many, scroll) => <Wide variant={variant} many={many} scroll={scroll} />,
  },
  {
    title: "K. 세로·가로 둘 다 — 오른쪽 바깥에만 여백",
    desc: "부모 pr-4. 「줄 많게」로 세로, 「가로로 길게」로 가로 스크롤바를 만든다.",
    expect: "세로는 3 바깥에 띄우기(오른쪽 보라 여백) — 가로 넘침과 상관없이 같은 자리에 있다. 가로는 축을 따로 본다: 상자 아래로 맞닿은 여백이 있으면 그 여백에(이 화면에서 K 가 맨 아랫줄이면 상자 테두리 바로 아래, 페이지 아래 여백), 없으면 내용 아래쪽 위에 겹친다.",
    render: (variant, many, scroll) => <Wide variant={variant} many={many} scroll={scroll} outer="pr-4" tall />,
  },
  {
    title: "K2. 먼 바깥 여백 — 상자 두 겹을 지나 바깥 틀의 아래 여백에 뜸",
    desc: "K 의 상자를 노란 테두리 틀(여백 없음)이 감싸고, 그 바깥 회색 틀에만 아래 여백 24px 이 있다. 세 틀의 아래 끝이 모두 맞닿아 있다.",
    expect: "가로 스크롤바가 자기 상자(회색 테두리)와 노란 틀을 둘 다 건너, 맨 바깥 회색 틀의 아래 여백에 뜬다. 사이에 다른 요소 없이 테두리만 있으면 몇 겹이든 건넌다 — 건넌 테두리 두께의 합(1 + 4 = 5px)이 한도(stayClose, 기본 12px) 이하라서다. 한도를 넘으면 B11 처럼 내용 위에 겹친다.",
    render: (variant, many, scroll) => (
      <div className="bg-gray-300 pb-6">
        <div className="border-4 border-yellow-500">
          <Wide variant={variant} many={many} scroll={scroll} outer="pr-4" tall startWide />
        </div>
      </div>
    ),
  },
  {
    title: "L. 직접 조절 — data-scrollbar=\"manual\"",
    desc: "스크롤 영역에 여백이 없고 행마다 px-4. 「자동」 칸은 manual 표시를 붙이고, 행의 오른쪽 여백을 calc(1rem − var(--sbw)) 로 직접 받는다.",
    expect: "원래 스크롤바가 그대로 뜨고(띄우지 않는다), 행의 오른쪽 여백이 스크롤바 폭만큼 줄어 내용이 안 밀린다. 밑줄은 스크롤바 앞에서 끝난다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-4 pt-2" />
        <div
          data-scrollbar={variant === "before" ? "off" : "manual"}
          className={cn("min-h-0 flex-1 overflow-y-auto", SCROLLER, scroll)}
        >
          <Rows many={many} className="border-b border-gray-300 py-2 pl-4 pr-[calc(1rem_-_var(--sbw,0px))]" />
        </div>
      </div>
    ),
  },
  {
    title: "M. 스크롤바 항상 띄우기(overflow-y: scroll) — 여백 없음",
    desc: "D 와 같은 목록인데 내용이 짧아도 스크롤바를 늘 띄우게 해 둔 영역. 「적용 전」 칸은 줄이 적어도 빈 스크롤바가 보인다.",
    expect: "보통 영역과 같다 — 줄이 적으면 스크롤바도 막대도 없고(행의 오른쪽 끝까지 눌린다), 줄이 많으면 4 겹치기로 뜬다. 내용 폭은 두 경우가 같다.",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-4 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-scroll", SCROLLER, scroll)}>
          <Rows many={many} className="border-b border-gray-300 px-4 py-2" />
        </div>
      </div>
    ),
  },
  {
    title: "M2. 스크롤바 항상 띄우기(overflow-y: scroll) — 자기 여백 있음",
    desc: "M 과 같고 스크롤 영역에 px-4 가 있다. 넘치면 그 여백을 줄여 받는 구조다.",
    expect: "줄이 적으면 스크롤바의 빈 띠가 안 보이고(굴릴 것이 없다), 줄이 많으면 1 자기 여백으로 받는다. 내용 자리는 두 경우가 같다(좌우 16 / 16).",
    render: (variant, many, scroll) => (
      <div className={BOX}>
        <Mark className="px-4 pt-2" />
        <div data-scrollbar={marker(variant)} className={cn("min-h-0 flex-1 overflow-y-scroll px-4", SCROLLER, scroll)}>
          <Rows many={many} />
        </div>
      </div>
    ),
  },
];

/** 이 브라우저에서 스크롤바가 차지하는 폭 — 0 이면 겹쳐 뜨는 환경이라 강제 스크롤바를 켜야 차이가 보인다. */
function useNativeScrollbarWidth() {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
    document.body.appendChild(probe);
    setWidth(probe.offsetWidth - probe.clientWidth);
    probe.remove();
  }, []);

  return width;
}

function TestBench({ only, startMany = false }: { only?: string[]; startMany?: boolean }) {
  const [many, setMany] = useState(startMany);
  const cases = only ? CASES.filter((c) => only.some((id) => c.title.startsWith(`${id}. `))) : CASES;
  const [forced, setForced] = useState(true);
  const [debug, setDebug] = useState(false);
  const nativeWidth = useNativeScrollbarWidth();
  const scroll = forced ? FORCED_SCROLLBAR : "";

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-gray-150 p-6">
      <MrScroll />
      {/* 진단 표시 — 위에 깔린 것에 설정만 다른 것을 하나 더 둔다(나중에 둔 것의 설정을 쓴다). */}
      {debug && <MrScroll debug />}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-gray-400 bg-primary-wt p-3">
        <button type="button" className="rounded-[0.25rem] border border-primary-bk bg-primary-bk px-3 py-1.5 body4 text-primary-wt" onClick={() => setMany(!many)}>
          {many ? "줄 적게 (스크롤바 없애기)" : "줄 많게 (스크롤바 만들기)"}
        </button>
        <button type="button" className="rounded-[0.25rem] border border-gray-400 bg-primary-wt px-3 py-1.5 body4 text-gray-900" onClick={() => setForced(!forced)}>
          {forced ? "강제 스크롤바 끄기" : "강제 스크롤바 켜기 (11px)"}
        </button>
        <button type="button" className="rounded-[0.25rem] border border-gray-400 bg-primary-wt px-3 py-1.5 body4 text-gray-900" onClick={() => setDebug(!debug)}>
          {debug ? "진단 표시 끄기" : "진단 표시 켜기"}
        </button>
        <p className="body4 text-gray-800">
          이 브라우저의 스크롤바 폭: {nativeWidth === null ? "…" : `${nativeWidth}px`}
          {nativeWidth === 0 && " — 겹쳐 뜨는 환경이라, 강제 스크롤바를 켜야 차이가 보인다"}
        </p>
        <p className="w-full body4 text-gray-700">
          보는 법 — 상자 위 빨간 ▼ 는 「내용이 있어야 할 자리」다. 스크롤바가 생겨도 내용의 양 끝(|)이 ▼ 바로 아래에 그대로 있으면 안 밀린 것,
          ▼ 에서 벗어나면 밀린 것이다.
        </p>
        <div className="flex w-full flex-wrap items-center gap-4 body4 text-gray-900">
          {[
            [OUTER, "바깥 영역(부모)의 여백"],
            [SCROLLER, "스크롤 영역 — 자기 여백"],
            [INNER, "행·안쪽 래퍼의 여백"],
            [CONTENT, "내용"],
            ["bg-yellow-100", "안쪽 스크롤 영역(중첩)"],
            ["bg-gray-500", "스크롤바 (겹치기에서는 배경 없이 손잡이만)"],
          ].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn("size-4 rounded-[0.125rem] border border-gray-400", color)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[16rem_repeat(2,18rem)] items-start gap-x-6 gap-y-8">
        <span />
        {VARIANTS.map((v) => (
          <div key={v.key} className="flex flex-col">
            <span className="headline5 font-medium text-primary-bk">{v.label}</span>
            <span className="body5 text-gray-700">{v.hint}</span>
          </div>
        ))}
        {cases.map((c) => (
          <div key={c.title} className="contents">
            <div className="flex flex-col gap-1">
              <span className="headline6 font-medium text-primary-bk">{c.title}</span>
              <span className="body5 text-gray-700">{c.desc}</span>
              <span className="body5 font-medium text-blue-600">자동: {c.expect}</span>
            </div>
            {VARIANTS.map((v) => (
              <div key={v.key}>{c.render(v.key, many, scroll)}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 주소로 고른다 — `?only=K,K2`(그 경우만) · `?many=1`(처음부터 줄 많게). */
export function Bench() {
  const q = new URLSearchParams(location.search);
  const only = q.get("only")?.split(",").filter(Boolean);

  return <TestBench only={only?.length ? only : undefined} startMany={q.get("many") === "1"} />;
}
