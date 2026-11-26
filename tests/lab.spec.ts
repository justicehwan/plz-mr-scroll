import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BASE } from './helpers'

/**
 * 다른 프로젝트를 흉내 낸 페이지 12개 — 스크롤 영역마다 스크롤바를 억지로 만들어 내용이 밀리는지 잰다.
 * 영역마다: 넘치지 않는 상태에서 내용 자리를 재고 → 첫 자식의 최소 높이를 늘려 넘치게 한 뒤 → 다시 잰다.
 * (자식을 더하거나 영역의 여백을 늘리면 측정이 왜곡된다 — 첫 자식의 높이만 늘린다.)
 */
const PAGES = [
  'app-chat', 'app-dashboard', 'app-mail', 'app-settings',
  'doc-blog', 'doc-landing', 'doc-market', 'doc-techdocs',
  'odd-browser', 'odd-legacy', 'odd-patchwork', 'odd-widgets',
]
const url = (page: string, lib: boolean, sb: number, rtl = false) => `${BASE}/#page=${page}&lib=${lib ? 1 : 0}&sb=${sb}&notes=0${rtl ? '&rtl=1' : ''}`
const TOLERANCE = 0.6

type Row = {
  key: string
  width: number
  shift: number
  forced: boolean
  attachable: boolean
  /** 방식을 잰 순간에 세로나 가로로 넘치고 있었는가. */
  overflowing: boolean
  method: string
  note: string
}

async function sweep(page: Page): Promise<Row[]> {
  return page.evaluate(async () => {
    const px = (v: string) => parseFloat(v) || 0
    // 창이 가려지면 화면 갱신 신호가 멈춘다 — 신호가 안 오면 시간으로 넘어간다(helpers.ts 와 같다).
    const frame = () =>
      new Promise<void>((done) => {
        let finished = false
        const end = () => {
          if (finished) return
          finished = true
          done()
        }
        requestAnimationFrame(end)
        setTimeout(end, 120)
      })
    const frames = async (n = 3) => {
      for (let i = 0; i < n; i += 1) await frame()
    }
    const scrollsY = (el: Element) => /auto|scroll/.test(getComputedStyle(el).overflowY)
    const all = ([...document.querySelectorAll('body *')] as HTMLElement[]).filter(
      (el) => !(el instanceof HTMLTextAreaElement) && scrollsY(el) && el.clientHeight > 24 && el.clientWidth > 24 && !el.closest('.lab-bar'),
    )
    const rows: Row[] = []
    const leavesOf = (el: HTMLElement) =>
      ([...el.querySelectorAll('*')] as HTMLElement[])
        .filter((n) => n.childElementCount === 0 && n.offsetWidth > 0 && n.offsetHeight > 0)
        .slice(0, 8)
    // 글자가 있으면 글자가 놓인 자리를 잰다 — 상자의 여백을 줄여 내용 자리를 지키는 방식에서는 상자 끝은 움직여도 글자는 그대로다.
    const snap = (nodes: HTMLElement[]) =>
      nodes.map((n) => {
        const text = [...n.childNodes].find((c) => c.nodeType === 3 && c.textContent!.trim() !== '')
        if (!text) {
          const b = n.getBoundingClientRect()
          return [b.left, b.right]
        }
        const range = document.createRange()
        range.selectNodeContents(text)
        const b = range.getBoundingClientRect()
        return [b.left, b.right]
      })
    const overflows = (el: HTMLElement) => el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1
    const methodOf = (el: HTMLElement) => {
      const anchor = el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]')
      const v = anchor?.children[0] as HTMLElement | undefined
      const h = anchor?.children[1] as HTMLElement | undefined
      const on = (b?: HTMLElement) => !!anchor && !!b && getComputedStyle(anchor).display !== 'none' && getComputedStyle(b).display !== 'none'
      const shown = on(v)
      if (el.hasAttribute('data-scrollbar-overlay') && shown) {
        return v!.getBoundingClientRect().left >= el.getBoundingClientRect().right - 0.5 ? 'outside' : 'overlay'
      }
      if (el.hasAttribute('data-scrollbar-overlay') && on(h)) {
        return h!.getBoundingClientRect().top >= el.getBoundingClientRect().bottom - 0.5 ? '가로-outside' : '가로-overlay'
      }
      if (el.hasAttribute('data-scrollbar-overlay')) return 'hidden-only'
      if (el.style.marginRight) return 'widen'
      if (el.style.paddingLeft) return 'center'
      if (el.style.paddingRight) return 'pad'
      if (el.querySelector('[data-scrollbar-undo]')) return 'center-child'
      return 'none'
    }
    for (const [index, el] of all.entries()) {
      const key = `${index}:${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`
      const style = getComputedStyle(el)
      const already = el.scrollHeight - el.clientHeight > 1
      const first = ([...el.children] as HTMLElement[]).find((c) => c.offsetHeight > 0 && getComputedStyle(c).position !== 'absolute')
      if (already || !first) {
        rows.push({ key, width: 0, shift: 0, forced: false, attachable: true, overflowing: overflows(el), method: methodOf(el), note: already ? '이미 넘쳐 있음' : '늘릴 자식 없음' })
        continue
      }
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
      await frames()
      const nodes = leavesOf(el)
      const a = snap(nodes)
      const author = first.style.minHeight
      first.style.minHeight = `${el.clientHeight + 400}px`
      await frames(4)
      const forced = el.scrollHeight - el.clientHeight > 1
      const b = snap(nodes)
      let shift = 0
      for (let i = 0; i < a.length; i += 1) shift = Math.max(shift, Math.abs(a[i][0] - b[i][0]), Math.abs(a[i][1] - b[i][1]))
      const width = el.offsetWidth - el.clientWidth - px(style.borderLeftWidth) - px(style.borderRightWidth)
      const method = methodOf(el)
      const overflowing = overflows(el)
      let attachable = true
      if (!el.shadowRoot) {
        try { document.createElement(el.tagName).attachShadow({ mode: 'open' }) } catch { attachable = false }
      }
      first.style.minHeight = author
      await frames(4)
      const c = snap(nodes)
      let back = 0
      for (let i = 0; i < a.length; i += 1) back = Math.max(back, Math.abs(a[i][0] - c[i][0]), Math.abs(a[i][1] - c[i][1]))
      rows.push({ key, width, shift: +shift.toFixed(2), forced, attachable, overflowing, method, note: back > 0.6 ? `되돌린 뒤 ${back.toFixed(2)} 어긋남` : '' })
    }
    return rows
  })
}

