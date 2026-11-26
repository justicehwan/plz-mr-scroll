import path from 'node:path'
import { expect, test } from '@playwright/test'
import { BASE } from './helpers'

/**
 * 창 전체가 스크롤되는 페이지 — 창 스크롤바가 생기고 사라져도, 모달이 페이지 스크롤을 잠갔다 풀어도
 * 본문과 화면 폭을 따라 놓이는 요소(고정 헤더 · 오른쪽 아래 버튼 · 가운데 알림 · 구석 배너 · 늦게 생긴 버튼)가 제자리에 있는지 잰다.
 * 건드리면 안 되는 요소(이미 `translate` 를 쓰는 요소, 다른 고정 요소를 품은 요소)는 그대로 두는지도 본다.
 * 잠금은 흔한 세 방식을 흉내 낸다(네트워크 없이 돌게):
 *  - pad: 사라진 스크롤바만큼 `body` 오른쪽 여백을 더해 주고, 닫을 때 적어 둔 값으로 되돌린다(Bootstrap · MUI 가 쓰는 방식).
 *  - plain: `overflow: hidden` 만 건다.
 *  - whole: `body` 의 style 을 통째로 적어 뒀다가 닫을 때 통째로 되돌린다.
 */
const CORE = '/@fs' + path.resolve('dist/esm/index.js')
const TOLERANCE = 0.6
const LAYOUTS = {
  '본문 가운데 정렬': '.wrap{max-width:240px;margin:0 auto}',
  '좌우 여백': 'body{padding:0 24px}',
  '여백 없음': '',
}

