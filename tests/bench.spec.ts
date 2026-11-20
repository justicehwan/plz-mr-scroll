import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { MODES, many, open, settle, type Mode } from './helpers'

/** 「테스트 화면」(playground/bench.html)의 경우마다, 「자동」 칸이 골라야 하는 세로 방식(스크롤바 11px 기준). 스크롤 영역이 둘이면 바깥·안쪽 순. */
const EXPECT: Record<string, string[]> = {
  A: ['pad'],
  B: ['outside'],
  B2: ['outside'],
  B3: ['outside'],
  B4: ['outside'],
  B6: ['overlay'],
  B5: ['outside'],
  B7: ['overlay'],
  B8: ['overlay'],
  B9: ['overlay'],
  B10: ['outside'],
  B11: ['overlay'],
  B12: ['overlay'],
  C: ['center'],
  C2: ['center'],
  D: ['overlay'],
  D2: ['overlay'],
  E: ['overlay'],
  F: ['pad', 'pad'],
  F2: ['center', 'overlay'],
  G: ['outside'],
  G2: ['overlay'],
  G3: ['outside'],
  G4: ['outside'],
  H: ['pad'],
  H2: ['pad'],
  H3: ['outside'],
  H4: ['pad'],
  H5: ['overlay'],
  H6: ['pad'],
  L: ['manual'],
  M: ['overlay'],
  M2: ['pad'],
}
const BASIC = Object.keys(EXPECT)
const TOLERANCE = 0.6

type Leaf = { l: number; r: number }
type Area = {
  nativeW: number
  nativeH: number
  vertical: string
  horizontal: string
  overlay: boolean
  gutter: string
  inline: string
  ghostV: { l: number; t: number; w: number; h: number } | null
  ghostH: { l: number; t: number; w: number; h: number } | null
  leaves: Leaf[]
  markerTop: number | null
  box: { w: number; h: number; l: number }
  overflowsX: boolean
  overflowsY: boolean
}
type Snapshot = Record<string, { before: Area[]; auto: Area[] }>

const collect = (page: Page, ids: string[]) =>
  page.evaluate((list) => Object.fromEntries(list.map((id) => [id, (window as any).__sb.collect(id)])), ids) as Promise<Snapshot>
const exercise = (page: Page, id: string, index = 0) =>
  page.evaluate(([i, n]) => (window as any).__sb.exercise(i, n), [id, index] as const) as Promise<Record<string, any>>
/** 두 상태에서 같은 내용 요소의 좌우 끝이 가장 많이 움직인 거리(px). */
const shift = (a: Leaf[], b: Leaf[]) => {
  const n = Math.min(a.length, b.length)
  let max = 0
  for (let i = 0; i < n; i += 1) max = Math.max(max, Math.abs(a[i].l - b[i].l), Math.abs(a[i].r - b[i].r))
  return +max.toFixed(2)
}
/** 내용의 왼쪽 시작 자리가 움직인 거리 — 내용 폭을 일부러 바꾸는 경우(가로로 길게)에 쓴다. */
const shiftLeft = (a: Leaf[], b: Leaf[]) => (a.length && b.length ? +Math.abs(a[0].l - b[0].l).toFixed(2) : 0)
/**
 * 바깥에 띄운 세로 스크롤바가 화면에 실제로 그려지는가 — 맨 위와 맨 아래로 굴렸을 때 그 자리를 찍어 비교한다.
 * 손잡이가 보이면 두 그림이 다르다. 조상에 잘리거나 가려져 안 보이면 같다. (자리값과 누름 판정만으로는 가림막에 가린 것을 못 잡는다.)
 */
const painted = async (page: Page, id: string, index: number) => {
  const box = (top: number) => page.evaluate(([i, n, t]) => (window as any).__sb.ghostBox(i, n, t), [id, index, top] as const)
  const first = await box(0)
  if (!first || first.width < 2 || first.height < 2) return false
  const a = await page.screenshot({ clip: first })
  const second = await box(1)
  const b = second ? await page.screenshot({ clip: second }) : a
  await box(0)
  return !a.equals(b)
}
const dump = (name: string, data: unknown) => {
  fs.mkdirSync('test-results/measure', { recursive: true })
  fs.writeFileSync(`test-results/measure/${name}.json`, JSON.stringify(data, null, 1))
}

