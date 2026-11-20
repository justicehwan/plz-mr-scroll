import type { Page } from '@playwright/test'

/** 테스트용 서버 — 빌드 결과물(dist)을 문 시험장. `playwright.config.ts` 가 띄운다. */
export const BASE = 'http://localhost:5198'
export const STORY = `${BASE}/bench.html`

/** 스크롤바를 어떤 폭으로 띄울지 — 엔진마다 되는 것이 다르다. */
export type Mode = 'native' | 'thin' | 'forced11' | 'w17'
export const MODES: Record<string, Mode[]> = {
  // native 15px · thin 11px · 테스트 화면의 강제 11px(::-webkit-scrollbar) · 17px(윈도우 폭 흉내)
  chromium: ['native', 'thin', 'forced11', 'w17'],
  // ::-webkit-scrollbar 를 모르는 엔진 — native 15px 와 scrollbar-width: thin(11px)
  firefox: ['native', 'thin'],
  // native·thin 은 폭 0(겹쳐 뜨는 스크롤바) — 아무것도 하지 않는지만 본다
  webkit: ['native', 'forced11', 'w17'],
}

/** 페이지 안에서 쓰는 측정 함수들. */
export function install() {
  const px = (v: string) => parseFloat(v) || 0
  const scrolls = (v: string) => v === 'auto' || v === 'scroll'
  // 창이 가려지면 브라우저가 화면 갱신 신호(requestAnimationFrame)를 멈춘다(창을 띄워 돌리는 Firefox) — 신호가 안 오면 시간으로 넘어간다.
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
  const isScroller = (el: Element) => {
    const s = getComputedStyle(el)
    return el instanceof HTMLElement && !(el instanceof HTMLTextAreaElement) && (scrolls(s.overflowY) || scrolls(s.overflowX))
  }
  const cellOf = (title: string, variant: 'before' | 'auto') => {
    // 제목은 `A. …`·`B2. …` 꼴이다 — 앞의 기호로 찾는다.
    const head = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith(`${title}. `))
    if (!head) throw new Error(`경우를 못 찾음: ${title}`)
    const row = head.parentElement!.parentElement!
    return row.children[variant === 'before' ? 1 : 2] as HTMLElement
  }
  const scrollersIn = (cell: HTMLElement) => [...cell.querySelectorAll('*')].filter(isScroller) as HTMLElement[]
  const ownerOf = (node: Element, cell: HTMLElement) => {
    for (let p = node.parentElement; p && p !== cell.parentElement; p = p.parentElement) if (isScroller(p)) return p
    return null
  }
  const ghostOf = (el: HTMLElement) => {
    const anchor = el.shadowRoot?.querySelector<HTMLElement>('[data-scrollbar-ghost]') ?? null
    const shown = (b?: Element | null) =>
      !!anchor && !!b && getComputedStyle(anchor).display !== 'none' && getComputedStyle(b).display !== 'none'
    const v = anchor?.children[0] as HTMLElement | undefined
    const h = anchor?.children[1] as HTMLElement | undefined
    return { v: shown(v) ? v! : null, h: shown(h) ? h! : null }
  }
  const measure = (el: HTMLElement, cell: HTMLElement) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const overlay = el.hasAttribute('data-scrollbar-overlay')
    const { v, h } = ghostOf(el)
    const inline = el.style
    let vertical = 'none'
    if (overlay && v) vertical = v.getBoundingClientRect().left >= r.right - 0.5 ? 'outside' : 'overlay'
    else if (inline.marginRight) vertical = 'widen'
    else if (inline.paddingLeft) vertical = 'center'
    else if (inline.paddingRight) vertical = 'pad'
    else if (px(inline.getPropertyValue('--sbw')) > 0) vertical = 'manual'
    else if ([...el.querySelectorAll('[data-scrollbar-undo]')].some((n) => ownerOf(n, cell) === el)) vertical = 'center'
    let horizontal = 'none'
    if (overlay && h) horizontal = h.getBoundingClientRect().top >= r.bottom - 0.5 ? 'outside' : 'overlay'
    else if (inline.paddingBottom) horizontal = 'pad'
    else if (px(inline.getPropertyValue('--sbh')) > 0) horizontal = 'manual'
    const leaves = ([...el.querySelectorAll('*')] as HTMLElement[])
      .filter((n) => n.childElementCount === 0 && n.offsetWidth > 0 && ownerOf(n, cell) === el)
      .slice(0, 6)
      .map((n) => {
        const b = n.getBoundingClientRect()
        const c = cell.getBoundingClientRect()
        return { l: +(b.left - c.left).toFixed(2), r: +(b.right - c.left).toFixed(2) }
      })
    const rect = (b: HTMLElement | null) => {
      if (!b) return null
      const q = b.getBoundingClientRect()
      return { l: +(q.left - r.left).toFixed(1), t: +(q.top - r.top).toFixed(1), w: +q.width.toFixed(1), h: +q.height.toFixed(1) }
    }
    const marker = [...cell.querySelectorAll('p')].find((p) => p.textContent?.startsWith('▲'))
    return {
      tag: el.tagName.toLowerCase(),
      nativeW: el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth),
      nativeH: el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth),
      overflowsY: el.scrollHeight - el.clientHeight > 1,
      overflowsX: el.scrollWidth - el.clientWidth > 1,
      box: { w: +r.width.toFixed(1), h: +r.height.toFixed(1), l: +(r.left - cell.getBoundingClientRect().left).toFixed(1) },
      vertical,
      horizontal,
      overlay,
      gutter: inline.scrollbarGutter,
      inline: el.getAttribute('style') ?? '',
      undo: el.getAttribute('data-scrollbar-undo') ?? '',
      // 진단 표시(debug)가 켜져 있을 때 장치가 직접 적어 둔 것
      debugMethod: el.getAttribute('data-scrollbar-method'),
      debugMethodX: el.getAttribute('data-scrollbar-method-x'),
      debugWhy: el.getAttribute('data-scrollbar-why'),
      ghostV: rect(v),
      ghostH: rect(h),
      leaves,
      markerTop: marker ? +(marker.getBoundingClientRect().top - cell.getBoundingClientRect().top).toFixed(2) : null,
    }
  }
  /** 띄운 스크롤바가 실제로 보이고(가려지거나 잘리지 않음) 스크롤 위치가 양쪽으로 맞물리는가. */
  const exercise = async (el: HTMLElement) => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    await frames()
    const { v, h } = ghostOf(el)
    const hit = (bar: HTMLElement | null) => {
      if (!bar) return null
      const q = bar.getBoundingClientRect()
      const x = q.left + q.width / 2
      const y = q.top + q.height / 2
      const inShadow = el.shadowRoot!.elementFromPoint(x, y)
      const inDoc = document.elementFromPoint(x, y)
      return { shadow: inShadow === bar || bar.contains(inShadow), doc: inDoc === el, docTag: inDoc ? `${inDoc.tagName.toLowerCase()}.${(inDoc as HTMLElement).className}`.slice(0, 60) : 'null' }
    }
    const out: Record<string, unknown> = { hitV: hit(v), hitH: hit(h) }
    if (v) {
      el.scrollTop = 60
      await frames()
      out.vFollows = v.scrollTop
      v.scrollTop = 120
      await frames()
      out.vLeads = el.scrollTop
      el.scrollTop = 0
      await frames()
      out.vReset = v.scrollTop
    }
    if (h) {
      el.scrollLeft = 40
      await frames()
      out.hFollows = h.scrollLeft
      h.scrollLeft = 90
      await frames()
      out.hLeads = el.scrollLeft
      el.scrollLeft = 0
      await frames()
    }
    return out
  }
  Object.assign(window, {
    __sb: {
      frames,
      collect: (title: string) => {
        const read = (variant: 'before' | 'auto') => {
          const cell = cellOf(title, variant)
          return scrollersIn(cell).map((el) => measure(el, cell))
        }
        return { before: read('before'), auto: read('auto') }
      },
      exercise: async (title: string, index = 0) => exercise(scrollersIn(cellOf(title, 'auto'))[index]),
      /** 내용의 오른쪽 끝(안쪽 3px)을 눌렀을 때 내용이 받는가 — 스크롤 영역 자신이 받으면 그 위에 띄운 막대가 가로챈 것이다. */
      edgeHit: (title: string) => {
        const el = scrollersIn(cellOf(title, 'auto'))[0]
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
        const row = el.querySelector('p')!.getBoundingClientRect()
        const hit = document.elementFromPoint(row.right - 3, row.top + row.height / 2)
        return !!hit && hit !== el && el.contains(hit)
      },
      /** 띄운 세로 스크롤바가 화면에서 차지하는 자리 — 스크롤 위치를 `top`(0~1)으로 옮긴 뒤 잰다. 화면에 실제로 그려지는지 찍어 볼 때 쓴다. */
      ghostBox: async (title: string, index: number, top: number) => {
        const el = scrollersIn(cellOf(title, 'auto'))[index]
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
        el.scrollTop = (el.scrollHeight - el.clientHeight) * top
        await frames(4)
        const v = ghostOf(el).v
        if (!v) return null
        const q = v.getBoundingClientRect()
        return { x: Math.round(q.left), y: Math.round(q.top), width: Math.round(q.width), height: Math.round(q.height) }
      },
      toggle: (title: string, variant: 'before' | 'auto') => {
        const box = cellOf(title, variant).querySelector<HTMLInputElement>('input[type=checkbox]')
        box?.click()
      },
      leftovers: () => ({
        undo: document.querySelectorAll('[data-scrollbar-undo]').length,
        overlay: document.querySelectorAll('[data-scrollbar-overlay]').length,
        vars: [...document.querySelectorAll<HTMLElement>('[style*="--sb"]')].length,
        pageGhost: document.querySelectorAll('[data-scrollbar-ghost-page]').length,
      }),
    },
  })
}

