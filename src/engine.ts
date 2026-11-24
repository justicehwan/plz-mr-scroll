/**
 * 장치의 몸통 — 스크롤 영역을 찾아 지켜보다가, 스크롤바가 생기고 사라지거나 둘레가 바뀌면 다시 판별해(`plan.ts`) 그 결과를 화면에 쓴다.
 * 쓴 것은 요소마다 적어 두어, 다시 판별하기 전과 장치가 내려갈 때 남김없이 되돌린다.
 */

import { createBars } from "./bars.js";
import { config, isExcluded } from "./config.js";
import {
  DEBUG_ATTRIBUTE,
  GHOST_ATTRIBUTE,
  LOOP_ERROR,
  METHOD_ATTRIBUTE,
  METHOD_X_ATTRIBUTE,
  NUDGE_ATTRIBUTE,
  OVERLAY_ATTRIBUTE,
  PAGE_GHOST_ATTRIBUTE,
  STYLE_PROPS,
  UNDO_ATTRIBUTE,
  WHY_ATTRIBUTE,
} from "./constants.js";
import { createDebug } from "./debug.js";
import { follow, ghosts, noOutside } from "./ghost.js";
import { isScroller, isStyleSheet, overflowOf, px, revivedWrong, scrollbarHeightOf, scrollbarWidthOf, scrolls } from "./measure.js";
import { followsViewport, planFor } from "./plan.js";
import type { Applied, DebugInfo } from "./types.js";

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

