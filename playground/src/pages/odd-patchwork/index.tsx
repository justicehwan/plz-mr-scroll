import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'odd-patchwork',
  title: '덧대어 짠 관리 화면 — 서로 다른 손이 만든 5가지 대처',
  notes: [
    '문서 전체(html): 맨 바깥 래퍼 margin-left: calc(100vw - 100%) 로 문서 스크롤바 폭만큼 밀어 가운데 정렬 유지(문서 스크롤바가 있을 때만 의미 있음, 래퍼는 wrap>inner>container>row>col>section 으로 6겹). 상단 「공지 영역」 버튼으로 문서 길이를 900px 늘려 문서 스크롤바를 만들고 없앰.',
    '「주문 목록」(BEM, 왼쪽 위): .odd-patchwork-order__scroll 높이 190px, 앞 규칙 overflow:hidden 을 뒤 규칙의 #id + !important 가 덮어 auto 로 만듦. 머리글은 position:sticky. 스크롤바 대처 없음. 「행 +5 / -5」.',
    '「알림 센터」(오른쪽 위): 유틸리티 class + 인라인 style 혼합, overflow-y:auto, 스크롤바 폭을 15px 로 가정해 padding-left 만 23px(8+15)로 늘려 좌우를 맞춤(스크롤바가 있을 때만 맞고 폭이 15가 아니면 틀어짐). 5초마다 알림이 저절로 쌓이고 12건에서 2건으로 비움. 「알림 +3 / -3」.',
    '「상세 패널」(왼쪽 가운데): 자바스크립트로 대처 — ResizeObserver·MutationObserver 가 offsetWidth-clientWidth 를 재서 CSS 변수 --odd-patchwork-gutter 에 넣고 padding-left 로 반영(잘 된 쪽). 「다시 불러오기」는 1.2초 뒤 내용이 채워지는 시간차 로딩(그 동안 스켈레톤 2줄), 「항목 +5 / -5」.',
    '「테두리 틀 안 목록」(상세 패널 아래): 스크롤 영역에는 테두리도 여백도 없고, 그걸 여백 없이 감싼 틀에 3px 테두리, 바깥 카드에 여백 20px. 스크롤바가 틀 테두리 바로 밖 카드 여백에 떠야 한다. 「항목 +5 / -5」.',
    '「월간 보고서」(오른쪽 가운데): scrollbar-gutter: stable both-edges + overflow-y:auto(CSS 로 제대로 대처). 좌우 가장자리 색으로 자리 확보 여부 확인. 「줄 +4 / -4」.',
    '「겹겹이 싼 래퍼」(왼쪽 아래): 바깥 div(overflow:hidden, 폭 고정) 안쪽 div 가 overflow-y:scroll + padding-right:17px(content-box) 로 스크롤바를 바깥으로 밀어 숨기는 옛 해킹. 스크롤바 폭이 17 이 아니면 내용이 잘리거나 틈이 생김. 4겹 래퍼, 「줄 +5 / -5」.',
    '「보기 방식 바꾸기」(오른쪽 아래): 한 영역의 overflow 를 class(항상 scroll) / !important(auto) / 인라인(hidden) 세 가지 서로 덮어쓰는 규칙으로 바꿈. 「항상 / 필요할 때 / 숨김」 버튼으로 모드 변경, 「줄 +4 / -4」.',
    '「모달·드로어 잠금」: 「모달」 「드로어」 버튼이 뒤 화면 스크롤을 직접 잠금. 방식 select — 잠금 없음 / body overflow:hidden(보정 없음) / body overflow:hidden + padding-right 측정 보정 / position:fixed + top:-scrollY / html overflow:hidden. 모달 안에는 overscroll-behavior:contain 목록, 드로어 자체도 overflow-y:auto. 닫을 때나 페이지가 내려갈 때 body·html 인라인 값을 원래대로 복원.',
  ],
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** 여러 사람이 각자 만든 버튼 묶음(여기는 일부러 class 도 인라인도 섞음) */
function Step(p: { n: number; set: (n: number) => void; by: number; max?: number; label: string }) {
  return (
    <div className="odd-patchwork-step">
      <button onClick={() => p.set(Math.min(p.max ?? 60, p.n + p.by))}>{p.label} +{p.by}</button>
      <button onClick={() => p.set(Math.max(0, p.n - p.by))}>-{p.by}</button>
      <button onClick={() => p.set(0)}>비움</button>
      <span style={{ marginLeft: 6, color: '#666' }}>{p.n}</span>
    </div>
  )
}