export async function open(page: Page, mode: Mode) {
  await page.addInitScript(install)
  await page.goto(STORY)
  await page.getByText('A. 기본', { exact: false }).first().waitFor()
  if (mode !== 'forced11') await page.getByRole('button', { name: /강제 스크롤바 끄기/ }).click()
  // 테스트 화면은 전역 스타일이 스크롤바를 얇게(scrollbar-width: thin) 만든다 — 방식마다 그 값을 덮어쓴다.
  // `scrollbar-width`·`scrollbar-color` 가 auto 가 아니면 `::-webkit-scrollbar` 로 준 폭은 무시된다.
  const reset = '*{scrollbar-width:auto!important;scrollbar-color:auto!important}'
  if (mode === 'native') await page.addStyleTag({ content: reset })
  if (mode === 'thin') await page.addStyleTag({ content: '*{scrollbar-width:thin!important;scrollbar-color:auto!important}' })
  if (mode === 'w17') {
    await page.addStyleTag({
      content: `${reset}*::-webkit-scrollbar{width:17px;height:17px}*::-webkit-scrollbar-thumb{background:#888;border-radius:9px}*::-webkit-scrollbar-track{background:#ddd}`,
    })
  }
  await settle(page)
}

export async function settle(page: Page) {
  await page.evaluate(() => (window as any).__sb.frames(4))
  await page.waitForTimeout(150)
  await page.evaluate(() => (window as any).__sb.frames(2))
}

export const many = (page: Page, on: boolean) =>
  page.getByRole('button', { name: on ? /줄 많게/ : /줄 적게/ }).click()
