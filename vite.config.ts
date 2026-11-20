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
  server: { port: dist ? 5198 : 5199, strictPort: true, fs: { allow: [here('.')] } },
})