// 같은 페이지를 글 방향만 오른쪽에서 왼쪽으로 바꿔 한 번 더 잰다 — 스크롤 영역의 세로 스크롤바가 왼쪽에 뜬다.
for (const [id, rtl] of PAGES.flatMap((id) => [[id, false], [id, true]] as const)) {
  test(`${id}${rtl ? ' (RTL)' : ''} — 스크롤바가 생길 때 밀림`, async ({ page, browserName }, info) => {
    // Firefox 는 ::-webkit-scrollbar 를 몰라 폭 강제가 안 먹는다 — 창을 띄운 Firefox 의 기본 15px 로 잰다.
    const sb = browserName === 'firefox' ? 15 : 15
    const errors: string[] = []
    page.on('pageerror', (e) => { if (!String(e).includes('ResizeObserver loop')) errors.push(String(e).slice(0, 160)) })
    await page.goto(url(id, false, sb, rtl))
    await page.waitForTimeout(700)
    const off = await sweep(page)
    await page.goto('about:blank')
    await page.goto(url(id, true, sb, rtl))
    await page.waitForTimeout(700)
    const on = await sweep(page)
    const rows = on.map((row) => ({ ...row, shiftOff: off.find((o) => o.key === row.key)?.shift ?? null }))
    fs.mkdirSync('test-results/measure', { recursive: true })
    fs.writeFileSync(`test-results/measure/lab-${info.project.name}-${id}${rtl ? '-rtl' : ''}.json`, JSON.stringify(rows, null, 1))
    for (const r of rows) {
      console.log(`[lab${rtl ? '-rtl' : ''}] ${info.project.name} ${id} ${r.key.padEnd(34)} 끔=${String(r.shiftOff).padEnd(5)} 켬=${String(r.shift).padEnd(5)} 방식=${r.method.padEnd(12)}${r.attachable ? '' : ' (띄울 수 없는 태그)'} ${r.note}`)
    }
    expect.soft(errors, `${id} 실행 오류`).toEqual([])
    for (const r of rows) {
      // 굴릴 것이 없으면 원래 스크롤바(늘 띄워 둔 빈 띠)만 숨기고 아무것도 띄우지 않는 것이 맞다 — 넘치는데 띄운 것이 없으면 스크롤바가 사라진 것이다.
      if (r.overflowing) {
        expect.soft(r.method, `${id} ${r.key} 넘치는데 원래 스크롤바만 숨기고 띄운 것이 없음`).not.toBe('hidden-only')
      }
      if (!r.forced) continue
      // 끈 상태에서 스크롤바 폭보다 훨씬 많이 움직였으면, 높이를 늘린 것 자체가 배치를 바꾼 것이다(떠 있는 요소의 줄바꿈 등) — 잴 수 없는 영역.
      if (r.shiftOff !== null && r.shiftOff > 30) continue
      // 스크롤바를 띄울 수 없는 태그(ul·table 등)에서 받을 자리가 없으면 손대지 않는다 — 알려진 한계라 따로 센다.
      if (!r.attachable && r.method === 'none') continue
      // 「상세 패널」은 페이지가 직접 스크롤바 폭을 재서 왼쪽 여백에 더하는 영역이다 — 장치가 원래 스크롤바를 숨겨도 그 스크립트가 잰 값이 남아
      // 왼쪽 여백이 한 번 더 들어간다. 두 장치가 같은 여백을 다루는 구조의 알려진 한계(리드미 「적용 시 권장사항」).
      if (id === 'odd-patchwork' && r.key.includes('odd-patchwork-detail__scroll')) continue
      // WebKit 은 글 방향이 오른쪽에서 왼쪽이고 가로로도 넘치는 영역에 세로 스크롤바가 생기면, 엔진이 가로 스크롤 위치를 스크롤바 폭만큼 옮긴다
      // (장치를 꺼도 같고, 스크롤바가 사라져도 돌아오지 않는다) — 장치가 받을 밀림이 아니다.
      if (rtl && browserName === 'webkit' && id === 'app-dashboard' && r.key.includes('app-dashboard-table-box')) continue
      expect.soft(r.shift, `${id} ${r.key} 스크롤바가 생길 때 내용이 밀림 (방식 ${r.method})`).toBeLessThanOrEqual(TOLERANCE)
    }
  })

  test(`${id}${rtl ? ' (RTL)' : ''} — 장치를 끄면 흔적이 남지 않음`, async ({ page }) => {
    await page.goto(url(id, true, 15, rtl))
    await page.waitForTimeout(700)
    const applied = await page.evaluate(() => document.querySelectorAll('[data-scrollbar-undo],[data-scrollbar-overlay]').length)
    await page.evaluate((next) => { location.hash = next.split('#')[1] }, url(id, false, 15, rtl))
    await page.waitForTimeout(500)
    const left = await page.evaluate(() => {
      const ghosts = ([...document.querySelectorAll('*')] as HTMLElement[])
        .map((el) => el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]'))
        .filter((g): g is HTMLElement => !!g)
      return {
        undo: document.querySelectorAll('[data-scrollbar-undo]').length,
        overlay: document.querySelectorAll('[data-scrollbar-overlay]').length,
        vars: document.querySelectorAll('[style*="--sbw"],[style*="--sbh"]').length,
        pageGhost: document.querySelectorAll('[data-scrollbar-ghost-page]').length,
        visibleGhosts: ghosts.filter((g) => getComputedStyle(g).display !== 'none').length,
        hideRule: [...document.querySelectorAll('style')].filter((s) => s.textContent?.includes('data-scrollbar-overlay')).length,
      }
    })
    console.log(`[off] ${id} 켰을 때 손댄 요소 ${applied} → 끈 뒤 ${JSON.stringify(left)}`)
    expect.soft(left, `${id} 끈 뒤 남은 것`).toEqual({ undo: 0, overlay: 0, vars: 0, pageGhost: 0, visibleGhosts: 0, hideRule: 0 })
  })
}

