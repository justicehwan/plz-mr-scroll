import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
// 시험 대상 — 평소에는 소스를 바로 물고(고치면 바로 반영), 테스트는 빌드 결과물(`MR_SCROLL_DIST=1`)을 문다.
const dist = process.env.MR_SCROLL_DIST === '1'

export default defineConfig({
  root: 'playground',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^plz-mr-scroll\/react$/, replacement: here(dist ? './dist/esm/react.js' : './src/react.ts') },
      { find: /^plz-mr-scroll$/, replacement: here(dist ? './dist/esm/index.js' : './src/index.ts') },
    ],
  },
  // 테스트용 서버만 포트를 못박는다(테스트가 그 주소를 연다). 평소에는 Vite 기본 포트를 쓴다.
  server: { ...(dist ? { port: 5198, strictPort: true } : {}), fs: { allow: [here('.')] } },
})