const scene = (layout: string, forced: boolean) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box} html,body{margin:0} body{font:14px/1.5 system-ui}
${forced ? '::-webkit-scrollbar{width:15px} ::-webkit-scrollbar-thumb{background:#8d96a6}' : ''}
header{position:fixed;top:0;left:0;right:0;height:48px;display:flex;justify-content:space-between;align-items:center;padding:0 24px;background:#fff;z-index:10}
main{padding-top:92px;padding-bottom:150px} p{margin:0 0 12px;padding:10px 12px;border:1px solid #ddd}
#fab{position:fixed;right:24px;bottom:24px;width:44px;height:44px}
#toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:6px 14px;white-space:nowrap}
#badge{position:absolute;top:60px;right:24px;padding:2px 8px}
#own{position:fixed;right:24px;top:120px;translate:0 -4px} #outer{position:fixed;right:24px;top:160px} #inner{position:fixed;left:8px;top:200px}
.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100} .modal.open{display:flex}
${layout}
</style></head><body>
<header><b>로고</b><button id="login">로그인</button></header>
<main><div class="wrap" id="wrap"></div></main>
<button id="fab">↑</button><div id="toast">가운데 알림</div><div id="badge">구석 배너</div>
<div id="own">이미 translate 를 쓰는 요소</div><div id="outer">고정 요소를 품은 요소<div id="inner">안쪽 고정 요소</div></div>
<div class="modal" id="modal"><div>모달</div></div>
<script>
const wrap = document.getElementById('wrap')
// 첫 문단 안의 말풍선은 자리를 주지 않은 absolute 다 — 본문을 따라 놓이므로 따로 옮기면 안 된다.
window.setLong = (long) => { wrap.innerHTML = Array.from({ length: long ? 30 : 2 }, (_, i) => '<p id="p' + i + '">본문 ' + i + (i === 0 ? '<span id="tip" style="position:absolute;margin-left:8px">말풍선</span>' : '') + '</p>').join('') }
setLong(false)
window.addLate = () => { const b = document.createElement('button'); b.id = 'late'; b.style.cssText = 'position:fixed;right:24px;bottom:84px;width:44px;height:44px'; document.body.appendChild(b) }
window.where = () => {
  const r = (id) => document.getElementById(id).getBoundingClientRect()
  const late = document.getElementById('late')
  return { header: r('login').right, left: r('p0').left, right: r('p0').right, fab: r('fab').right, toast: r('toast').left, badge: r('badge').right, tip: r('tip').left, late: late ? late.getBoundingClientRect().right : innerWidth - 24 }
}
let unlock = null
const LOCKS = {
  pad: () => { const gap = innerWidth - document.documentElement.clientWidth; const b = document.body; const saved = [b.style.overflow, b.style.paddingRight]; const now = parseFloat(getComputedStyle(b).paddingRight) || 0; b.style.overflow = 'hidden'; if (gap > 0) b.style.paddingRight = (now + gap) + 'px'; return () => { b.style.overflow = saved[0]; b.style.paddingRight = saved[1] } },
  plain: () => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } },
  whole: () => { const y = scrollY; const b = document.body; const saved = b.getAttribute('style'); b.style.position = 'fixed'; b.style.top = -y + 'px'; b.style.left = '0'; b.style.right = '0'; return () => { if (saved === null) b.removeAttribute('style'); else b.setAttribute('style', saved); scrollTo(0, y) } },
}
window.openModal = (type) => { unlock = LOCKS[type](); document.getElementById('modal').classList.add('open') }
window.closeModal = () => { document.getElementById('modal').classList.remove('open'); unlock(); unlock = null }
</script></body></html>`

for (const [name, css] of Object.entries(LAYOUTS)) {
  test(`페이지 전체 · ${name} — 스크롤바가 생기고 사라져도, 모달을 열고 닫아도 헤더·본문·떠 있는 요소가 제자리`, async ({ page, browserName }) => {
    // WebKit 은 맥에서 창 스크롤바가 겹쳐 뜬다(폭 0) — `::-webkit-scrollbar` 로 폭을 줘야 볼 것이 생긴다.
    await page.route('**/__page.html', (route) => route.fulfill({ contentType: 'text/html', body: scene(css, browserName === 'webkit') }))
    await page.goto(`${BASE}/__page.html`)
    const settle = () => page.waitForTimeout(350)
    const where = () => page.evaluate(() => (window as any).where() as Record<string, number>)
    const base = await where()
    await page.evaluate(async (core) => {
      const { installMrScroll } = await import(/* @vite-ignore */ core)
      ;(window as any).__uninstall = installMrScroll()
    }, CORE)
    const check = async (label: string) => {
      await settle()
      const now = await where()
      for (const key of Object.keys(base)) {
        expect.soft(Math.abs(now[key] - base[key]), `${label} — ${key} 가 ${now[key] - base[key]}px 밀림`).toBeLessThanOrEqual(TOLERANCE)
      }
    }
    await page.evaluate(() => { (window as any).setLong(true); window.scrollTo(0, 300) })
    await settle()
    const bar = await page.evaluate(() => ({
      native: window.innerWidth - document.documentElement.clientWidth,
      floated: document.documentElement.hasAttribute('data-scrollbar-overlay'),
    }))
    console.log(`[page] ${browserName} ${name} ${JSON.stringify(bar)}`)
    expect(bar.native >= 2 || bar.floated, '이 시험은 창 스크롤바가 폭을 차지하는 환경에서 해야 한다').toBe(true)
    await check('스크롤바가 생김')
    // 창 스크롤바가 그대로 떠 있는 방식에서: 떠 있는 버튼은 옮기고, 이미 `translate` 를 쓰는 요소와 고정 요소를 품은 요소는 건드리지 않는다.
    if (bar.native >= 2) {
      const moved = await page.evaluate(() => ['fab', 'own', 'outer'].map((id) => document.getElementById(id)!.style.translate !== ''))
      expect.soft(moved, '옮긴 요소 [떠 있는 버튼, 이미 translate 를 쓰는 요소, 고정 요소를 품은 요소]').toEqual([true, false, false])
    }
    await page.evaluate(() => (window as any).addLate())
    await check('고정 버튼이 늦게 생김')
    // 창 스크롤바가 그대로 떠 있는 동안에는 본문 높이만 늘어도 문서의 요소를 다시 훑지 않는다(판별이 높이에 기대지 않는다).
    if (bar.native >= 2) {
      const walks = await page.evaluate(async () => {
        let count = 0
        const real = Element.prototype.querySelectorAll
        Element.prototype.querySelectorAll = function (this: Element, selector: string) {
          if (selector === '*') count += 1
          return real.call(this, selector)
        } as typeof real
        document.getElementById('wrap')!.style.paddingBottom = '400px'
        await new Promise((done) => setTimeout(done, 300))
        Element.prototype.querySelectorAll = real
        return count
      })
      expect.soft(walks, '본문 높이만 늘었을 때 문서 전체를 훑은 횟수').toBe(0)
      await check('본문 높이만 늘어남')
    }
    for (const lock of ['pad', 'plain', 'whole']) {
      for (const round of [1, 2]) {
        await page.evaluate((type) => (window as any).openModal(type), lock)
        await check(`${lock} ${round}회 열림`)
        await page.evaluate(() => (window as any).closeModal())
        await check(`${lock} ${round}회 닫힘`)
        expect.soft(await page.evaluate(() => window.scrollY), `${lock} ${round}회 닫은 뒤 스크롤 위치`).toBe(300)
      }
    }
    await page.evaluate(() => (window as any).setLong(false))
    await check('스크롤바가 사라짐')
    // 걷으면 남기는 것이 없다.
    const left = await page.evaluate(() => {
      ;(window as any).__uninstall()
      return {
        undo: document.querySelectorAll('[data-scrollbar-undo]').length,
        styles: [...document.querySelectorAll<HTMLElement>('body, header, #fab, #toast, #badge, #late')].map((el) => el.getAttribute('style') ?? '').filter((style) => /padding|translate|margin/.test(style)),
      }
    })
    expect.soft(left, '걷은 뒤 남은 것').toEqual({ undo: 0, styles: [] })
  })
}
