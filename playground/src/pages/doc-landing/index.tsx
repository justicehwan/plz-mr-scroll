import { useEffect, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'doc-landing',
  title: '제품 소개 랜딩 (꽉 찬 구역 + 서랍 스크롤 잠금)',
  notes: [
    '페이지 전체: html·body 에 스크롤 관련 처리 없음(기본 동작). 구역 배경은 폭 전체, 안쪽 상자는 width 1100px + margin auto. 「구역 더하기/빼기」(0~4개)와 탭·후기·FAQ 로 길이를 창보다 짧게/길게.',
    '고정 상단 메뉴는 width: 100vw(left:0)로, 쿠키 배너는 left:0 right:0 로 고정. 스크롤바가 생기면 100vw 메뉴는 오른쪽이 스크롤바 밑으로 들어가 「서랍 열기」 버튼 위치가 달라질 수 있음.',
    '「노랑 구역」(calc)은 안쪽 상자 없이 padding 을 calc((100% - 1100px) / 2) 로 줘서 가운데 모음. 폭이 1100px 보다 좁으면 padding 이 음수가 되어 0 으로 처리됨.',
    '서랍 열기: body 에 overflow hidden 을 걸어 뒤 화면 스크롤을 잠그고, JS 로 (innerWidth - clientWidth) 만큼 body padding-right 를 보상(현업식 잠금). 고정 메뉴·배너·구역 배경은 보상하지 않음. 닫을 때 원복.',
    '서랍 안쪽: position: fixed; overflow-y: auto, padding-right 를 24px 로 넉넉히 줌(고정값 대처). 조작: 「서랍 항목 +10/-10」.',
    '로고 가로 줄(overflow-x: auto)과 요금 표 래퍼(overflow-x: auto)는 대처 없음. 조작: 「요금제 4개/2개」로 표 가로 스크롤바 생기고 사라짐, 로고는 「로고 늘리기」.',
    'sticky 제목(왼쪽 고정 상자)이 긴 오른쪽 목록 옆을 따라옴(top: lab-bar + 72px). 목록 길이는 「기능 항목 +5/-5」.',
    '늦게 불어남: 기능 탭 A/B/C 전환(높이 제각각), FAQ 펼치기(max-height 계산), 후기 「더 보기」(+3), 첫 진입 2초 뒤 「소식 배너」가 늦게 나타남.',
  ],
}

const FAQ = ['무료로 써 볼 수 있나요?', '데이터는 어디에 저장되나요?', '해지는 어떻게 하나요?']