test('페이지 전체 — 스크롤바를 늘 띄우는 페이지도 굴릴 것이 없으면 띄운 막대가 없다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox 는 페이지 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다 — 아래에서 기본 폭으로 따로 본다')
  await page.goto(url('app-chat', true, 15))
  await page.waitForTimeout(600)
  await page.evaluate(() => { document.documentElement.style.overflowY = 'scroll' })
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const root = document.documentElement
    const ghost = document.querySelector<HTMLElement>('[data-scrollbar-ghost-page]')
    const hit = document.elementFromPoint(window.innerWidth - 3, window.innerHeight / 2)
    return {
      scrollable: root.scrollHeight - root.clientHeight > 1,
      hidden: root.hasAttribute('data-scrollbar-overlay'),
      ghostShown: !!ghost && getComputedStyle(ghost).display !== 'none',
      hitIsGhost: !!ghost && hit === ghost,
    }
  })
  console.log(`[page] ${browserName} ${JSON.stringify(out)}`)
  expect(out.scrollable, '이 시험은 굴릴 것이 없는 페이지에서 해야 한다').toBe(false)
  expect.soft(out.hitIsGhost, '굴릴 것이 없는데 화면 오른쪽 끝을 띄운 막대가 가로챔').toBe(false)
  expect.soft(out.ghostShown, '굴릴 것이 없는데 페이지 막대가 떠 있음').toBe(false)
})

for (const gap of [undefined, 40]) {
  test(`옵션 stayClose — ${gap === undefined ? '기본값(12px)이면 16px 떨어진 자리에는 안 띄운다' : '40 으로 주면 16px 떨어진 자리에도 띄운다'}`, async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
    await page.goto(url('app-settings', true, 11) + (gap === undefined ? '' : `&gap=${gap}`))
    await page.waitForTimeout(600)
    await page.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;width:320px;padding:0 24px 0 0;background:#e9d5ff'
      // 스크롤 영역을 16px 테두리 카드가 여백 없이 감싸고, 그 바깥 틀에 오른쪽 여백 24px 이 있다.
      host.innerHTML = '<div style="border:16px solid #0ea5e9;background:#fff"><div id="gap-area" style="height:120px;overflow-y:auto"><div style="height:500px">내용</div></div></div>'
      document.body.appendChild(host)
    })
    await page.waitForTimeout(400)
    const where = await page.evaluate(() => {
      const el = document.getElementById('gap-area')!
      const bar = el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]')?.children[0] as HTMLElement | undefined
      if (!bar || getComputedStyle(bar).display === 'none') return '없음'
      return bar.getBoundingClientRect().left >= el.getBoundingClientRect().right - 0.5 ? '바깥' : '안쪽'
    })
    console.log(`[gap] ${browserName} stayClose=${gap ?? '기본'} → ${where}`)
    expect(where).toBe(gap === undefined ? '안쪽' : '바깥')
  })
}

test('옵션 exclude — 선택자에 걸린 구역 아래는 건드리지 않고, 그 밖은 그대로 처리한다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  const build = () => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;display:flex;gap:40px;background:#fff;padding:20px'
    // 외부 위젯(마크업에 손댈 수 없다고 치는 구역) 안의 스크롤 영역과, 같은 구조의 바깥 영역
    host.innerHTML =
      '<div class="third-party"><div><div id="in-widget" style="box-sizing:border-box;width:200px;height:100px;overflow-y:auto;padding:0 16px"><div style="height:400px">위젯 안</div></div></div></div>' +
      '<div id="plain" style="box-sizing:border-box;width:200px;height:100px;overflow-y:auto;padding:0 16px"><div style="height:400px">바깥</div></div>'
    document.body.appendChild(host)
  }
  const read = () =>
    page.evaluate(() => {
      const state = (id: string) => {
        const el = document.getElementById(id)!
        return { 원래스크롤바: el.offsetWidth - el.clientWidth, 오른쪽여백: getComputedStyle(el).paddingRight, 표시: [...el.attributes].filter((a) => a.name.startsWith('data-scrollbar')).map((a) => a.name).join(',') }
      }
      return { widget: state('in-widget'), plain: state('plain') }
    })
  await page.goto(url('app-settings', true, 11) + `&exclude=${encodeURIComponent('.third-party')}`)
  await page.waitForTimeout(500)
  await page.evaluate(build)
  await page.waitForTimeout(400)
  const out = await read()
  console.log(`[exclude] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out.plain.오른쪽여백, '바깥 영역은 여백을 줄여 받아야 한다(시험 구조 확인)').toBe('5px')
  expect.soft(out.widget.오른쪽여백, '제외한 구역 안의 영역을 건드림').toBe('16px')
  expect.soft(out.widget.원래스크롤바, '제외한 구역 안의 원래 스크롤바가 그대로 있어야 한다').toBe(11)
  expect.soft(out.widget.표시, '제외한 구역 안의 영역에 표시를 붙임').toBe('')
  // 제외 선택자 없이 같은 구조 — 위젯 안도 처리된다(제외가 실제로 효과가 있었다는 견줌)
  await page.goto('about:blank')
  await page.goto(url('app-settings', true, 11))
  await page.waitForTimeout(500)
  await page.evaluate(build)
  await page.waitForTimeout(400)
  expect.soft((await read()).widget.오른쪽여백, '제외하지 않으면 위젯 안도 처리된다').toBe('5px')
})

/** 본체의 빌드 결과물 — 시험장 서버가 레포 폴더의 파일을 `/@fs/<절대 경로>` 로 내준다. */
const CORE = '/@fs' + path.resolve('dist/esm/index.js')

test('React 없이 — installMrScroll() 로 설치하고, 돌려받은 함수로 걷는다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  // 라이브러리(React 컴포넌트)를 끈 페이지에서, 본체 파일만 불러 직접 설치한다.
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;background:#fff;padding:20px'
    host.innerHTML = '<div id="vanilla" style="box-sizing:border-box;width:200px;height:100px;overflow-y:auto;padding:0 16px"><div style="height:400px">내용</div></div>'
    document.body.appendChild(host)
    const el = document.getElementById('vanilla')!
    const pad = () => getComputedStyle(el).paddingRight
    const before = pad()
    const core = await import(/* @vite-ignore */ path)
    const uninstall = core.installMrScroll({ debug: true })
    await wait(300)
    const installed = { pad: pad(), method: el.getAttribute('data-scrollbar-method') }
    uninstall()
    uninstall() // 두 번 걷어도 문제없어야 한다
    await wait(200)
    return {
      exports: Object.keys(core).sort(),
      before,
      installed,
      after: { pad: pad(), marks: [...el.attributes].filter((a) => a.name.startsWith('data-scrollbar')).length, layer: document.querySelectorAll('[data-scrollbar-debug]').length },
    }
  }, CORE)
  console.log(`[vanilla] ${browserName} ${JSON.stringify(out)}`)
  expect(out.exports).toEqual(['installMrScroll'])
  expect.soft(out.before).toBe('16px')
  expect.soft(out.installed, '설치하면 영역을 처리한다').toEqual({ pad: '5px', method: 'padding' })
  expect.soft(out.after, '걷으면 되돌린다').toEqual({ pad: '16px', marks: 0, layer: 0 })
})

test('본체 파일은 React 를 불러오지 않는다', async ({ page }) => {
  const source = await (await page.request.get(BASE + CORE)).text()
  // Vite 가 내보내는 변환된 파일에서 import 하는 모듈을 본다.
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1])
  expect(imports.filter((name) => /react/i.test(name))).toEqual([])
})

for (const suppress of [true, false]) {
  test(`옵션 quiet — ${suppress ? '기본값이면 브라우저 알림이 나중에 등록된 리스너에 닿지 않는다' : 'false 면 닿는다'}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '알림이 나는 시점이 엔진마다 달라 Chromium 에서만 본다')
    await page.goto(url('app-dashboard', true, 11) + (suppress ? '' : '&suppress=0'))
    await page.waitForTimeout(600)
    // 라이브러리보다 나중에 등록한 리스너 — 오류 수집 도구가 붙는 자리와 같다.
    await page.evaluate(() => {
      ;(window as any).__loops = 0
      window.addEventListener('error', (event) => {
        if (String((event as ErrorEvent).message).startsWith('ResizeObserver loop')) (window as any).__loops += 1
      })
    })
    // 스크롤바를 만들어, 장치가 그 자리에서 여백을 고치게 한다(브라우저가 알림을 남기는 상황).
    await page.getByRole('button', { name: '그룹 모두 펼치기' }).click()
    await page.getByRole('button', { name: '로그 4줄 추가' }).click()
    await page.getByRole('button', { name: '로그 4줄 추가' }).click()
    await page.waitForTimeout(500)
    const loops = await page.evaluate(() => (window as any).__loops)
    console.log(`[loop] ${suppress ? '가로챔(기본)' : '가로채지 않음'} → 나중 리스너가 받은 알림 ${loops}건`)
    if (suppress) expect(loops).toBe(0)
    else expect(loops).toBeGreaterThan(0)
  })
}

