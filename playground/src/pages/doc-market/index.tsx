import { useEffect, useRef, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'doc-market',
  title: '상품 목록 · 검색 결과 · 가운데 카드(로그인/가입)',
  notes: [
    '페이지 전체: html 에 별도 스크롤 처리 없음. 대신 루트에 padding-left: calc(100vw - 100%) 를 줘서 스크롤바 폭만큼 보상하고, 안쪽은 max-width 1240px + margin 0 auto. 머리글은 sticky(top: lab-bar), 폭 100%. 모드(목록/검색 결과/로그인/가입) 전환과 「더 보기」로 길이가 창보다 짧아졌다 길어짐.',
    '목록 모드: 하단 감시 막대(sentinel)가 화면에 들어오면 0.8초 뒤 12개를 자동으로 더 불러옴(무한 스크롤). 「상품 비우기」·「검색 결과 없음」은 창보다 훨씬 짧아져 스크롤바가 사라짐.',
    '왼쪽 필터: sticky + height 260px + overflow-y: scroll(항상 스크롤바 표시, 대처 방식). 조작: 「필터 항목 늘리기/줄이기」로 내용이 넘치거나 짧아져도 스크롤바 자리는 유지.',
    '후기 목록: height 180px + overflow-y: auto + scrollbar-gutter: stable both-edges(양쪽 자리 선점). 조작: 「후기 +10/-10」.',
    '빠른 보기 대화 상자(상품 카드 클릭): fixed 전체 덮개 + 가운데 상자(max-height 70vh, overflow-y: auto). 뒤 화면 스크롤은 잠그지 않음. 조작: 대화 상자 안 「옵션 +5/-5」.',
    '로그인·가입 카드: 가운데 정렬(flex), 최소 높이 calc(100vh - 막대 - 머리글). 「100vh 로 바꾸기」를 누르면 min-height 가 100vh 라서 항상 막대 높이만큼 넘쳐 스크롤바가 생김(흔한 실수). 가입 모드는 「사업자 항목 더하기」로 카드가 커져 스크롤바가 생김.',
    '가입 카드 안의 약관 상자: height 110px + overflow-y: auto, 대처 없음. 조작: 「약관 길게/짧게」로 안쪽 스크롤바가 생기고 사라짐.',
  ],
}

type Mode = 'list' | 'search' | 'login' | 'join'
const COLORS = ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bae6fd', '#ddd6fe']