for (const mode of ['native', 'thin', 'forced11', 'w17'] as Mode[]) {
  test.describe(`스크롤바 ${mode}`, () => {
    test.beforeEach(({}, info) => {
      test.skip(!MODES[info.project.name].includes(mode), '이 엔진에서는 이 방식으로 스크롤바를 띄울 수 없다')
    })

    test('세로 경우 A~H6·L — 밀림 0, 고른 방식, 띄운 스크롤바, 되돌아옴', async ({ page }, info) => {
      await open(page, mode)
      const base = await collect(page, BASIC)
      // M — 스크롤바를 늘 띄우는 영역도, 굴릴 것이 없으면 띄운 막대가 없어야 한다(있으면 보이지 않는 막대가 내용 끝의 누름을 가로챈다).
      if (base.M.before[0].nativeW > 0) {
        const hit = await page.evaluate(() => (window as any).__sb.edgeHit('M'))
        expect.soft(hit, 'M 굴릴 것이 없는데 내용 오른쪽 끝을 띄운 막대가 가로챔').toBe(true)
        expect.soft(base.M.auto[0].ghostV, 'M 굴릴 것이 없는데 세로 막대가 떠 있음').toBeNull()
        // M2 — 자기 여백으로 받는 구조도, 굴릴 것이 없으면 원래 스크롤바의 빈 띠가 보이지 않아야 한다.
        expect.soft(base.M2.auto[0].nativeW, 'M2 굴릴 것이 없는데 스크롤바의 빈 띠가 보임').toBe(0)
      }
      await many(page, true)
      await settle(page)
      const after = await collect(page, BASIC)
      const rows: Record<string, unknown>[] = []
      for (const id of BASIC) {
        for (let i = 0; i < after[id].auto.length; i += 1) {
          const off = after[id].before[i]
          const auto = after[id].auto[i]
          const width = off.nativeW
          const row: Record<string, unknown> = {
            id,
            i,
            width,
            shiftOff: shift(base[id].before[i].leaves, off.leaves),
            shiftAuto: shift(base[id].auto[i].leaves, auto.leaves),
            // 스크롤바가 없을 때 장치를 켠 것과 끈 것의 내용 자리 차이 — 0 이어야 「기본 레이아웃을 안 바꾼다」
            idleDiff: shift(base[id].before[i].leaves, base[id].auto[i].leaves),
            method: auto.vertical,
            horizontal: auto.horizontal,
            gutter: auto.gutter,
            ghostV: auto.ghostV,
          }
          if (auto.vertical === 'outside' || auto.vertical === 'overlay' || auto.horizontal !== 'none') {
            Object.assign(row, await exercise(page, id, i))
          }
          if (auto.vertical === 'outside') row.painted = await painted(page, id, i)
          rows.push(row)
          const label = `${id}#${i}`
          if (width === 0) {
            // 겹쳐 뜨는 스크롤바 — 아무것도 하지 않아야 한다.
            expect.soft(auto.overlay, `${label} 폭 0 인데 스크롤바를 띄움`).toBe(false)
            expect.soft(auto.vertical, `${label} 폭 0 인데 손댐`).toBe('none')
            continue
          }
          // L(manual)은 행의 여백을 `calc(16px - var(--sbw))` 로 직접 받는다 — 스크롤바가 16px 보다 굵으면 음수가 되어 그 선언이 무시된다(쓰는 쪽이 max() 로 막을 일).
          if (!(id === 'L' && width > 16)) {
            expect.soft(row.shiftAuto as number, `${label} 스크롤바가 생길 때 내용이 밀림`).toBeLessThanOrEqual(TOLERANCE)
          }
          // 스크롤바가 없고 자리도 비워 두지 않은 평소 상태에서는 장치를 켠 것과 끈 것이 같아야 한다.
          // (F 처럼 바깥 영역이 늘 스크롤되면 끈 쪽은 이미 밀려 있다 — 그 칸의 영역이 전부 스크롤바 없는 상태일 때만 본다.)
          if (base[id].before.every((area) => area.nativeW === 0)) {
            expect.soft(row.idleDiff as number, `${label} 스크롤바가 없는데 장치가 내용 자리를 바꿈`).toBeLessThanOrEqual(TOLERANCE)
          }
          if (mode === 'forced11' || (mode === 'thin' && width === 11)) {
            expect.soft(auto.vertical, `${label} 고른 방식`).toBe(EXPECT[id][i])
          }
          if (auto.vertical === 'outside' || auto.vertical === 'overlay') {
            const hit = row.hitV as { shadow: boolean; doc: boolean; docTag: string } | null
            expect.soft(hit?.shadow, `${label} 띄운 세로 스크롤바가 그 자리에서 안 잡힘(잘렸거나 숨음)`).toBe(true)
            expect.soft(hit?.doc, `${label} 띄운 세로 스크롤바가 다른 요소에 가려짐: ${hit?.docTag}`).toBe(true)
            expect.soft(Math.abs((row.vFollows as number) - 60), `${label} 내용을 굴려도 손잡이가 안 따라옴`).toBeLessThanOrEqual(1)
            expect.soft(Math.abs((row.vLeads as number) - 120), `${label} 손잡이를 움직여도 내용이 안 따라옴`).toBeLessThanOrEqual(1)
            expect.soft(auto.ghostV?.w, `${label} 띄운 스크롤바 폭`).toBe(width)
            if (auto.vertical === 'outside') {
              expect.soft(row.painted, `${label} 바깥에 띄운 스크롤바가 화면에 안 그려짐(잘렸거나 가려짐)`).toBe(true)
            }
          }
        }
      }
      await many(page, false)
      await settle(page)
      const back = await collect(page, BASIC)
      for (const id of BASIC) {
        for (let i = 0; i < back[id].auto.length; i += 1) {
          const moved = shift(base[id].auto[i].leaves, back[id].auto[i].leaves)
          expect.soft(moved, `${id}#${i} 스크롤바가 사라진 뒤 내용이 제자리로 안 돌아옴`).toBeLessThanOrEqual(TOLERANCE)
          expect.soft(back[id].auto[i].vertical, `${id}#${i} 스크롤바가 사라졌는데 처리 흔적이 남음`).toBe(base[id].auto[i].vertical)
        }
      }
      // G3·G4 — 빈 자리에 띄운 뒤 옆 패널이 그 자리를 채우면(G3: 넓어짐, G4: 크기는 그대로인 채 옮겨 옴) 겹치기로 바뀌고,
      // 다시 비면 바깥으로 돌아와야 한다.
      await many(page, true)
      await settle(page)
      for (const id of ['G3', 'G4']) {
        const flip = async () => {
          await page.evaluate((i) => (window as any).__sb.toggle(i, 'auto'), id)
          await settle(page)
          return (await collect(page, [id]))[id].auto[0]
        }
        const start = (await collect(page, [id]))[id].auto[0]
        if (start.nativeW !== 0 || start.vertical !== 'outside') continue
        const covered = await flip()
        expect.soft(covered.vertical, `${id} 옆 패널이 빈 자리를 채웠는데 스크롤바가 그 위에 남음`).toBe('overlay')
        const freed = await flip()
        expect.soft(freed.vertical, `${id} 옆 패널이 다시 비켰는데 바깥으로 안 돌아옴`).toBe('outside')
        rows.push({ id: `${id}-채움`, method: covered.vertical, back: freed.vertical })
      }
      await many(page, false)
      await settle(page)
      dump(`vertical-${info.project.name}-${mode}`, rows)
      for (const r of rows) {
        console.log(
          `[v] ${info.project.name} ${mode} ${String(r.id).padEnd(3)}#${r.i} S=${r.width} 끔=${r.shiftOff} 켬=${r.shiftAuto} 평소차=${r.idleDiff} 방식=${r.method}${r.gutter ? ' gutter→' + r.gutter : ''}${r.painted === undefined ? '' : ' 그려짐=' + r.painted}${r.back ? ' 되돌아옴=' + r.back : ''}`,
        )
      }
    })

    test('가로 경우 I·J·J2·J3·K — 아래 줄 밀림 0, 가로 스크롤바 자리', async ({ page }, info) => {
      await open(page, mode)
      const ids = ['I', 'J', 'J2', 'J3', 'K']
      const base = await collect(page, ids)
      const rows: Record<string, unknown>[] = []
      const flip = async (id: string) => {
        await page.evaluate((i) => {
          ;(window as any).__sb.toggle(i, 'before')
          ;(window as any).__sb.toggle(i, 'auto')
        }, id)
        await settle(page)
      }
      // 줄이 적은 상태에서 가로만 — J(아래 여백)·J2(바깥 아래)·J3(겹치기)
      for (const id of ['J', 'J2', 'J3']) {
        await flip(id)
        const now = (await collect(page, [id]))[id]
        const off = now.before[0]
        const auto = now.auto[0]
        const height = off.nativeH
        const markerOff = off.markerTop === null ? null : +(off.markerTop - base[id].before[0].markerTop!).toFixed(2)
        const markerAuto = auto.markerTop === null ? null : +(auto.markerTop - base[id].auto[0].markerTop!).toFixed(2)
        const row: Record<string, unknown> = {
          id,
          height,
          markerOff,
          markerAuto,
          leavesAuto: shiftLeft(base[id].auto[0].leaves, auto.leaves),
          boxOff: off.box.h - base[id].before[0].box.h,
          boxAuto: auto.box.h - base[id].auto[0].box.h,
          horizontal: auto.horizontal,
          vertical: auto.vertical,
          ghostH: auto.ghostH,
          ghostV: auto.ghostV,
        }
        if (auto.horizontal === 'outside' || auto.horizontal === 'overlay') Object.assign(row, await exercise(page, id))
        rows.push(row)
        if (height === 0) {
          expect.soft(auto.overlay, `${id} 가로 스크롤바 높이 0 인데 띄움`).toBe(false)
        } else {
          if (markerAuto !== null) expect.soft(Math.abs(markerAuto), `${id} 가로 스크롤바가 생길 때 아래 줄이 밀림`).toBeLessThanOrEqual(TOLERANCE)
          expect.soft(Math.abs(row.boxAuto as number), `${id} 가로 스크롤바가 생길 때 스크롤 영역 높이가 바뀜`).toBeLessThanOrEqual(TOLERANCE)
          expect.soft(row.leavesAuto as number, `${id} 내용이 좌우로 움직임`).toBeLessThanOrEqual(TOLERANCE)
          expect.soft(auto.vertical, `${id} 세로로 안 넘치는데 세로 스크롤바를 띄움`).toBe('none')
          expect.soft(auto.ghostV, `${id} 세로로 안 넘치는데 세로 상자가 떠 있음(누름을 가로챈다)`).toBeNull()
          if (mode === 'forced11' || (mode === 'thin' && height === 11)) {
            expect.soft(auto.horizontal, `${id} 가로 방식`).toBe({ J: 'pad', J2: 'outside', J3: 'overlay' }[id])
          }
          if (auto.horizontal === 'outside' || auto.horizontal === 'overlay') {
            const hit = row.hitH as { shadow: boolean; doc: boolean; docTag: string } | null
            expect.soft(hit?.shadow, `${id} 띄운 가로 스크롤바가 그 자리에서 안 잡힘`).toBe(true)
            expect.soft(hit?.doc, `${id} 띄운 가로 스크롤바가 가려짐: ${hit?.docTag}`).toBe(true)
            expect.soft(Math.abs((row.hFollows as number) - 40), `${id} 가로로 굴려도 손잡이가 안 따라옴`).toBeLessThanOrEqual(1)
            expect.soft(Math.abs((row.hLeads as number) - 90), `${id} 가로 손잡이를 움직여도 내용이 안 따라옴`).toBeLessThanOrEqual(1)
          }
        }
        await flip(id)
        const restored = (await collect(page, [id]))[id].auto[0]
        expect.soft(restored.horizontal, `${id} 가로 넘침이 없어졌는데 가로 처리 흔적이 남음`).toBe('none')
        expect.soft(restored.ghostH, `${id} 가로 넘침이 없어졌는데 가로 상자가 떠 있음`).toBeNull()
      }
      // 줄이 많은 상태에서 가로를 더한다 — K(세로 바깥 + 가로)·I(세로 겹치기 + 안쪽만 넓어짐)
      await many(page, true)
      await settle(page)
      for (const id of ['K', 'I']) {
        const tall = (await collect(page, [id]))[id]
        await flip(id)
        const now = (await collect(page, [id]))[id]
        const auto = now.auto[0]
        const width = tall.before[0].nativeW
        const row: Record<string, unknown> = {
          id,
          width,
          height: now.before[0].nativeH,
          verticalBefore: tall.auto[0].vertical,
          vertical: auto.vertical,
          horizontal: auto.horizontal,
          ghostVBefore: tall.auto[0].ghostV,
          ghostV: auto.ghostV,
          ghostH: auto.ghostH,
          leavesFromFew: shiftLeft(base[id].auto[0].leaves, auto.leaves),
          leavesFromTall: shiftLeft(tall.auto[0].leaves, auto.leaves),
        }
        if (auto.overlay) Object.assign(row, await exercise(page, id))
        rows.push(row)
        if (width > 0) {
          expect.soft(row.leavesFromFew as number, `${id} 세로·가로 스크롤바가 다 생겼을 때 내용이 밀림`).toBeLessThanOrEqual(TOLERANCE)
          expect.soft(auto.vertical, `${id} 가로로 넘치자 세로 스크롤바 자리가 바뀜`).toBe(tall.auto[0].vertical)
          if (now.before[0].nativeH > 0) {
            expect.soft(['outside', 'overlay'], `${id} 가로 스크롤바를 못 띄움`).toContain(auto.horizontal)
            const hit = row.hitH as { shadow: boolean; doc: boolean; docTag: string } | null
            expect.soft(hit?.shadow, `${id} 띄운 가로 스크롤바가 그 자리에서 안 잡힘`).toBe(true)
            expect.soft(hit?.doc, `${id} 띄운 가로 스크롤바가 가려짐: ${hit?.docTag}`).toBe(true)
            const hitV = row.hitV as { shadow: boolean; doc: boolean; docTag: string } | null
            expect.soft(hitV?.shadow, `${id} 세로 스크롤바가 그 자리에서 안 잡힘`).toBe(true)
            expect.soft(Math.abs((row.vLeads as number) - 120), `${id} 세로 손잡이를 움직여도 내용이 안 따라옴`).toBeLessThanOrEqual(1)
            expect.soft(Math.abs((row.hLeads as number) - 90), `${id} 가로 손잡이를 움직여도 내용이 안 따라옴`).toBeLessThanOrEqual(1)
          }
        }
        await flip(id)
        const restored = (await collect(page, [id]))[id].auto[0]
        expect.soft(restored.horizontal, `${id} 가로 넘침이 없어졌는데 가로 처리 흔적이 남음`).toBe('none')
        expect.soft(restored.vertical, `${id} 가로 넘침이 없어진 뒤 세로 방식`).toBe(tall.auto[0].vertical)
      }
      dump(`horizontal-${info.project.name}-${mode}`, rows)
      for (const r of rows) console.log(`[h] ${info.project.name} ${mode} ${JSON.stringify(r)}`)
    })
  })
}

