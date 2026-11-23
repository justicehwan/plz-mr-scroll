// 리드미의 전후 비교 움짤(docs/demo*.gif)을 다시 만든다 — 시험장의 demo.html 을 띄워 한 장씩 찍고 ffmpeg 로 묶는다.
// 쓰는 법: node scripts/record-demo.mjs [장면 이름...]   (이름을 안 주면 전부. ffmpeg 가 깔려 있어야 한다)
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 5197
const FPS = 15
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const work = mkdtempSync(join(tmpdir(), 'mr-scroll-demo-'))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
try {
  // 스크롤바가 폭을 차지하게 — Playwright 는 기본으로 스크롤바를 숨긴다.
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 })
  const open = async (scene) => {
    for (let i = 0; ; i += 1) {
      try { await page.goto(`http://localhost:${PORT}/demo.html?shot${scene ? `&scene=${scene}` : ''}`); break } catch (error) { if (i > 40) throw error; await wait(250) }
    }
    await page.waitForFunction(() => '__demo' in window)
  }
  await open()
  const all = await page.evaluate(() => window.__demo.scenes)
  const wanted = process.argv.slice(2).length > 0 ? process.argv.slice(2) : all
  for (const scene of wanted) {
    await open(scene)
    const { max, start } = await page.evaluate(() => ({ max: window.__demo.max, start: window.__demo.start }))
    // [단계, 그 상태로 머무는 장수] — 스크롤바를 만들고, 잠깐 보여 준 뒤 되돌린다. 두 단계뿐인 장면은 오래 머문다.
    const steps = [[start, max - start === 1 ? 18 : 14]]
    for (let n = start + 1; n <= max; n += 1) steps.push([n, n === max ? 30 : 4])
    for (let n = max - 1; n >= start; n -= 1) steps.push([n, n === start ? 10 : 3])
    const frames = join(work, scene)
    execFileSync('mkdir', ['-p', frames])
    let index = 0
    for (const [step, hold] of steps) {
      await page.evaluate((n) => window.__demo.set(n), step)
      await page.waitForTimeout(220)
      const shot = await page.screenshot()
      if (step === max) writeFileSync(join(process.env.DEMO_STILLS ?? work, `${scene}.png`), shot)
      for (let k = 0; k < hold; k += 1) {
        index += 1
        writeFileSync(join(frames, `f${String(index).padStart(4, '0')}.png`), shot)
      }
    }
    const results = await page.evaluate(async (n) => {
      window.__demo.set(n)
      await new Promise((resolve) => setTimeout(resolve, 300))
      return [...document.querySelectorAll('.demo-result')].map((el) => el.textContent)
    }, max)
    // 색 팔레트를 먼저 뽑아 쓰면 글자 가장자리가 덜 깨진다.
    const out = scene === 'members' ? 'docs/demo.gif' : `docs/demo-${scene}.gif`
    const input = ['-y', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png')]
    execFileSync('ffmpeg', [...input, '-vf', 'palettegen=stats_mode=diff', join(frames, 'palette.png')], { stdio: 'ignore' })
    execFileSync('ffmpeg', [...input, '-i', join(frames, 'palette.png'), '-lavfi', 'paletteuse=dither=none', '-loop', '0', out], { stdio: 'ignore' })
    console.log(`${out} — ${index}장, ${(index / FPS).toFixed(1)}초 · 스크롤바가 생겼을 때: ${results.join(' / ') || '(전후 비교 없음)'}`)
  }
  await browser.close()
} finally {
  server.kill()
  rmSync(work, { recursive: true, force: true })
}
