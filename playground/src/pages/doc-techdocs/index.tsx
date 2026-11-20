import { useEffect, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'doc-techdocs',
  title: '기술 문서 사이트 (3단 + 고정 머리글)',
  notes: [
    '페이지 전체: html 에 overflow-y: scroll 로 스크롤바 자리를 항상 확보(어설픈 정석 대처). 격자는 max-width 1280px + margin 0 auto, 안쪽 box-sizing 은 border-box. 조작: 상단 「장 늘리기/줄이기」로 본문 길이를 창보다 짧게/길게.',
    '고정 머리글(position: fixed; left:0; right:0)과 고정 바닥 막대(fixed; bottom:0)는 뷰포트 기준이라 스크롤바 유무에 따라 폭이 바뀐다. 가운데 정렬 안쪽 상자(1280px)가 같이 움직이는지 볼 것.',
    '왼쪽 목차: sticky + max-height + overflow-y: auto, scrollbar-gutter: stable 로 대처. 조작: 「목차 항목 늘리기/줄이기」(25개 ↔ 0개)로 안쪽 스크롤바가 생기고 사라짐.',
    '오른쪽 목차: sticky + overflow-y: auto, 대처 없음. 본문 장 수가 바뀌면 항목 수도 바뀌어 안쪽 스크롤바가 생기고 사라짐.',
    '코드 상자: overflow: auto(가로·세로), max-height 180px, 대처 없음. 조작: 「코드 줄 +10/-10」, 탭(pnpm/npm/yarn) 전환 시 줄 수·최대 줄 길이가 달라짐.',
    '넓은 표: 래퍼 overflow-x: auto, 대처 없음. 조작: 「표 열 늘리기」로 가로 스크롤바 생기고 사라짐(세로 크기도 바뀜).',
    '로그 패널(세로 스크롤, height 200px) 안에 가로로 넓은 표가 또 있는 중첩 스크롤. 조작: 「로그 줄 늘리기/줄이기」. 스크롤바 대처 없음.',
    '내용이 늦게 불어남: 「이미지 늦게 불러오기」(1.2초 뒤 높이 0 → 260px), 펼치기/접기(details 두 개). 이 중 어떤 것은 창 스크롤바를 만들거나 없앤다.',
  ],
}

const SENTENCES = [
  '이 절에서는 설정 파일의 기본값과 덮어쓰기 규칙을 설명한다.',
  '환경 변수는 파일보다 우선하며, 같은 이름이 여러 곳에 있으면 가장 늦게 읽은 값이 이긴다.',
  '변경 사항은 다음 실행부터 적용되고, 실행 중인 작업에는 영향을 주지 않는다.',
  '아래 예시는 가상의 도구 「모래시계」를 기준으로 한 것이다.',
  '문제가 생기면 로그 수준을 높여서 다시 실행해 보자.',
]
const para = (i: number) => SENTENCES[i % 5] + ' ' + SENTENCES[(i + 2) % 5] + ' ' + SENTENCES[(i + 3) % 5]

const CODE: Record<string, string[]> = {
  pnpm: ['pnpm add hourglass', 'pnpm hourglass init'],
  npm: ['npm install hourglass', 'npx hourglass init --template=default --with-very-long-option-name-that-keeps-going-and-going-until-it-overflows-the-box-horizontally'],
  yarn: ['yarn add hourglass', 'yarn hourglass init', '# 워크스페이스에서는 아래처럼', 'yarn workspace app add hourglass'],
}