test('웹 컴포넌트 태그(이름에 - 가 든 태그)에는 shadow root 를 붙이지 않는다', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', '기본 스크롤바 폭 0 — 아무것도 하지 않는다')
  await open(page, 'native')
  // 정의가 아직 안 불러와진 웹 컴포넌트가 스크롤 영역인 경우 — 여백도 바깥 자리도 없어, 보통 태그였다면 겹치기로 갈 구조다.
  await page.evaluate(() => {
    const host = document.createElement('div')
    host.style.cssText = 'position:relative;z-index:50;display:flex;padding:40px;background:#fff'
    host.innerHTML =
      '<x-late-panel id="wc" style="display:block;flex:none;width:200px;height:100px;overflow-y:auto;background:#fed7aa"><div style="height:400px">내용</div></x-late-panel>' +
      '<div id="plain" style="flex:none;width:200px;height:100px;overflow-y:auto;background:#bbf7d0"><div style="height:400px">내용</div></div>' +
      '<div style="flex:none;width:100px;height:100px;background:#c4b5fd"></div>'
    document.body.prepend(host)
    window.scrollTo(0, 0)
  })
  await settle(page)
  const out = await page.evaluate(() => {
    const wc = document.getElementById('wc')!
    const plain = document.getElementById('plain')!
    let later = 'ok'
    try {
      // 나중에 컴포넌트 정의가 불러와져 자기 shadow root 를 붙이는 순간
      if (!wc.shadowRoot) wc.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>'
      else later = '이미 shadow root 가 붙어 있어 컴포넌트가 초기화되지 못한다'
    } catch (e) {
      later = String(e).slice(0, 80)
    }
    return { plainHasRoot: !!plain.shadowRoot, plainOverlay: plain.hasAttribute('data-scrollbar-overlay'), wcOverlay: wc.hasAttribute('data-scrollbar-overlay'), later }
  })
  console.log(`[wc] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out.plainHasRoot, '견줄 보통 태그는 겹치기로 가서 shadow root 가 붙어야 한다(시험 구조 확인)').toBe(true)
  expect.soft(out.later, '웹 컴포넌트 태그에 장치가 shadow root 를 먼저 붙임').toBe('ok')
  expect.soft(out.wcOverlay, '웹 컴포넌트 태그의 원래 스크롤바를 숨김').toBe(false)
})

test('중첩 — 바깥 영역과 안쪽 영역이 같은 순간에 다시 판별돼도, 안쪽은 바깥 영역이 줄여 둔 여백을 보고 판단한다', async ({ page, browserName }) => {
  // 폭을 차지하는 스크롤바가 필요하다 — WebKit 은 꾸민 17px, 나머지는 기본 15px.
  await open(page, browserName === 'webkit' ? 'w17' : 'native')
  await page.evaluate(() => {
    const host = document.createElement('div')
    host.style.cssText = 'position:relative;z-index:50;padding:40px;background:#fff'
    // 바깥 영역(O)은 꽉 찬 틀(W)의 오른쪽 여백 20px 을 줄여 자기 스크롤바를 받는다. 안쪽 영역(I)은 W 의 여백에 맞닿아 있고, 둘 다 처음부터 넘친다.
    host.innerHTML =
      '<div id="O" style="width:300px;height:200px;overflow-y:auto;background:#fed7aa"><div id="W" style="padding-right:20px">' +
      '<div id="I" style="height:80px;overflow-y:auto;background:#fef08a"><div id="Ic" style="height:300px">안쪽</div></div>' +
      '<div style="height:400px">바깥 내용</div></div></div>'
    document.body.prepend(host)
    window.scrollTo(0, 0)
  })
  await settle(page)
  const read = () =>
    page.evaluate(() => {
      const O = document.getElementById('O')!
      const I = document.getElementById('I')!
      const bar = I.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]')?.children[0] as HTMLElement | undefined
      const shown = !!bar && getComputedStyle(bar).display !== 'none'
      const b = shown ? bar!.getBoundingClientRect() : null
      const o = O.getBoundingClientRect()
      return {
        S: O.offsetWidth - O.clientWidth,
        틀여백: getComputedStyle(document.getElementById('W')!).paddingRight,
        안쪽스크롤바: !b ? '없음' : b.left >= I.getBoundingClientRect().right - 0.5 ? '바깥' : '안쪽',
        바깥영역스크롤바와겹침: !!b && b.right > o.right - (O.offsetWidth - O.clientWidth) + 0.5,
      }
    })
  const settled = await read()
  // 자리 잡은 뒤에, 두 영역을 같은 순간에 다시 판별시킨다 — 바깥 영역이 기대는 틀과 안쪽 영역의 내용을 한 번에 바꾼다
  // (늦게 뜨는 이미지로 페이지 높이가 바뀌는 동안 안쪽 영역도 다시 판별되는 상황과 같다).
  await page.evaluate(() => {
    document.getElementById('W')!.classList.toggle('touched')
    document.getElementById('Ic')!.classList.toggle('touched')
  })
  await settle(page)
  const out = await read()
  console.log(`[nested] ${browserName} 자리 잡은 뒤 ${JSON.stringify(settled)} → 같이 다시 판별된 뒤 ${JSON.stringify(out)}`)
  expect(out.S, '바깥 영역에 폭을 차지하는 스크롤바가 떠 있어야 한다(시험 구조 확인)').toBeGreaterThan(0)
  expect(settled.안쪽스크롤바, '처음에는 안쪽에 겹쳐야 한다(시험 구조 확인)').toBe('안쪽')
  expect.soft(out.안쪽스크롤바, '바깥 영역이 이미 쓴 여백에 안쪽 영역의 스크롤바를 띄움').toBe('안쪽')
  expect.soft(out.바깥영역스크롤바와겹침, '안쪽 영역의 스크롤바가 바깥 영역의 스크롤바 자리와 겹침').toBe(false)
})

test('진단 표시(debug) — 영역마다 고른 방식과 까닭이 적히고, 끄면 지워진다', async ({ page, browserName }) => {
  // 스크롤바 11px 로 본다(기대하는 방식을 11px 기준으로 적어 뒀다).
  await open(page, browserName === 'firefox' ? 'thin' : 'forced11')
  const plain = await collect(page, ['A'])
  expect((plain.A.auto[0] as any).debugMethod, '진단 표시를 켜기 전에는 표시가 없어야 한다').toBeNull()
  // 진단 표시를 켜도 고른 방식이 같아야 한다 — 끈 상태에서 먼저 재 둔다.
  await many(page, true)
  await settle(page)
  const off = await collect(page, BASIC)
  await page.getByRole('button', { name: '진단 표시 켜기' }).click()
  await settle(page)
  const on = await collect(page, BASIC)
  for (const id of BASIC) {
    on[id].auto.forEach((area, i) => {
      expect.soft(area.vertical, `${id}#${i} 진단 표시를 켜자 고른 방식이 바뀜`).toBe(off[id].auto[i].vertical)
    })
  }
  const NAME: Record<string, string> = { pad: 'padding' }
  const rows: string[] = []
  for (const id of BASIC) {
    on[id].auto.forEach((area, i) => {
      const a = area as any
      rows.push(`${id}#${i} ${a.debugMethod}${a.debugWhy ? ` (${a.debugWhy})` : ''}`)
      if (area.nativeW === 0 && !area.overlay) return
      const want = NAME[EXPECT[id][i]] ?? EXPECT[id][i]
      expect.soft(a.debugMethod, `${id}#${i} 진단 표시에 적힌 방식`).toBe(want)
      // 테스트가 여백 값과 막대 위치로 추측한 방식과도 같아야 한다.
      expect.soft(a.debugMethod, `${id}#${i} 진단 표시와 테스트의 추측`).toBe(NAME[area.vertical] ?? area.vertical)
    })
    // 「적용 전」 칸은 data-scrollbar="off" — 손대지 않았다고 적혀야 한다.
    expect.soft((on[id].before[0] as any).debugWhy, `${id} 끈 영역의 까닭`).toBe('off')
  }
  console.log(`[debug] ${browserName} ${rows.join(' · ')}`)
  // 화면 위에 따로 띄운 진단 층에 딱지가 그려지는가 — 스크롤 영역 안에는 아무것도 끼워 넣지 않는다.
  const layer = await page.evaluate(async () => {
    await (window as any).__sb.frames(3)
    const host = document.querySelector('[data-scrollbar-debug]')
    const all = (kind: string) => [...(host?.shadowRoot?.querySelectorAll<HTMLElement>(`.${kind}`) ?? [])]
    const labels = all('tag').map((s) => s.textContent ?? '')
    const blocks = document.elementFromPoint(200, 300) === host
    // A(자기 여백 줄이기) 영역 — 스크롤바 자리 띠가 영역 안 오른쪽 끝에, 원래 내용 자리 점선이 실제 내용 자리와 같은 곳에 그려지는가
    const a = (window as any).__sb.collect('A').auto[0]
    const cell = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith('A. '))!.parentElement!.parentElement!.children[2] as HTMLElement
    const area = [...cell.querySelectorAll<HTMLElement>('*')].find((n) => n.hasAttribute('data-scrollbar-method'))!
    const r = area.getBoundingClientRect()
    const near = (x: number, y: number) => Math.abs(x - y) <= 1
    const bar = all('bar').map((n) => n.getBoundingClientRect()).find((b) => near(b.right, r.right - area.clientLeft) && near(b.top, r.top + area.clientTop))
    const leaf = [...area.querySelectorAll<HTMLElement>('*')].find((n) => n.childElementCount === 0 && n.offsetWidth > 0)!.parentElement!.getBoundingClientRect()
    const content = all('content').map((n) => n.getBoundingClientRect()).find((c) => near(c.top, r.top + area.clientTop + parseFloat(getComputedStyle(area).paddingTop)) && c.left >= r.left && c.right <= r.right)
    return {
      labels,
      blocks,
      pointer: host ? getComputedStyle(host).pointerEvents : null,
      counts: { bar: all('bar').length, pad: all('pad').length, content: all('content').length },
      aBarWidth: bar ? bar.width : null,
      aNative: a.nativeW,
      aContent: content ? [Math.round(content.left - r.left), Math.round(r.right - content.right)] : null,
      aLeaf: [Math.round(leaf.left - r.left), Math.round(r.right - leaf.right)],
    }
  })
  expect.soft(layer.labels.length, '진단 층에 그려진 딱지 수').toBeGreaterThan(20)
  expect.soft(layer.labels.some((l) => l.includes('↕ outside')), '바깥에 띄운 영역의 딱지').toBe(true)
  expect.soft(layer.labels.some((l) => l.includes('outside-occupied')), '까닭이 적힌 딱지').toBe(true)
  expect.soft(layer.pointer, '진단 층이 누름을 가로채지 않아야 한다').toBe('none')
  expect.soft(layer.blocks, '진단 층이 화면의 누름을 받음').toBe(false)
  // 딱지에 스크롤바 굵기와 바꾼 값이 적히는가
  expect.soft(layer.labels.some((l) => /↕ padding · S 11 · padding-right 16 → 5/.test(l)), `자기 여백 영역의 딱지: ${layer.labels.find((l) => l.includes('↕ padding'))}`).toBe(true)
  expect.soft(layer.labels.some((l) => /↕ center · S 11 · padding-left 0 → 11/.test(l)), `가운데 정렬 영역의 딱지: ${layer.labels.find((l) => l.includes('↕ center'))}`).toBe(true)
  expect.soft(layer.labels.some((l) => /↕ outside · S 11 · gap 2/.test(l)), '굵은 테두리를 건넌 영역(B5)의 딱지에 떨어진 거리').toBe(true)
  // 스크롤바 자리 띠·바뀐 여백 띠·원래 내용 자리 점선이 그려지는가
  expect.soft(layer.counts.bar, '스크롤바 자리 띠 수').toBeGreaterThan(20)
  expect.soft(layer.counts.pad, '바뀐 여백 띠 수').toBeGreaterThan(3)
  expect.soft(layer.counts.content, '원래 내용 자리 점선 수').toBeGreaterThan(20)
  expect.soft(layer.aBarWidth, 'A 의 스크롤바 자리 띠는 원래 스크롤바가 있는 자리(안쪽 오른쪽 끝)에 그 굵기로').toBe(layer.aNative)
  expect.soft(layer.aContent, 'A 의 원래 내용 자리 점선은 실제 내용이 놓인 자리와 같아야 한다').toEqual(layer.aLeaf)
  console.log(`[debug-layer] ${browserName} ${JSON.stringify({ counts: layer.counts, a: [layer.aBarWidth, layer.aContent, layer.aLeaf] })} ${layer.labels.slice(0, 6).join(' / ')}`)
  // 겹치기로 간 까닭이 구조에 맞게 적히는가
  const why = (id: string) => (on[id].auto[0] as any).debugWhy
  expect.soft(why('G2'), 'G2 옆 패널에 막힘').toBe('outside-occupied')
  expect.soft(why('B9'), 'B9 여백 안의 버튼에 막힘').toBe('outside-occupied')
  expect.soft(why('B11'), 'B11 떨어지는 거리가 한도를 넘음').toBe('outside-gap-over-limit')
  expect.soft(why('B7'), 'B7 오려 내는 카드에 잘림').toBe('outside-clipped-or-unanchored')
  // 진단 표시를 켜도 판별 결과는 같아야 한다 — 내용이 밀리지 않았는가
  await many(page, false)
  await settle(page)
  const few = await collect(page, BASIC)
  for (const id of BASIC) {
    few[id].auto.forEach((area, i) => {
      if (on[id].auto[i].nativeW === 0 && !on[id].auto[i].overlay) return
      if (id === 'L' || id === 'M' || id === 'F' || id.startsWith('H5') || id.startsWith('H6')) return
      const moved = shift(area.leaves, on[id].auto[i].leaves)
      expect.soft(moved, `${id}#${i} 진단 표시를 켠 상태에서 스크롤바가 생길 때 내용이 밀림`).toBeLessThanOrEqual(TOLERANCE)
    })
  }
  await page.getByRole('button', { name: '진단 표시 끄기' }).click()
  await settle(page)
  const left = await page.evaluate(() => document.querySelectorAll('[data-scrollbar-method],[data-scrollbar-method-x],[data-scrollbar-why]').length)
  expect.soft(left, '진단 표시를 끈 뒤 남은 표시').toBe(0)
  expect.soft(await page.evaluate(() => document.querySelectorAll('[data-scrollbar-debug]').length), '진단 표시를 끈 뒤 남은 진단 층').toBe(0)
})