export function start() {
  const applied = new WeakMap<HTMLElement, Applied[]>();
  /** 페이지 전체의 판별이 바꾼 요소 → 바꾼 직후, 화면 오른쪽 끝에서 그 요소의 내용 끝까지의 거리. 스크롤을 잠근 코드가 스크롤바 자리를 대신 채웠는지 가릴 때 견준다. */
  const insets = new WeakMap<HTMLElement, number>();
  const rightInset = (target: HTMLElement) => {
    const style = getComputedStyle(target);

    return window.innerWidth - (target.getBoundingClientRect().right - px(style.borderRightWidth) - px(style.paddingRight));
  };
  /** 영역 → 마지막으로 되돌린 값들. 되돌린 뒤에 그 값이 다시 나타나면(바깥 코드가 예전 style 을 통째로 되살림) 우리 값이지 원래 값이 아니다. */
  const released = new WeakMap<HTMLElement, Applied[]>();
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
  noOutside.clear();
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
  const { showOverlay, hideOverlay, watchChildren, unwatchChildren, followPage, dispose: disposeBars } = createBars(
    (els) => sync(els),
    () => stopped,
  );

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
    /** 이번에는 되돌리지 않고 쥐고 있을 값 — 아래 「잠근 코드가 대신 채웠다」 참고. */
    const heldBy = new Map<HTMLElement, Applied[]>();
    for (const el of els) {
      const mine = applied.get(el) ?? [];
      // 쥔 것이 없는데 지난번에 되돌린 값이 다시 적혀 있다 — 바깥 코드가 예전 style 을 통째로 되살린 것이다(모달을 닫으며 `body` 의 style 을 되돌리는 코드).
      // 그대로 두면 그 값을 원래 값으로 알고 그 위에 또 더한다. 원래 값으로 돌려놓고 판별한다.
      if (mine.length === 0) {
        for (const { target, prop, author, applied: value } of released.get(el) ?? []) {
          if (target.isConnected && value !== author && target.style[prop] === value) target.style[prop] = author;
        }
      }
      // 잠근 코드가 대신 채웠다 — 창 스크롤바가 사라졌는데(페이지 스크롤을 잠금) 그 요소의 내용 오른쪽 끝이 그대로면,
      // 잠근 코드가 스크롤바 자리만큼 여백을 더해 준 것이다. 우리 값까지 되돌리면 둘이 같이 움직여 내용이 밀린다 —
      // 그 요소의 값은 쥐고 있다가 스크롤바가 돌아왔을 때 되돌린다. 쓰기 전에 한꺼번에 잰다.
      const locked = el === document.body && mine.length > 0 && scrollbarWidthOf(el) === 0;
      const kept = new Set(
        locked
          ? mine.map(({ target }) => target).filter((target) => {
              const before = insets.get(target);

              return before !== undefined && target.isConnected && Math.abs(rightInset(target) - before) <= 1;
            })
          : [],
      );
      const held = mine.filter(({ target }) => kept.has(target));
      const freed = mine.filter(({ target }) => !kept.has(target));
      for (const { target, prop, author, applied: value } of freed) {
        // 우리가 쓴 값 그대로일 때만 되돌린다 — 그 사이 다른 코드가 바꿨으면 그 값이 원래 값이다.
        if (target.style[prop] === value) target.style[prop] = author;
        dropUndo(target, `${prop}=${author}`);
      }
      if (freed.length > 0) released.set(el, freed);
      if (held.length > 0) heldBy.set(el, held);
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
      // 페이지 전체도 같다 — 꾸민 창 스크롤바가 되살아나지 않았으면(굴릴 것이 있고 잠겨 있지도 않은데 폭이 0) `html` 의 overflow 를 잠깐 바꿨다 돌려놓는다.
      if (floated && el === document.body && window.innerWidth - host.clientWidth < 2 && host.scrollHeight - host.clientHeight > 1) {
        const locked = [host, el].some((box) => /hidden|clip/.test(getComputedStyle(box).overflowY));
        if (!locked) {
          host.setAttribute(NUDGE_ATTRIBUTE, "");
          void host.offsetHeight;
          host.removeAttribute(NUDGE_ATTRIBUTE);
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
      if (el === document.body) for (const { target } of done) insets.set(target, rightInset(target));
    });
    for (const [el, held] of heldBy) applied.set(el, [...held, ...(applied.get(el) ?? [])]);
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
  const scan = (root: Element, overlaid: Set<HTMLElement>) => {
    // 창 스크롤바가 그대로 떠 있는 동안 새로 붙거나 모양이 바뀐 요소가 화면 폭을 따라 놓이는 것이면(화면에 고정한 버튼 등),
    // 페이지 전체를 다시 판별해 그 요소의 몫을 정한다.
    const pageBar = observed.has(document.body) && scrollbarWidthOf(document.body) > 0;
    walk(root, (el) => {
      if (pageBar && !overlaid.has(document.body) && followsViewport(el)) overlaid.add(document.body);
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
  };
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
      noOutside.clear();
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
        // 속성과 스타일시트로 페이지 스크롤을 잠그면 `body` 크기가 그대로일 수 있다 — 화면에 고정한 요소의 몫을 다시 보게 페이지 전체를 다시 판별한다.
        // 창 스크롤바가 그대로 떠 있거나 페이지 전체에 써 둔 값이 있을 때만이다(그 밖에는 다시 볼 몫이 없다 — 테마 전환 같은 속성 변화마다 문서를 훑지 않는다).
        const page = document.body;
        if (
          (target === page || target === document.documentElement) &&
          observed.has(page) &&
          ((applied.get(page)?.length ?? 0) > 0 || scrollbarWidthOf(page) > 0)
        ) {
          again.add(page);
        }
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
      followPage();

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

  const { startDebug, cancelDebug } = createDebug(debugInfo, () => stopped);
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
    noOutside.clear();
    cancelDebug();
    mutationObserver.disconnect();
    styleObserver.disconnect();
    contentObserver.disconnect();
    borderObserver.disconnect();
    neighborObserver.disconnect();
    window.removeEventListener("resize", scheduleScan);
    cancelAnimationFrame(rescan);
    window.removeEventListener("error", swallowLoopError, true);
    document.removeEventListener("scroll", followScroll, { capture: true });
    document.removeEventListener("load", onLoad, true);
    document.removeEventListener("animationend", retryAnchor, true);
    document.removeEventListener("transitionend", retryAnchor, true);
    disposeBars();
    restoreAll();
  };

  return { stop, refresh };
}