export default function Page() {
  const [mode, setMode] = useState<Mode>('list')
  const [count, setCount] = useState(12)
  const [filters, setFilters] = useState(8)
  const [reviews, setReviews] = useState(6)
  const [quick, setQuick] = useState<number | null>(null)
  const [options, setOptions] = useState(4)
  const [biz, setBiz] = useState(false)
  const [terms, setTerms] = useState(false)
  const [fullVh, setFullVh] = useState(false)
  const [query, setQuery] = useState('')
  const sentinel = useRef<HTMLDivElement>(null)

  // 무한 스크롤: 감시 막대가 보이면 잠시 뒤 12개 추가
  useEffect(() => {
    const el = sentinel.current
    if (!el || count >= 60) return
    let t = 0
    const io = new IntersectionObserver(([e]) => {
      window.clearTimeout(t)
      if (e.isIntersecting) t = window.setTimeout(() => setCount((n) => Math.min(60, n + 12)), 800)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      window.clearTimeout(t)
    }
  }, [mode, count])

  const modes: [Mode, string][] = [['list', '목록'], ['search', '검색 결과'], ['login', '로그인'], ['join', '가입']]
  const shown = mode === 'search' ? 0 : count

  return (
    <div className="doc-market-root">
      <div className="doc-market-head">
        <div className="doc-market-head-in">
          <b style={{ color: '#fff' }}>장터</b>
          <input value={query} placeholder="상품 검색" onChange={(e) => setQuery(e.target.value)} />
          {modes.map(([m, label]) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{label}</button>)}
        </div>
      </div>

      {(mode === 'list' || mode === 'search') && (
        <div className="doc-market-page">
          <div className="doc-market-layout">
            <aside className="doc-market-filter">
              <b>필터</b>
              {Array.from({ length: filters }, (_, i) => <label key={i}><input type="checkbox" /> 분류 {i + 1}</label>)}
            </aside>
            <main className="doc-market-main">
              <div className="doc-market-tools">
                <button onClick={() => setCount((n) => Math.min(60, n + 12))}>더 보기(+12)</button>
                <button onClick={() => setCount(12)}>12개로</button>
                <button onClick={() => setCount(0)}>상품 비우기</button>
                <button onClick={() => setFilters((n) => (n === 8 ? 30 : 8))}>필터 항목 {filters === 8 ? '늘리기' : '줄이기'}</button>
                <button onClick={() => setReviews((n) => n + 10)}>후기 +10</button>
                <button onClick={() => setReviews((n) => Math.max(0, n - 10))}>후기 -10</button>
              </div>
              {mode === 'search' && <div className="doc-market-empty">「{query || '검색어'}」 검색 결과가 없습니다.</div>}
              <div className="doc-market-grid">
                {Array.from({ length: shown }, (_, i) => (
                  <div key={i} className="doc-market-card" onClick={() => setQuick(i)}>
                    <div className="doc-market-thumb" style={{ background: COLORS[i % 6] }}>상품 이미지 {i + 1}</div>
                    <div className="t">나무 컵받침 {i + 1}호<br />{(i + 1) * 1100}원</div>
                  </div>
                ))}
              </div>
              {mode === 'list' && count < 60 && count > 0 && <div ref={sentinel} className="doc-market-sentinel">불러오는 중…</div>}
              <div className="doc-market-reviews">
                {Array.from({ length: reviews }, (_, i) => <div key={i}>후기 {i + 1}: 포장이 깔끔했어요.</div>)}
              </div>
            </main>
          </div>
        </div>
      )}

      {(mode === 'login' || mode === 'join') && (
        <div className={`doc-market-center${fullVh ? ' vh' : ''}`}>
          <div className="doc-market-card2">
            <h3 style={{ marginTop: 0 }}>{mode === 'login' ? '로그인' : '가입'}</h3>
            <label>이메일<input type="text" /></label>
            <label>비밀번호<input type="password" /></label>
            {mode === 'join' && (
              <>
                <label>비밀번호 확인<input type="password" /></label>
                {biz && Array.from({ length: 6 }, (_, i) => <label key={i}>사업자 항목 {i + 1}<input type="text" /></label>)}
                <div className="doc-market-terms">
                  {Array.from({ length: terms ? 14 : 3 }, (_, i) => <p key={i}>제 {i + 1} 조: 약관 내용이 여기에 적힌다.</p>)}
                </div>
              </>
            )}
            <div className="doc-market-tools" style={{ marginTop: 12 }}>
              <button onClick={() => setFullVh((v) => !v)}>{fullVh ? '막대 뺀 높이로' : '100vh 로 바꾸기'}</button>
              {mode === 'join' && <button onClick={() => setBiz((v) => !v)}>사업자 항목 {biz ? '빼기' : '더하기'}</button>}
              {mode === 'join' && <button onClick={() => setTerms((v) => !v)}>약관 {terms ? '짧게' : '길게'}</button>}
            </div>
          </div>
        </div>
      )}

      {quick !== null && (
        <div className="doc-market-overlay" onClick={() => setQuick(null)}>
          <div className="doc-market-dialog" onClick={(e) => e.stopPropagation()}>
            <b>나무 컵받침 {quick + 1}호 — 빠른 보기</b>
            <div>
              <button onClick={() => setOptions((n) => n + 5)}>옵션 +5</button>{' '}
              <button onClick={() => setOptions((n) => Math.max(0, n - 5))}>옵션 -5</button>{' '}
              <button onClick={() => setQuick(null)}>닫기</button>
            </div>
            {Array.from({ length: options }, (_, i) => <p key={i}>옵션 {i + 1}: 색상·크기 선택지</p>)}
          </div>
        </div>
      )}
    </div>
  )
}