export default function Page() {
  const [chapters, setChapters] = useState(3)
  const [navExtra, setNavExtra] = useState(true)
  const [codeLines, setCodeLines] = useState(6)
  const [tab, setTab] = useState('pnpm')
  const [cols, setCols] = useState(4)
  const [logRows, setLogRows] = useState(5)
  const [imgH, setImgH] = useState(0)

  const loadImage = () => {
    setImgH(0)
    window.setTimeout(() => setImgH(260), 1200)
  }
  // 첫 진입 후 2초 뒤 배너 이미지가 늦게 뜬다
  useEffect(() => {
    const t = window.setTimeout(() => setImgH(260), 2000)
    return () => window.clearTimeout(t)
  }, [])

  const chapterList = Array.from({ length: chapters }, (_, i) => i + 1)
  const codeBody = [...CODE[tab], ...Array.from({ length: codeLines }, (_, i) => `// 줄 ${i + 1}: const option${i} = resolve('hourglass.config.ts', { depth: ${i} })`)]

  return (
    <div className="doc-techdocs-root">
      <header className="doc-techdocs-header">
        <div className="doc-techdocs-header-in">
          <b>모래시계 문서</b>
          <span>v2.4 · 한국어</span>
        </div>
      </header>

      <div className="doc-techdocs-grid">
        <nav className="doc-techdocs-left">
          <h4>시작하기</h4>
          <a href="#doc-techdocs-intro">소개</a>
          <a href="#doc-techdocs-code">설치 코드</a>
          <a href="#doc-techdocs-table">옵션 표</a>
          <a href="#doc-techdocs-log">로그 패널</a>
          {navExtra && Array.from({ length: 25 }, (_, i) => <a key={i} href="#doc-techdocs-intro">추가 문서 {i + 1}</a>)}
        </nav>

        <main className="doc-techdocs-main">
          <h1 id="doc-techdocs-intro">모래시계 시작하기</h1>
          <p>{para(0)}</p>

          <div className="doc-techdocs-tools">
            <button onClick={() => setChapters((n) => Math.min(12, n + 3))}>장 늘리기(+3)</button>
            <button onClick={() => setChapters((n) => Math.max(0, n - 3))}>장 줄이기(-3)</button>
            <button onClick={() => setNavExtra((v) => !v)}>목차 항목 {navExtra ? '줄이기' : '늘리기'}</button>
            <button onClick={() => setCodeLines((n) => n + 10)}>코드 줄 +10</button>
            <button onClick={() => setCodeLines((n) => Math.max(0, n - 10))}>코드 줄 -10</button>
            <button onClick={() => setCols((n) => (n === 4 ? 14 : 4))}>표 열 {cols === 4 ? '늘리기' : '줄이기'}</button>
            <button onClick={() => setLogRows((n) => (n === 5 ? 20 : 5))}>로그 줄 {logRows === 5 ? '늘리기' : '줄이기'}</button>
            <button onClick={loadImage}>이미지 늦게 불러오기</button>
            <span className="doc-techdocs-count">현재 {chapters}개 장</span>
          </div>

          <div className="doc-techdocs-img" style={{ height: imgH }}>
            {imgH > 0 && '배너 이미지(늦게 뜸) 260px'}
          </div>

          <h2 id="doc-techdocs-code">설치</h2>
          <div className="doc-techdocs-tabs">
            {Object.keys(CODE).map((k) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k}</button>
            ))}
          </div>
          <div className="doc-techdocs-code"><pre>{codeBody.join('\n')}</pre></div>

          <h2 id="doc-techdocs-table">옵션 표</h2>
          <div className="doc-techdocs-tablewrap">
            <table>
              <thead><tr>{Array.from({ length: cols }, (_, c) => <th key={c}>열 {c + 1} 이름이 조금 긴 편입니다</th>)}</tr></thead>
              <tbody>
                {[0, 1, 2].map((r) => (
                  <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}>값 {r}-{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="doc-techdocs-log">로그 패널</h2>
          <div className="doc-techdocs-log">
            {Array.from({ length: logRows }, (_, i) => (
              <div key={i} className="doc-techdocs-tablewrap">
                <table>
                  <tbody><tr>{Array.from({ length: 12 }, (_, c) => <td key={c}>로그 {i}.{c} 2026-11-19T10:00:0{c % 10}</td>)}</tr></tbody>
                </table>
              </div>
            ))}
          </div>

          <details className="doc-techdocs-details">
            <summary>자주 묻는 질문 1</summary>
            {Array.from({ length: 4 }, (_, i) => <p key={i}>{para(i + 1)}</p>)}
          </details>
          <details className="doc-techdocs-details">
            <summary>자주 묻는 질문 2</summary>
            {Array.from({ length: 8 }, (_, i) => <p key={i}>{para(i + 2)}</p>)}
          </details>

          {chapterList.map((n) => (
            <section key={n}>
              <h2 id={`doc-techdocs-ch${n}`}>제 {n} 장 · 설정 {n}</h2>
              <p>{para(n)}</p>
              <p>{para(n + 1)}</p>
            </section>
          ))}
        </main>

        <aside className="doc-techdocs-right">
          <h4>이 페이지에서</h4>
          <a href="#doc-techdocs-intro">소개</a>
          <a href="#doc-techdocs-code">설치</a>
          <a href="#doc-techdocs-table">옵션 표</a>
          <a href="#doc-techdocs-log">로그 패널</a>
          {chapterList.map((n) => <a key={n} href={`#doc-techdocs-ch${n}`}>제 {n} 장</a>)}
        </aside>
      </div>

      <div className="doc-techdocs-feedback">
        이 문서가 도움이 되었나요? <button>예</button> <button>아니요</button>
      </div>
    </div>
  )
}