export default function Page() {
  const [tab, setTab] = useState(0)
  const [extra, setExtra] = useState(1)
  const [reviews, setReviews] = useState(3)
  const [open, setOpen] = useState<number | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [drawerItems, setDrawerItems] = useState(12)
  const [plans, setPlans] = useState(4)
  const [logos, setLogos] = useState(8)
  const [pins, setPins] = useState(6)
  const [cookie, setCookie] = useState(true)
  const [news, setNews] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setNews(true), 2000)
    return () => window.clearTimeout(t)
  }, [])

  // 서랍이 열리면 뒤 스크롤을 잠그고, 사라지는 스크롤바 폭만큼 body 를 보상한다
  useEffect(() => {
    if (!drawer) return
    const sbw = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${sbw}px`
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [drawer])

  const tabs = [
    <p key="a">A 탭: 짧은 소개 한 줄.</p>,
    <div key="b">{Array.from({ length: 6 }, (_, i) => <p key={i}>B 탭 설명 {i + 1}: 팀 단위로 기록을 모아 한눈에 본다.</p>)}</div>,
    <div key="c">{Array.from({ length: 16 }, (_, i) => <p key={i}>C 탭 설명 {i + 1}: 자동 보고서가 매주 월요일에 만들어진다.</p>)}</div>,
  ]
  const sections = ['a', 'b', 'c', 'd']

  return (
    <div className="doc-landing-root">
      <nav className="doc-landing-nav">
        <b>모아보드</b>
        <span>기능 · 요금 · 후기 · 문의</span>
        <button onClick={() => setDrawer(true)}>서랍 열기</button>
      </nav>

      <header className="doc-landing-hero">
        <div className="doc-landing-wrap">
          <h1>팀의 기록을 한곳에</h1>
          <p>화면 높이를 꽉 채우는 첫 구역 (min-height: 100vh - 막대 - 메뉴)</p>
          {news && <p style={{ background: '#fde047', color: '#111', padding: 12 }}>소식 배너: 늦게 나타난 새 소식 (2초 뒤)</p>}
        </div>
      </header>

      <section className="doc-landing-sec a">
        <div className="doc-landing-wrap">
          <h2>기능 둘러보기</h2>
          <div className="doc-landing-tools">
            <button onClick={() => setExtra((n) => Math.min(4, n + 1))}>구역 더하기</button>
            <button onClick={() => setExtra((n) => Math.max(0, n - 1))}>구역 빼기</button>
            <button onClick={() => setPins((n) => n + 5)}>기능 항목 +5</button>
            <button onClick={() => setPins((n) => Math.max(1, n - 5))}>기능 항목 -5</button>
            <button onClick={() => setPlans((n) => (n === 4 ? 2 : 4))}>요금제 {plans === 4 ? '2개로' : '4개로'}</button>
            <button onClick={() => setLogos((n) => (n === 8 ? 2 : 8))}>로고 {logos === 8 ? '줄이기' : '늘리기'}</button>
            <button onClick={() => setReviews(3)}>후기 접기</button>
          </div>
          <div className="doc-landing-tabs">
            {['A', 'B', 'C'].map((t, i) => <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>탭 {t}</button>)}
          </div>
          <div className="doc-landing-tabbody">{tabs[tab]}</div>
        </div>
      </section>

      <section className="doc-landing-sec b">
        <div className="doc-landing-wrap">
          <h2>함께 쓰는 곳</h2>
          <div className="doc-landing-logos">
            {Array.from({ length: logos }, (_, i) => <div key={i}>고객 로고 {i + 1}</div>)}
          </div>
          <div className="doc-landing-pin" style={{ marginTop: 24 }}>
            <aside>왼쪽에 붙어 따라오는 제목</aside>
            <ul>{Array.from({ length: pins }, (_, i) => <li key={i}>기능 {i + 1}: 자세한 설명 한 줄</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="doc-landing-sec calc">
        <h2>노랑 구역 (padding 으로 가운데)</h2>
        <p>안쪽 상자 없이 좌우 padding 을 calc 로 줬다.</p>
      </section>

      <section className="doc-landing-sec c">
        <div className="doc-landing-wrap">
          <h2>요금</h2>
          <div className="doc-landing-pricewrap">
            <table>
              <thead><tr><th>항목</th>{Array.from({ length: plans }, (_, i) => <th key={i}>플랜 {i + 1}</th>)}</tr></thead>
              <tbody>
                {['월 요금', '저장 공간', '사용자 수', '지원'].map((r) => <tr key={r}><td>{r}</td>{Array.from({ length: plans }, (_, i) => <td key={i}>{r} 값 {i + 1}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="doc-landing-sec d">
        <div className="doc-landing-wrap">
          <h2>후기</h2>
          <div className="doc-landing-cards">
            {Array.from({ length: reviews }, (_, i) => <div key={i} className="doc-landing-card">후기 {i + 1}: 쓰고 나서 회의가 반으로 줄었다.</div>)}
          </div>
          <button style={{ marginTop: 12 }} onClick={() => setReviews((n) => n + 3)}>더 보기</button>
        </div>
      </section>

      <section className="doc-landing-sec c">
        <div className="doc-landing-wrap doc-landing-faq">
          <h2>자주 묻는 질문</h2>
          {FAQ.map((q, i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? null : i)}>{q}</button>
              <div className="ans" style={{ maxHeight: open === i ? 400 : 0 }}>
                {Array.from({ length: 6 }, (_, k) => <p key={k}>답변 {k + 1}: 설명이 여러 줄로 이어진다.</p>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {sections.slice(0, extra).map((s, i) => (
        <section key={s} className={`doc-landing-sec ${s}`}><div className="doc-landing-wrap"><h2>덧붙인 구역 {i + 1}</h2><p style={{ height: 160 }}>높이 160px 구역</p></div></section>
      ))}

      <footer className="doc-landing-foot"><div className="doc-landing-wrap">© 모아보드 · 바닥글</div></footer>

      {cookie && (
        <div className="doc-landing-cookie">쿠키를 사용합니다 (고정 배너) <button onClick={() => setCookie(false)}>닫기</button></div>
      )}
      <button className="doc-landing-top" onClick={() => window.scrollTo({ top: 0 })}>위</button>

      {drawer && (
        <>
          <div className="doc-landing-backdrop" onClick={() => setDrawer(false)} />
          <aside className="doc-landing-drawer">
            <button onClick={() => setDrawer(false)}>닫기</button>{' '}
            <button onClick={() => setDrawerItems((n) => n + 10)}>서랍 항목 +10</button>{' '}
            <button onClick={() => setDrawerItems((n) => Math.max(0, n - 10))}>서랍 항목 -10</button>
            <ul>{Array.from({ length: drawerItems }, (_, i) => <li key={i}>서랍 메뉴 {i + 1}</li>)}</ul>
          </aside>
        </>
      )}
    </div>
  )
}