/** 자바스크립트로 스크롤바 폭을 재서 CSS 변수에 넣는다(내용·크기가 바뀔 때마다 다시 잼) */
function useScrollbarGutter<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = () => {
      const w = `${el.offsetWidth - el.clientWidth}px`
      if (el.style.getPropertyValue('--odd-patchwork-gutter') !== w) el.style.setProperty('--odd-patchwork-gutter', w)
    }
    const ro = new ResizeObserver(apply)
    const watch = () => {
      ro.disconnect()
      ro.observe(el)
      Array.from(el.children).forEach((c) => ro.observe(c))
    }
    const mo = new MutationObserver(() => {
      watch()
      apply()
    })
    mo.observe(el, { childList: true })
    watch()
    apply()
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
  return ref
}

type LockMode = 'none' | 'body-hidden' | 'body-hidden-pad' | 'body-fixed' | 'html-hidden'

/** 뒤 화면 스크롤 잠금. 열려 있는 동안만 걸고, 닫힐 때·내려갈 때 원래 값으로 되돌린다. */
function useScrollLock(active: boolean, mode: LockMode) {
  useEffect(() => {
    if (!active || mode === 'none') return
    const body = document.body
    const html = document.documentElement
    const saved = {
      bo: body.style.overflow,
      bp: body.style.paddingRight,
      bpos: body.style.position,
      bt: body.style.top,
      bw: body.style.width,
      ho: html.style.overflow,
    }
    const y = window.scrollY
    const sbw = window.innerWidth - html.clientWidth
    if (mode === 'body-hidden') body.style.overflow = 'hidden'
    if (mode === 'body-hidden-pad') {
      body.style.overflow = 'hidden'
      body.style.paddingRight = `${sbw}px`
    }
    if (mode === 'body-fixed') {
      body.style.position = 'fixed'
      body.style.top = `-${y}px`
      body.style.width = '100%'
    }
    if (mode === 'html-hidden') html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = saved.bo
      body.style.paddingRight = saved.bp
      body.style.position = saved.bpos
      body.style.top = saved.bt
      body.style.width = saved.bw
      html.style.overflow = saved.ho
      if (mode === 'body-fixed') window.scrollTo(0, y)
    }
  }, [active, mode])
}

function Overlay(p: { kind: 'modal' | 'drawer'; mode: LockMode; onClose: () => void }) {
  const [n, setN] = useState(8)
  useScrollLock(true, p.mode)
  return (
    <div className={`odd-patchwork-overlay odd-patchwork-overlay--${p.kind}`} onClick={p.onClose}>
      <div className={`odd-patchwork-sheet odd-patchwork-sheet--${p.kind}`} onClick={(e) => e.stopPropagation()}>
        <h4>{p.kind === 'modal' ? '「주문 취소 확인」 모달' : '「필터」 드로어'}</h4>
        <p>뒤 화면의 스크롤은 「{p.mode}」 방식으로 잠겨 있다. 뒤 화면의 가장자리가 움직이는지 본다.</p>
        <div className="odd-patchwork-sheet__list">
          {range(n).map((i) => (
            <div key={i}>항목 {i + 1} — 취소 사유 선택지</div>
          ))}
        </div>
        <Step n={n} set={setN} by={4} label="항목" />
        <button className="odd-patchwork-close" onClick={p.onClose}>닫기</button>
      </div>
    </div>
  )
}

const WHO = ['김가나', '이다라', '박마바', '최사아', '정자차']
const ITEMS = ['결제 완료', '배송 시작', '재고 부족', '환불 요청', '리뷰 등록']

