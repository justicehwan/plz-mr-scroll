import { defineConfig, devices } from '@playwright/test'

/**
 * MrScroll 자동 확인 — 빌드 결과물(dist)을 문 시험장(playground)을 5198 에 띄워 놓고 돌린다.
 * 돌리기: `npm test` (빌드 → 테스트. 엔진 하나만: `npm test -- --project=chromium`)
 */
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  fullyParallel: false,
  workers: 3,
  reporter: [['list']],
  webServer: { command: 'npx vite', url: 'http://localhost:5198/bench.html', env: { MR_SCROLL_DIST: '1' }, reuseExistingServer: false },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        // Playwright 는 기본으로 스크롤바를 숨긴다(폭 0) — 그 인자를 빼야 폭을 차지하는 스크롤바(15px, thin 11px)가 뜬다.
        launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
      },
    },
    {
      name: 'firefox',
      // 창 없이(headless) 띄운 Firefox 는 맥에서 스크롤바 폭이 0 이다 — 창을 띄워야 폭을 차지하는 스크롤바(15px, thin 11px)가 된다.
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 }, headless: false },
    },
    // Playwright 의 WebKit 은 맥에서 늘 겹쳐 뜨는 스크롤바(폭 0)다 — `::-webkit-scrollbar` 로 폭을 준 경우만 본다.
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
  ],
})