test('띄운 스크롤바 위에서 굴리면, 그 막대가 못 받는 방향의 굴림이 스크롤 영역으로 넘어간다', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', '마우스 휠 흉내는 Chromium 에서만 본다')
  await open(page, 'forced11')
  await many(page, true)
  await settle(page)
  // K — 세로는 바깥, 가로는 내용 위에 띄운 영역. 가로 막대 위에서 세로로 굴린다.
  await page.evaluate(() => (window as any).__sb.toggle('K', 'auto'))
  await settle(page)
  const at = await page.evaluate(async () => {
    const head = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith('K. '))!
    const cell = head.parentElement!.parentElement!.children[2] as HTMLElement
    const el = [...cell.querySelectorAll<HTMLElement>('*')].find((n) => n.hasAttribute('data-scrollbar-overlay'))!
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    await (window as any).__sb.frames(4)
    ;(window as any).__k = el
    const bar = el.shadowRoot!.querySelector<HTMLElement>('[data-scrollbar-ghost]')!.children[1].getBoundingClientRect()
    return { x: bar.left + 20, y: bar.top + bar.height / 2 }
  })
  await page.mouse.move(at.x, at.y)
  await page.mouse.wheel(0, 80)
  await page.waitForTimeout(300)
  const plain = await page.evaluate(() => ({ top: (window as any).__k.scrollTop, zoom: window.devicePixelRatio }))
  expect.soft(plain.top, '가로 막대 위에서 세로로 굴렸는데 내용이 안 움직임').toBeGreaterThan(40)
  // Ctrl+휠(확대·축소)은 굴림으로 넘기지 않는다.
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 80)
  await page.keyboard.up('Control')
  await page.waitForTimeout(300)
  const held = await page.evaluate(() => (window as any).__k.scrollTop)
  expect.soft(held, 'Ctrl+휠을 굴림으로 넘김').toBe(plain.top)
})