export default function Page() {
  const [orders, setOrders] = useState(8)
  const [notes, setNotes] = useState(5)
  const [detail, setDetail] = useState(10)
  const [framed, setFramed] = useState(10)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(14)
  const [hidden, setHidden] = useState(14)
  const [view, setView] = useState(10)
  const [viewMode, setViewMode] = useState<'always' | 'auto' | 'none'>('auto')
  const [extra, setExtra] = useState(false)
  const [lock, setLock] = useState<LockMode>('body-hidden')
  const [open, setOpen] = useState<null | 'modal' | 'drawer'>(null)
  const gutterRef = useScrollbarGutter<HTMLDivElement>()

  // 알림이 5초마다 저절로 쌓임
  useEffect(() => {
    const t = setInterval(() => setNotes((n) => (n >= 12 ? 2 : n + 1)), 5000)
    return () => clearInterval(t)
  }, [])
  // 시간차 로딩: 처음 열릴 때와 「다시 불러오기」 후 1.2초 뒤 채워짐
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(t)
  }, [loading])

  return (
    <div id="odd-patchwork-app" className="odd-patchwork-wrap">
      <div className="odd-patchwork-inner">
        <div className="odd-patchwork-container">
          <header className="odd-patchwork-top">
            <strong>주문 관리 콘솔</strong>
            <span style={{ color: '#789' }}> — 2019~2024 여러 담당자가 덧붙인 화면</span>
            <button style={{ float: 'right' }} onClick={() => setExtra(!extra)}>
              공지 영역 {extra ? '접기' : '펼치기 (+900px)'}
            </button>
          </header>
          <div className="odd-patchwork-row odd-patchwork-cf">
            <div className="odd-patchwork-col">
              <section className="odd-patchwork-card">
                <h3>주문 목록 <small>BEM · !important 로 덮어씀</small></h3>
                <div className="odd-patchwork-order">
                  <div className="odd-patchwork-order__scroll">
                    <table className="odd-patchwork-order__table">
                      <thead>
                        <tr><th>번호</th><th>주문자</th><th>상태</th></tr>
                      </thead>
                      <tbody>
                        {range(orders).map((i) => (
                          <tr key={i}><td>#{1000 + i}</td><td>{WHO[i % 5]}</td><td>{ITEMS[i % 5]}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Step n={orders} set={setOrders} by={5} label="행" />
              </section>

              <section className="odd-patchwork-card">
                <h3>상세 패널 <small>JS 로 스크롤바 폭 측정</small></h3>
                <div className="odd-patchwork-detail">
                  <div className="odd-patchwork-detail__scroll" ref={gutterRef}>
                    {loading ? (
                      <div className="odd-patchwork-skeleton"><i /><i /></div>
                    ) : (
                      <div>
                        {range(detail).map((i) => (
                          <p key={i} className="odd-patchwork-detail__row">항목 {i + 1}: 상세 내용이 한 줄 들어간다</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="odd-patchwork-step">
                  <button onClick={() => setLoading(true)}>다시 불러오기</button>
                </div>
                <Step n={detail} set={setDetail} by={5} label="항목" />
              </section>

              {/* 굵은 테두리 틀 안의 꽉 찬 목록 — 스크롤 영역에는 테두리·여백이 없고, 바깥 카드에 여백 20px */}
              <section className="odd-patchwork-card" style={{ padding: 20 }}>
                <h3>테두리 틀 안 목록 <small>틀 테두리 3px, 카드 여백 20px</small></h3>
                <div style={{ border: '3px solid #b45309', background: '#fff' }}>
                  <div style={{ height: 150, overflowY: 'auto' }}>
                    {range(framed).map((i) => (
                      <p key={i} style={{ margin: 0, padding: '3px 8px', borderBottom: '1px solid #f3d9b1' }}>항목 {i + 1}: 틀을 꽉 채운 줄</p>
                    ))}
                  </div>
                </div>
                <Step n={framed} set={setFramed} by={5} label="항목" />
              </section>

              <section className="odd-patchwork-card">
                <h3>겹겹이 싼 래퍼 <small>스크롤바 밀어내기 해킹(17px 가정)</small></h3>
                <div className="odd-patchwork-w1">
                  <div className="odd-patchwork-w2">
                    <div className="odd-patchwork-w3">
                      <div className="odd-patchwork-hide">
                        <div className="odd-patchwork-hide__in">
                          {range(hidden).map((i) => (
                            <p key={i}>가려진 스크롤바 안의 {i + 1}번째 줄 — 오른쪽 끝까지 닿는 내용</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Step n={hidden} set={setHidden} by={5} label="줄" />
              </section>
            </div>

            <div className="odd-patchwork-col">
              <section className="odd-patchwork-card">
                <h3>알림 센터 <small>유틸 class + 인라인, 15px 가정 거울 패딩</small></h3>
                <div
                  className="odd-patchwork-u-box odd-patchwork-u-h180 odd-patchwork-u-scroll-y"
                  style={{ paddingLeft: 23, paddingRight: 8, background: '#fffbe8' }}
                >
                  {range(notes).map((i) => (
                    <div key={i} className="odd-patchwork-u-line">알림 {i + 1} · 새 주문이 들어왔습니다</div>
                  ))}
                </div>
                <Step n={notes} set={setNotes} by={3} label="알림" />
              </section>

              <section className="odd-patchwork-card">
                <h3>월간 보고서 <small>scrollbar-gutter: stable both-edges</small></h3>
                <div className="odd-patchwork-report">
                  {range(report).map((i) => (
                    <p key={i}>{i + 1}주차 · 매출 집계 {(i * 37 + 120) % 900}건</p>
                  ))}
                </div>
                <Step n={report} set={setReport} by={4} label="줄" />
              </section>

              <section className="odd-patchwork-card">
                <h3>보기 방식 바꾸기 <small>서로 덮어쓰는 overflow 규칙</small></h3>
                <div
                  className={`odd-patchwork-view ${viewMode === 'always' ? 'is-always' : ''} ${viewMode === 'auto' ? 'is-auto' : ''}`}
                  style={viewMode === 'none' ? { overflow: 'hidden' } : undefined}
                >
                  {range(view).map((i) => (
                    <div key={i} className="odd-patchwork-view__row">행 {i + 1} · 양쪽 끝이 보이는 한 줄</div>
                  ))}
                </div>
                <div className="odd-patchwork-step">
                  {(['always', 'auto', 'none'] as const).map((m) => (
                    <button key={m} className={viewMode === m ? 'on' : ''} onClick={() => setViewMode(m)}>
                      {m === 'always' ? '항상' : m === 'auto' ? '필요할 때' : '숨김'}
                    </button>
                  ))}
                </div>
                <Step n={view} set={setView} by={4} label="줄" />
              </section>

              <section className="odd-patchwork-card">
                <h3>모달·드로어 잠금 <small>뒤 화면 스크롤을 손으로 잠금</small></h3>
                <div className="odd-patchwork-step">
                  <select value={lock} onChange={(e) => setLock(e.target.value as LockMode)}>
                    <option value="none">잠금 없음</option>
                    <option value="body-hidden">body overflow:hidden (보정 없음)</option>
                    <option value="body-hidden-pad">body hidden + padding-right 보정</option>
                    <option value="body-fixed">body position:fixed + top:-scrollY</option>
                    <option value="html-hidden">html overflow:hidden</option>
                  </select>
                </div>
                <div className="odd-patchwork-step">
                  <button onClick={() => setOpen('modal')}>모달 열기</button>
                  <button onClick={() => setOpen('drawer')}>드로어 열기</button>
                </div>
              </section>
            </div>
          </div>
          <div className="odd-patchwork-notice" style={{ height: extra ? 900 : 24 }}>
            {extra ? '공지 영역 (900px) — 문서 스크롤바가 생기는 만큼 아래로 길어진 부분' : ''}
          </div>
        </div>
      </div>
      {open && <Overlay kind={open} mode={lock} onClose={() => setOpen(null)} />}
    </div>
  )
}