test('옵션 exclude — 바깥 스크롤 영역이 제외한 구역의 여백을 줄이지 않는다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  const build = () => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;background:#fff;padding:20px'
    // 바깥 스크롤 영역 안에, 폭을 꽉 채운 외부 위젯(오른쪽 여백 20px)이 하나 있다 — 가운데 정렬(꽉 참) 판별이 그 여백을 줄이려 드는 구조.
    host.innerHTML = '<div id="outer" style="width:240px;height:120px;overflow-y:auto"><div class="third-party" id="widget" style="padding-right:20px"><div style="height:400px">위젯</div></div></div>'
    document.body.appendChild(host)
  }
  const pad = () => page.evaluate(() => getComputedStyle(document.getElementById('widget')!).paddingRight)
  await page.goto(url('app-settings', true, 11))
  await page.waitForTimeout(500)
  await page.evaluate(build)
  await page.waitForTimeout(400)
  expect.soft(await pad(), '제외하지 않으면 그 여백을 줄여 받는다(시험 구조 확인)').toBe('9px')
  await page.goto('about:blank')
  await page.goto(url('app-settings', true, 11) + `&exclude=${encodeURIComponent('.third-party')}`)
  await page.waitForTimeout(500)
  await page.evaluate(build)
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const widget = document.getElementById('widget')!
    return { pad: getComputedStyle(widget).paddingRight, marks: [...widget.attributes].filter((a) => a.name.startsWith('data-scrollbar')).length }
  })
  console.log(`[exclude-center] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out, '제외한 구역의 여백을 바깥 영역이 건드림').toEqual({ pad: '20px', marks: 0 })
})

test('옵션 stayClose — 음수처럼 쓸 수 없는 값은 기본값으로 친다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  await page.goto(url('app-settings', true, 11) + '&gap=-5')
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;width:320px;padding:0 24px 0 0;background:#e9d5ff'
    host.innerHTML = '<div id="gap-area" style="height:120px;overflow-y:auto"><div style="height:500px">내용</div></div>'
    document.body.appendChild(host)
  })
  await page.waitForTimeout(400)
  const where = await page.evaluate(() => {
    const el = document.getElementById('gap-area')!
    const bar = el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]')?.children[0] as HTMLElement | undefined
    if (!bar || getComputedStyle(bar).display === 'none') return '없음'
    return bar.getBoundingClientRect().left >= el.getBoundingClientRect().right - 0.5 ? '바깥' : '안쪽'
  })
  expect(where, '한도가 음수라고 떨어진 거리 0 인 자리까지 막으면 안 된다').toBe('바깥')
})

test('설치 — 쓸 수 없는 환경에서는 조용히 아무것도 하지 않고, 그 뒤의 설치·걷기가 꼬이지 않는다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;background:#fff;padding:20px'
    host.innerHTML = '<div id="guard" style="box-sizing:border-box;width:200px;height:100px;overflow-y:auto;padding:0 16px"><div style="height:400px">내용</div></div>'
    document.body.appendChild(host)
    const el = document.getElementById('guard')!
    const pad = () => getComputedStyle(el).paddingRight
    const core = await import(/* @vite-ignore */ path)
    // ResizeObserver 가 없는 환경(다른 프로젝트의 테스트 도구 등)을 흉내 낸다.
    const real = window.ResizeObserver
    ;(window as any).ResizeObserver = undefined
    let thrown = ''
    let first: (() => void) | null = null
    try {
      first = core.installMrScroll()
    } catch (e) {
      thrown = String(e).slice(0, 80)
    }
    window.ResizeObserver = real
    await wait(100)
    const unsupported = pad()
    // 그 뒤에 정상으로 설치하고 걷는다 — 앞의 설치가 목록에 남아 있으면 걷어도 장치가 안 멈춘다.
    const second = core.installMrScroll()
    await wait(300)
    const installed = pad()
    second()
    await wait(200)
    const removed = pad()
    first?.()
    return { thrown, unsupported, installed, removed }
  }, CORE)
  console.log(`[guard] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out.thrown, '쓸 수 없는 환경에서 설치가 예외를 냄').toBe('')
  expect.soft(out.unsupported, '쓸 수 없는 환경에서는 아무것도 하지 않는다').toBe('16px')
  expect.soft(out.installed, '그 뒤의 설치는 정상으로 돈다').toBe('5px')
  expect.soft(out.removed, '그 뒤의 걷기가 장치를 멈추고 되돌린다').toBe('16px')
})

test('옵션 textarea — 켜야 입력창을 보고, 여백이 충분한 입력창은 그 여백을 줄여 글자 폭을 지킨다', async ({ page, browserName }) => {
  // Firefox 는 이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹어 기본 폭(15px)으로 돈다 — 폭은 재서 쓴다.
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;background:#fff;padding:20px'
    // wide: 오른쪽 여백(16px)이 스크롤바(11~15px)보다 넓다. tight: 여백(4px)이 스크롤바보다 좁다.
    host.innerHTML =
      '<textarea id="wide" style="box-sizing:border-box;display:block;width:240px;height:80px;padding:8px 16px;border:1px solid #999;resize:none;overflow-y:auto"></textarea>' +
      '<textarea id="tight" style="box-sizing:border-box;display:block;width:240px;height:80px;padding:4px;border:1px solid #999;resize:none;overflow-y:auto"></textarea>' +
      // 크기를 안쪽 내용 기준(content-box)으로 못박은 상자 — 여백을 줄이면 상자가 준다. 상자 크기는 그대로여야 하고, 폭·높이를 고쳐 쓰지도 않는다.
      '<textarea id="cbta" style="box-sizing:content-box;display:block;width:240px;height:80px;padding:8px 16px;border:1px solid #999;resize:none;overflow-y:auto"></textarea>' +
      '<div id="cbdiv" style="box-sizing:content-box;width:240px;height:80px;padding:8px 16px;border:1px solid #999;overflow-y:auto"><div id="cbin" style="height:20px">내용</div></div>' +
      // 가로·세로 둘 다 넘치는 content-box 상자 — 아래 여백(16px)도 줄이므로 높이도 지켜야 한다.
      '<div id="cbxy" style="box-sizing:content-box;width:240px;height:80px;padding:8px 16px 16px;border:1px solid #999;overflow:auto"><div id="cbxyin" style="width:100px;height:20px">내용</div></div>'
    document.body.appendChild(host)
    const wide = document.getElementById('wide') as HTMLTextAreaElement
    const tight = document.getElementById('tight') as HTMLTextAreaElement
    const errors: string[] = []
    window.addEventListener('error', (e) => { if (!String(e.message).includes('ResizeObserver')) errors.push(String(e.message)) })
    const read = (el: HTMLTextAreaElement) => {
      const s = getComputedStyle(el)
      // 글자가 놓이는 폭 — 이 값이 같으면 줄바꿈이 그대로다.
      return { pad: s.paddingRight, text: el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), shadow: !!el.shadowRoot }
    }
    const cbta = document.getElementById('cbta') as HTMLTextAreaElement
    const cbdiv = document.getElementById('cbdiv') as HTMLElement
    const cbxy = document.getElementById('cbxy') as HTMLElement
    // 인라인으로 적힌 크기·여백 — 걷은 뒤 처음과 같아야 한다.
    const inline = (el: HTMLElement) => [el.style.width, el.style.height, el.style.paddingRight, el.style.paddingBottom].join(' / ')
    const box = (el: HTMLElement) => {
      const s = getComputedStyle(el)
      return {
        pad: s.paddingRight, padBottom: s.paddingBottom, outer: el.offsetWidth, outerH: el.offsetHeight,
        text: el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), textH: el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom),
      }
    }
    const fill = (on: boolean) => {
      for (const el of [wide, tight, cbta]) el.value = on ? Array.from({ length: 30 }, (_, i) => `줄 ${i}`).join('\n') : ''
      document.getElementById('cbin')!.style.height = on ? '400px' : '20px'
      document.getElementById('cbxyin')!.style.cssText = on ? 'width:600px;height:400px' : 'width:100px;height:20px'
    }
    const empty = { wide: read(wide), tight: read(tight) }
    const contentBox: Record<string, any> = { 빈상태: { ta: box(cbta), div: box(cbdiv), xy: box(cbxy) }, 원래: { ta: inline(cbta), div: inline(cbdiv), xy: inline(cbxy) } }
    const core = await import(/* @vite-ignore */ path)
    // 1) 기본값 — 입력창은 보지 않는다.
    const offDefault = core.installMrScroll()
    fill(true); await wait(300)
    const off = { wide: read(wide), tight: read(tight) }
    // 이 브라우저에서 실제로 뜬 스크롤바 폭.
    const sb = wide.offsetWidth - wide.clientWidth - 2
    offDefault(); fill(false); await wait(200)
    // 2) 켠다.
    const uninstall = core.installMrScroll({ textarea: true, debug: true })
    fill(true); await wait(400)
    const on = { wide: { ...read(wide), method: wide.getAttribute('data-scrollbar-method') }, tight: { ...read(tight), method: tight.getAttribute('data-scrollbar-method'), why: tight.getAttribute('data-scrollbar-why') } }
    contentBox.켠상태 = { ta: box(cbta), div: box(cbdiv), xy: box(cbxy) }
    contentBox.켠인라인 = { ta: inline(cbta), div: inline(cbdiv), xy: inline(cbxy) }
    fill(false); await wait(300)
    const back = { wide: read(wide), tight: read(tight) }
    fill(true); await wait(300)
    uninstall(); await wait(200)
    contentBox.걷은뒤 = { ta: inline(cbta), div: inline(cbdiv), xy: inline(cbxy) }
    const after = { wide: read(wide), marks: [...wide.attributes, ...tight.attributes].filter((a) => a.name.startsWith('data-scrollbar')).length }
    host.remove()
    return { empty, off, on, back, after, errors, contentBox, sb }
  }, CORE)
  console.log(`[textarea] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out.errors, '오류 없음').toEqual([])
  expect.soft(out.empty.wide.pad).toBe('16px')
  expect.soft(out.off.wide.pad, '기본값이면 입력창을 건드리지 않는다').toBe('16px')
  expect(out.sb, '스크롤바가 폭을 차지한다').toBeGreaterThan(0)
  const reduced = `${16 - out.sb}px`
  expect.soft(out.off.wide.text, '기본값이면 스크롤바 폭만큼 글자 폭이 준다').toBe(out.empty.wide.text - out.sb)
  expect.soft(out.on.wide, '켜면 여백을 스크롤바 폭만큼 줄이고 글자 폭은 그대로다').toMatchObject({ pad: reduced, text: out.empty.wide.text, method: 'padding', shadow: false })
  expect.soft(out.on.tight, '여백이 스크롤바보다 좁으면 손대지 않는다').toMatchObject({ pad: '4px', shadow: false })
  expect.soft(out.back.wide, '스크롤바가 사라지면 되돌아온다').toMatchObject({ pad: '16px', text: out.empty.wide.text })
  const { 빈상태: none, 켠상태: on, 켠인라인: written, 걷은뒤: left, 원래: orig } = out.contentBox
  for (const key of ['ta', 'div', 'xy'] as const) {
    expect.soft(on[key], `content-box ${key} — 상자 크기가 그대로다`).toMatchObject({ outer: none[key].outer, outerH: none[key].outerH })
    expect.soft(written[key], `content-box ${key} — 폭·높이·여백을 고쳐 쓰지 않는다`).toBe(orig[key])
    expect.soft(left[key], `content-box ${key} — 걷은 뒤에도 처음과 같다`).toBe(orig[key])
  }
  // 입력창은 스크롤바를 띄울 수 없어 그대로 밀린다. 보통 상자는 스크롤바를 띄워 받으므로 내용 자리가 그대로다.
  expect.soft(on.ta.text, 'content-box 입력창 — 받지 못해 스크롤바 폭만큼 밀린다').toBe(none.ta.text - out.sb)
  expect.soft(on.div, 'content-box 상자 — 내용 자리가 그대로다').toMatchObject({ text: none.div.text })
  expect.soft(on.xy, 'content-box 가로·세로 — 내용 자리가 그대로다').toMatchObject({ text: none.xy.text, textH: none.xy.textH })
  expect.soft(out.after, '걷으면 되돌린다').toMatchObject({ wide: { pad: '16px' }, marks: 0 })
})

test('상자 크기를 굳히지 않는다 — 내용·비율로 정해지는 크기, 꽉 찬 자식, 넓히기, 입력창', async ({ page, browserName }) => {
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;width:700px;background:#fff;padding:20px'
    host.innerHTML =
      // 1) 높이가 내용으로 정해지는 상자 — 가로 스크롤바가 생겨도 높이를 숫자로 굳히지 않는다.
      '<pre id="pre" style="box-sizing:content-box;overflow-x:auto;overflow-y:hidden;padding:16px;margin:0;width:300px;font:14px/16px monospace;border:1px solid #999">short</pre>' +
      // 2) 폭을 비율로 준 상자 — 감싼 틀이 줄면 따라 준다.
      '<div id="pc" style="width:600px"><div id="pct" style="box-sizing:content-box;width:50%;height:100px;overflow-y:auto;padding:0 20px;border:1px solid #999"><div id="pctin" style="height:20px">x</div></div></div>' +
      // 4) 폭을 꽉 채운 content-box 자식 — 자식의 글자 폭이 그대로다.
      '<div id="fs" style="box-sizing:border-box;width:300px;height:100px;overflow-y:auto;border:1px solid #999"><div id="fc" style="box-sizing:content-box;width:calc(100% - 40px);padding:0 20px">text<div id="fg" style="height:20px"></div></div></div>' +
      // 5) 넓히기 예비 방식 — 스크롤바를 띄울 수 없는 content-box 목록을 스크롤바 폭만큼만 넓힌다.
      '<div id="uw" style="box-sizing:border-box;width:400px;padding-right:40px"><ul id="ul" style="box-sizing:content-box;overflow-y:auto;max-height:100px;margin:0;padding-left:40px;list-style:none"><li>item</li></ul></div>' +
      // 6) 옵션을 안 켰는데 스크롤 영역을 꽉 채운 입력창 — 입력창의 여백을 건드리지 않는다.
      '<div id="ts" style="box-sizing:border-box;width:300px;height:120px;overflow-y:auto;border:1px solid #999"><div><textarea id="tc" style="box-sizing:border-box;display:block;width:100%;height:60px;padding:8px 16px;overflow:hidden;resize:none"></textarea></div></div>' +
      // 7) 스크롤바를 늘 띄우는 입력창 — 코드로 글을 넣어도 스크롤바가 숨은 채 남지 않는다.
      '<textarea id="as" style="box-sizing:border-box;display:block;width:240px;height:80px;padding:4px 16px;border:1px solid #999;overflow-y:scroll;resize:none"></textarea>'
    document.body.appendChild(host)
    const $ = (id: string) => document.getElementById(id) as HTMLElement
    const textWidth = (el: HTMLElement) => { const s = getComputedStyle(el); return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) }
    const errors: string[] = []
    window.addEventListener('error', (e) => { if (!String(e.message).includes('ResizeObserver')) errors.push(String(e.message)) })
    const base = { pre: $('pre').offsetHeight, fc: textWidth($('fc')), ul: $('ul').offsetWidth, tcPad: getComputedStyle($('tc')).paddingRight }
    const core = await import(/* @vite-ignore */ path)
    const uninstall = core.installMrScroll()
    await wait(200)
    // 스크롤바를 만든다.
    $('pre').textContent = 'x'.repeat(200)
    $('pctin').style.height = '400px'
    $('fg').style.height = '400px'
    $('ul').innerHTML = '<li>item</li>'.repeat(30)
    $('tc').style.height = '300px'
    await wait(500)
    // 이 브라우저의 스크롤바 폭 — 장치가 건드리지 않는 상자로 잰다.
    const probe = document.createElement('div')
    probe.setAttribute('data-scrollbar', 'off')
    probe.style.cssText = 'width:100px;height:50px;overflow-y:scroll'
    host.appendChild(probe)
    const sb = probe.offsetWidth - probe.clientWidth
    probe.remove()
    const first = {
      pre: { height: $('pre').offsetHeight, inline: $('pre').style.height, method: $('pre').getAttribute('data-scrollbar-method-x') },
      pct: { width: $('pct').offsetWidth, inline: $('pct').style.width },
      fc: textWidth($('fc')),
      ul: $('ul').offsetWidth,
      tcPad: getComputedStyle($('tc')).paddingRight,
    }
    // 1) 줄이 늘면 높이가 따라 는다.  2) 감싼 틀을 줄이면 폭이 따라 준다.
    $('pre').textContent = ('x'.repeat(200) + '\n').repeat(3)
    $('pc').style.width = '400px'
    await wait(500)
    const second = { pre: $('pre').offsetHeight, pct: $('pct').offsetWidth }
    uninstall()
    await wait(200)
    // 7) 입력창 옵션을 켜고, 늘 띄우는 스크롤바의 입력창에 코드로 글을 넣는다.
    const as = $('as') as HTMLTextAreaElement
    const off = core.installMrScroll({ textarea: true })
    await wait(300)
    const emptyText = textWidth(as)
    as.value = Array.from({ length: 30 }, (_, i) => `줄 ${i}`).join('\n')
    await wait(500)
    const always = { emptyText, text: textWidth(as), bar: as.offsetWidth - as.clientWidth - 2, hidden: as.hasAttribute('data-scrollbar-overlay') }
    off()
    host.remove()
    return { base, first, second, always, sb, errors }
  }, CORE)
  console.log(`[boxes] ${browserName} ${JSON.stringify(out)}`)
  expect.soft(out.errors, '오류 없음').toEqual([])
  expect.soft(out.first.pre, '1) 높이가 내용으로 정해지는 상자 — 스크롤바가 생겨도 높이가 그대로고, 숫자로 굳히지 않는다').toMatchObject({ height: out.base.pre, inline: '' })
  expect.soft(out.second.pre, '1) 줄이 늘면 높이가 따라 는다').toBe(out.base.pre + 32)
  expect.soft(out.first.pct, '2) 비율로 준 폭 — 숫자로 굳히지 않는다').toMatchObject({ width: 342, inline: '50%' })
  expect.soft(out.second.pct, '2) 감싼 틀을 줄이면 폭이 따라 준다').toBe(242)
  expect.soft(out.first.fc, '4) 꽉 찬 content-box 자식 — 글자 폭이 그대로다').toBe(out.base.fc)
  expect(out.sb, '스크롤바가 폭을 차지한다').toBeGreaterThan(0)
  expect.soft(out.first.ul, '5) 넓히기 — 스크롤바 폭만큼만 넓힌다').toBe(out.base.ul + out.sb)
  expect.soft(out.first.tcPad, '6) 옵션을 안 켜면 꽉 찬 자식인 입력창의 여백을 건드리지 않는다').toBe(out.base.tcPad)
  expect.soft(out.always.hidden, '7) 늘 띄우는 입력창 — 스크롤바를 숨기지 않는다').toBe(false)
  expect.soft(out.always.bar, '7) 늘 띄우는 입력창 — 스크롤바가 보인다').toBe(out.sb)
  expect.soft(out.always.text, '7) 늘 띄우는 입력창 — 글이 늘어도 글자 폭이 그대로다').toBe(out.always.emptyText)
})

test('띄운 스크롤바가 꾸민 손잡이의 테두리까지 따라간다 — 투명 테두리로 가늘게 만든 손잡이', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox 는 ::-webkit-scrollbar 로 꾸민 스크롤바가 없다')
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const sheet = document.createElement('style')
    // 요즘 사이트에서 흔한 꾸밈 — 손잡이에 투명한 테두리를 둘러 12px 자리 안에서 6px 로 가늘어 보이게 한다.
    sheet.textContent =
      '#thin::-webkit-scrollbar{width:12px}' +
      '#thin::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:999px;background:rgb(185, 192, 204);background-clip:content-box}'
    document.head.appendChild(sheet)
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;background:#fff'
    // 여백이 어디에도 없다 — 내용 위에 겹쳐 띄운다.
    host.innerHTML = '<div id="thin" style="box-sizing:border-box;width:200px;height:100px;overflow-y:auto"><div style="height:400px">내용</div></div>'
    document.body.appendChild(host)
    const el = document.getElementById('thin')!
    const native = getComputedStyle(el, '::-webkit-scrollbar-thumb')
    const want = { border: native.borderTopWidth, clip: native.backgroundClip, color: native.borderTopColor, background: native.backgroundColor, radius: native.borderTopLeftRadius }
    const core = await import(/* @vite-ignore */ path)
    const uninstall = core.installMrScroll({ debug: true })
    await wait(400)
    const bar = el.shadowRoot?.querySelector('[data-scrollbar-ghost]')?.children[0] as HTMLElement | undefined
    const thumb = bar ? getComputedStyle(bar, '::-webkit-scrollbar-thumb') : null
    const got = thumb && { border: thumb.borderTopWidth, clip: thumb.backgroundClip, color: thumb.borderTopColor, background: thumb.backgroundColor, radius: thumb.borderTopLeftRadius }
    const result = { method: el.getAttribute('data-scrollbar-method'), width: bar?.offsetWidth, want, got }
    uninstall()
    host.remove()
    sheet.remove()
    return result
  }, CORE)
  console.log(`[thumb] ${browserName} ${JSON.stringify(out)}`)
  expect(out.method, '시험 구조 확인 — 스크롤바를 띄우는 방식이어야 한다').toBe('overlay')
  expect.soft(out.width, '띄운 스크롤바의 굵기').toBe(12)
  expect.soft(out.want.border, '시험 구조 확인 — 원래 손잡이에 테두리가 있다').toBe('3px')
  expect.soft(out.got, '띄운 손잡이가 원래 손잡이와 같은 테두리·칠 범위·색·둥글기를 갖는다').toEqual(out.want)
})

test('넓힌 영역이 사라지면 같이 넓힌 조상 틀도 되돌린다', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', '이 페이지의 스크롤바 폭 강제(::-webkit-scrollbar)가 안 먹는다')
  await page.goto(url('app-settings', false, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async (path) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    // 가장자리에 붙여 띄울 수 없는 브라우저를 흉내 낸다 — 그래야 넓히기로 받는다.
    const supports = CSS.supports.bind(CSS)
    CSS.supports = ((...args: [string, string?]) => (args.join(' ').includes('anchor(') ? false : supports(...(args as [string])))) as typeof CSS.supports
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;width:300px;padding:0 40px;background:#fff'
    host.innerHTML = '<div id="clip" style="overflow:hidden"><div id="gone" style="height:100px;overflow-y:auto;display:grid"><div style="height:400px">내용</div></div></div>'
    document.body.appendChild(host)
    const clip = document.getElementById('clip')!
    const core = await import(/* @vite-ignore */ path)
    const uninstall = core.installMrScroll()
    await wait(300)
    const during = clip.style.marginRight
    document.getElementById('gone')!.remove()
    await wait(200)
    const after = { style: clip.getAttribute('style'), undo: clip.getAttribute('data-scrollbar-undo') }
    uninstall()
    CSS.supports = supports
    return { during, after }
  }, CORE)
  console.log(`[gone] ${browserName} ${JSON.stringify(out)}`)
  expect(out.during, '시험 구조 확인 — 자르는 틀까지 같이 넓혀야 한다').toBe('-11px')
  expect.soft(out.after, '영역이 사라진 뒤 틀에 남은 것').toEqual({ style: 'overflow: hidden;', undo: null })
})

test('RTL 영역 — 왼쪽에 뜨는 스크롤바를 좌우를 뒤집어 받는다(왼쪽에서 오른쪽인 페이지 안에서도)', async ({ page, browserName }) => {
  await page.goto(url('app-settings', true, 11))
  await page.waitForTimeout(500)
  const out = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:500;left:60px;top:120px;width:300px;background:#fff'
    const area = 'dir="rtl" style="box-sizing:border-box;height:60px;overflow-y:auto;'
    const text = '<div class="grow" style="height:20px"><span>글자</span></div>'
    host.innerHTML = [
      // 자기 여백 · 가운데 정렬 · 바깥 여백(조상의 왼쪽 여백) · 겹치기
      `<div id="rtl-pad" ${area}padding:0 20px">${text}</div>`,
      `<div id="rtl-center" ${area}"><div style="width:200px;margin:0 auto">${text}</div></div>`,
      `<div style="padding:0 30px"><div id="rtl-outside" ${area}">${text}</div></div>`,
      `<div id="rtl-overlay" ${area}">${text}</div>`,
    ].join('')
    document.body.appendChild(host)
    await wait(300)
    const ids = ['rtl-pad', 'rtl-center', 'rtl-outside', 'rtl-overlay']
    const spot = (id: string) => {
      const box = document.querySelector(`#${id} span`)!.getBoundingClientRect()
      return [box.left, box.right]
    }
    const before = ids.map(spot)
    for (const grow of host.querySelectorAll<HTMLElement>('.grow')) grow.style.height = '400px'
    await wait(400)
    const rows = ids.map((id, index) => {
      const el = document.getElementById(id)!
      const now = spot(id)
      const bar = el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost] > div')
      const shown = !!bar && el.hasAttribute('data-scrollbar-overlay') && bar.getBoundingClientRect().width > 0
      const box = el.getBoundingClientRect()
      return {
        id,
        shift: Math.max(Math.abs(now[0] - before[index][0]), Math.abs(now[1] - before[index][1])),
        style: [el.style.paddingLeft, el.style.paddingRight].join('/'),
        // 띄운 스크롤바의 자리 — 영역 왼쪽 끝을 기준으로(음수면 바깥 왼쪽).
        bar: shown ? [bar!.getBoundingClientRect().left - box.left, bar!.getBoundingClientRect().right - box.left] : null,
      }
    })
    const width = (() => { const el = document.getElementById('rtl-pad')!; return el.offsetWidth - el.clientWidth })()
    host.remove()
    return { rows, width }
  })
  console.log(`[rtl] ${browserName} ${JSON.stringify(out)}`)
  const [pad, center, outside, overlay] = out.rows
  const w = out.width
  expect(w, '시험 구조 확인 — 폭을 차지하는 스크롤바가 떠야 한다').toBeGreaterThan(1)
  for (const row of out.rows) expect.soft(row.shift, `${row.id} 스크롤바가 생길 때 글자가 밀림`).toBeLessThanOrEqual(TOLERANCE)
  expect.soft(pad.style, '자기 여백 — 스크롤바 쪽(왼쪽) 여백을 줄인다(왼쪽/오른쪽)').toBe(`${20 - w}px/20px`)
  // WebKit 은 왼쪽에 스크롤바가 뜬 영역에서 가운데 놓인 자식의 좌우 빈 자리가 같게 재지지 않아, 가운데 정렬 대신 내용 위에 겹친다(밀리지 않는 것은 같다).
  if (center.bar) expect.soft(center.bar, '가운데 정렬을 못 쓰면 안쪽 왼쪽 끝에 겹친다').toEqual([0, w])
  else expect.soft(center.style, '가운데 정렬 — 반대쪽(오른쪽)에 같은 폭을 준다').toBe(`/${w}px`)
  // 가장자리에 붙여 띄울 수 없는 브라우저에서는 넓히기·겹치기로 물러난다 — 띄웠을 때만 자리를 본다.
  if (outside.bar) expect.soft(outside.bar, '바깥 여백 — 영역의 왼쪽 바깥에 띄운다').toEqual([-w, 0])
  expect.soft(overlay.bar, '겹치기 — 영역의 안쪽 왼쪽 끝에 띄운다').toEqual([0, w])
})
