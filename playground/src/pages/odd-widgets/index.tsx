import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'odd-widgets',
  title: '손으로 짠 위젯 — 가상 목록·무한 스크롤·자동완성·달력·탭·채팅',
  notes: [
    '문서 전체(html): 화면을 3x2 칸으로 꽉 채움(높이 calc(100vh - var(--lab-bar)), 최소 640px). 창이 640px 보다 낮을 때만 문서 스크롤바가 생김. 문서 쪽 대처 없음.',
    '「가상 목록」: 손으로 짠 가상 스크롤. 바깥 div overflow-y:auto, 안쪽 spacer 높이 = 개수x32px, 보이는 줄만 position:absolute 로 그림. 줄·머리글 폭을 자바스크립트가 clientWidth 로 재서 px 로 지정(ResizeObserver, 스크롤바가 생기면 한 박자 늦게 따라감). 머리글은 sticky. 「0 / 8 / 40 / 1천 / 10만」 버튼과 「자동 증가」(0.7초마다 2줄, 60줄 넘으면 4줄로 되돌림).',
    '「무한 스크롤」: IntersectionObserver 로 바닥 감시 요소가 보이면 0.7초 뒤 4개씩 더 불러옴. 처음 3개라 스크롤바가 없는 상태에서 보일 때까지 계속 채움(스크롤바가 생길 때까지 자동으로 늘어남). 줄 높이가 제각각, 폭은 calc(100% - 20px) 로 고정(스크롤바 대처 아님). 「자동 불러오기」 켬/끔, 「+4 / -4 / 처음으로」.',
    '「자동완성」: input 아래 position:absolute 드롭다운(max-height:168px, overflow-y:auto), 결과 개수에 따라 스크롤바 생김/사라짐, 방향키로 움직이면 scrollIntoView 로 스크롤. 대처 없음. 예시 검색어 버튼(전체 192개 / 「가람」 24개 / 「가람동」 3개 / 없음 / 「나」 24개).',
    '「날짜·시간 선택」: 7열 grid 달력(주 수에 따라 높이 변함), 시·분 두 열은 max-height:200px 세로 목록이라 항목 수(시 범위 4개/24개, 분 간격 15·5·1분)에 따라 스크롤바가 생김. 열 폭 52px 고정에 가운데 정렬(대처 없음). 「연도 목록」은 달력 위에 겹쳐 뜨는 grid 목록이며 열 때 scrollTop 을 코드로 맞춤.',
    '「탭·아코디언·드로어」: 탭 3개가 서로 다른 방식으로 숨김 — 아코디언 탭 display:none, 드로어 탭 visibility:hidden+absolute, 빈 탭 height:0. 아코디언은 max-height 전환(0.3초) 동안 overflow 가 바뀌며 스크롤바가 깜박일 수 있음, 펼친 칸은 overflow-y:auto. 드로어 탭의 뒤 목록은 드로어를 열면 overflow-y:hidden 으로 잠그는데 「그냥 잠금」은 보정 없음, 「보정 잠금」은 잠그기 직전 offsetWidth-clientWidth 를 재 padding-right 로 채움. 「줄 +/-」 로 내용 양 변경.',
    '「채팅」: flex-direction: column-reverse 스크롤 영역(최신이 DOM 첫 번째, 화면은 아래에 붙음), 말풍선은 align-self 로 좌우 정렬, 인라인 style. 3초마다 메시지가 저절로 늘어 25개가 되면 2개로 비움. 「보내기 / +10 / 비우기 / 자동」 버튼. 스크롤바 대처 없음.',
  ],
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function Cell(p: { title: string; hint: string; ctl?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`odd-widgets-cell ${p.className ?? ''}`}>
      <header className="odd-widgets-cell__head">
        <b>{p.title}</b>
        <small>{p.hint}</small>
      </header>
      {p.ctl && <div className="odd-widgets-ctl">{p.ctl}</div>}
      <div className="odd-widgets-body">{p.children}</div>
    </section>
  )
}

function Btn(p: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={p.on ? 'on' : ''} onClick={p.onClick}>
      {p.children}
    </button>
  )
}

/* ---------------- 1. 가상 목록 ---------------- */
const ROW = 32
function VirtualList() {
  const [count, setCount] = useState(40)
  const [auto, setAuto] = useState(false)
  const [top, setTop] = useState(0)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setCount((n) => (n >= 60 ? 4 : n + 2)), 700)
    return () => clearInterval(t)
  }, [auto])

  const start = Math.max(0, Math.floor(top / ROW) - 3)
  const end = Math.min(count, Math.ceil((top + size.h) / ROW) + 3)
  return (
    <Cell
      title="가상 목록"
      hint={`전체 ${count.toLocaleString()}줄 중 ${Math.max(0, end - start)}줄만 그림`}
      ctl={
        <>
          {[0, 8, 40, 1000, 100000].map((n) => (
            <Btn key={n} on={count === n} onClick={() => setCount(n)}>
              {n === 1000 ? '1천' : n === 100000 ? '10만' : n}
            </Btn>
          ))}
          <Btn on={auto} onClick={() => setAuto(!auto)}>자동 증가</Btn>
        </>
      }
    >
      <div ref={ref} className="odd-widgets-vl" onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
        <div className="odd-widgets-vl__head" style={{ width: size.w }}>
          <span style={{ width: 50 }}>번호</span>
          <span style={{ width: size.w - 50 - 70 }}>이름</span>
          <span style={{ width: 70 }}>값</span>
        </div>
        <div style={{ height: count * ROW, position: 'relative' }}>
          {range(Math.max(0, end - start)).map((k) => {
            const i = start + k
            return (
              <div key={i} className="odd-widgets-vl__row" style={{ top: i * ROW, height: ROW, width: size.w }}>
                <span style={{ width: 50 }}>{i + 1}</span>
                <span style={{ width: size.w - 50 - 70 }}>가상 항목 {i + 1}</span>
                <span style={{ width: 70 }}>{(i * 7919) % 1000}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Cell>
  )
}

/* ---------------- 2. 무한 스크롤 ---------------- */
const FEED_MAX = 40
function Feed() {
  const [items, setItems] = useState(3)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  // 바닥 감시: 보이면 0.7초 뒤 4개 추가. 개수가 바뀔 때마다 감시자를 새로 만들어 "아직 보이는 중" 도 다시 잡는다.
  useEffect(() => {
    const el = sentinel.current
    if (!auto || busy || !el || items >= FEED_MAX) return
    let timer = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setBusy(true)
        timer = window.setTimeout(() => {
          setItems((n) => Math.min(FEED_MAX, n + 4))
          setBusy(false)
        }, 700)
      },
      { root: rootRef.current },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
  }, [auto, busy, items])

  return (
    <Cell
      title="무한 스크롤"
      hint={`${items}/${FEED_MAX}개`}
      ctl={
        <>
          <Btn on={auto} onClick={() => setAuto(!auto)}>자동 불러오기</Btn>
          <Btn onClick={() => setItems((n) => Math.min(FEED_MAX, n + 4))}>+4</Btn>
          <Btn onClick={() => setItems((n) => Math.max(0, n - 4))}>-4</Btn>
          <Btn onClick={() => setItems(3)}>처음으로</Btn>
        </>
      }
    >
      <div ref={rootRef} className="odd-widgets-feed">
        {range(items).map((i) => (
          <article key={i} className="odd-widgets-feed__item" style={{ height: 44 + ((i * 37) % 56) }}>
            게시물 {i + 1}
          </article>
        ))}
        <div ref={sentinel} className="odd-widgets-feed__end">
          {items >= FEED_MAX ? '더 없음' : busy ? '불러오는 중…' : auto ? '아래로 내리면 더 불러옴' : '자동 꺼짐'}
        </div>
      </div>
    </Cell>
  )
}

/* ---------------- 3. 자동완성 ---------------- */
const NAMES = ['가람', '나래', '다솜', '마루', '바다', '사랑', '아름', '자람'].flatMap((p) =>
  ['동', '리', '마을', '고개', '나루', '들', '골', '터'].flatMap((s) => ['A', 'B', 'C'].map((z) => `${p}${s} ${z}구역`)),
)
function Autocomplete() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [act, setAct] = useState(0)
  const [chosen, setChosen] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const hits = NAMES.filter((n) => n.includes(q))

  useEffect(() => {
    listRef.current?.children[act]?.scrollIntoView({ block: 'nearest' })
  }, [act, open])

  const pick = (n: string) => {
    setChosen(n)
    setQ(n)
    setOpen(false)
  }
  const preset = (v: string) => {
    setQ(v)
    setAct(0)
    setOpen(true)
  }
  return (
    <Cell
      title="자동완성"
      hint={`선택: ${chosen || '없음'}`}
      ctl={
        <>
          <Btn onClick={() => preset('')}>전체</Btn>
          <Btn onClick={() => preset('가람')}>가람</Btn>
          <Btn onClick={() => preset('가람동')}>가람동</Btn>
          <Btn onClick={() => preset('나')}>나</Btn>
          <Btn onClick={() => preset('없는말')}>없음</Btn>
        </>
      }
    >
      <div className="odd-widgets-ac">
        <input
          className="odd-widgets-ac__input"
          value={q}
          placeholder="지명을 입력"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value)
            setAct(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setAct((a) => Math.min(hits.length - 1, a + 1))
            if (e.key === 'ArrowUp') setAct((a) => Math.max(0, a - 1))
            if (e.key === 'Enter' && hits[act]) pick(hits[act])
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        {open && (
          <ul ref={listRef} className="odd-widgets-ac__list">
            {hits.length === 0 && <li className="odd-widgets-ac__none">결과 없음</li>}
            {hits.map((n, i) => (
              <li key={n} className={i === act ? 'act' : ''} onMouseEnter={() => setAct(i)} onMouseDown={() => pick(n)}>
                {n}
              </li>
            ))}
          </ul>
        )}
        <p className="odd-widgets-ac__help">아래 글자는 드롭다운이 열리면 가려진다. 결과 {hits.length}개.</p>
      </div>
    </Cell>
  )
}

/* ---------------- 4. 날짜·시간 선택 ---------------- */
function DatePicker() {
  const [ym, setYm] = useState({ y: 2026, m: 10 })
  const [picked, setPicked] = useState(19)
  const [step, setStep] = useState(5)
  const [wide, setWide] = useState(false)
  const [years, setYears] = useState(false)
  const yearRef = useRef<HTMLDivElement>(null)
  const first = new Date(ym.y, ym.m, 1).getDay()
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells = [...range(first).map(() => 0), ...range(days).map((d) => d + 1)]
  const hours = wide ? range(24) : [9, 10, 11, 12]
  const mins = range(60 / step).map((i) => i * step)
  const move = (d: number) => setYm(({ y, m }) => ({ y: y + Math.floor((m + d) / 12), m: (m + d + 12) % 12 }))

  useLayoutEffect(() => {
    if (years && yearRef.current) yearRef.current.scrollTop = Math.floor((ym.y - 1990) / 4) * 24
  }, [years, ym.y])

  return (
    <Cell
      title="날짜·시간 선택"
      hint={`${ym.y}.${ym.m + 1}.${picked}`}
      ctl={
        <>
          <Btn onClick={() => setStep(step === 15 ? 5 : step === 5 ? 1 : 15)}>분 간격 {step}분</Btn>
          <Btn on={wide} onClick={() => setWide(!wide)}>시 {wide ? '24개' : '4개'}</Btn>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <button onClick={() => move(-1)}>◀</button>
            <button onClick={() => setYears(!years)}>
              {ym.y}년 {ym.m + 1}월 · 연도 목록
            </button>
            <button onClick={() => move(1)}>▶</button>
          </div>
          <div className="odd-widgets-cal">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <b key={d}>{d}</b>
            ))}
            {cells.map((d, i) =>
              d === 0 ? (
                <span key={i} />
              ) : (
                <button key={i} className={d === picked ? 'on' : ''} onClick={() => setPicked(d)}>
                  {d}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="odd-widgets-time">{hours.map((h) => <div key={h}>{String(h).padStart(2, '0')}시</div>)}</div>
        <div className="odd-widgets-time">{mins.map((m) => <div key={m}>{String(m).padStart(2, '0')}분</div>)}</div>
        {years && (
          <div ref={yearRef} className="odd-widgets-years">
            {range(71).map((i) => (
              <button
                key={i}
                className={1990 + i === ym.y ? 'on' : ''}
                onClick={() => {
                  setYm({ ...ym, y: 1990 + i })
                  setYears(false)
                }}
              >
                {1990 + i}
              </button>
            ))}
          </div>
        )}
      </div>
    </Cell>
  )
}

/* ---------------- 5. 탭·아코디언·드로어 ---------------- */
function Tabs() {
  const [tab, setTab] = useState(0)
  const [lines, setLines] = useState(4)
  const [openAcc, setOpenAcc] = useState<number | null>(0)
  const [lock, setLock] = useState<null | 'plain' | 'comp'>(null)
  const [comp, setComp] = useState(0)
  const [rows, setRows] = useState(20)
  const bg = useRef<HTMLDivElement>(null)

  const openDrawer = (mode: 'plain' | 'comp') => {
    const el = bg.current
    setComp(el ? el.offsetWidth - el.clientWidth : 0)
    setLock(mode)
  }
  return (
    <Cell
      title="탭·아코디언·드로어"
      hint={['display:none 숨김', 'visibility 숨김', 'height:0 숨김'][tab]}
      ctl={
        <>
          {['아코디언', '드로어', '빈 탭'].map((t, i) => (
            <Btn key={t} on={tab === i} onClick={() => setTab(i)}>{t}</Btn>
          ))}
          <Btn onClick={() => (tab === 1 ? setRows((n) => n + 10) : setLines((n) => Math.min(40, n + 4)))}>줄 +</Btn>
          <Btn onClick={() => (tab === 1 ? setRows((n) => Math.max(0, n - 10)) : setLines((n) => Math.max(0, n - 4)))}>줄 -</Btn>
        </>
      }
    >
      <div style={{ position: 'relative', height: '100%' }}>
        <div className={`odd-widgets-pn odd-widgets-pn--a ${tab === 0 ? 'on' : ''}`}>
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <button className="odd-widgets-acc__h" onClick={() => setOpenAcc(openAcc === i ? null : i)}>
                {openAcc === i ? '▼' : '▶'} 항목 {i + 1}
              </button>
              <div className={`odd-widgets-acc__b ${openAcc === i ? 'open' : ''}`}>
                {range(lines + i * 2).map((k) => (
                  <p key={k}>항목 {i + 1}의 {k + 1}번째 줄</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={`odd-widgets-pn odd-widgets-pn--b ${tab === 1 ? 'on' : ''}`}>
          <div
            ref={bg}
            className="odd-widgets-bg"
            style={{ overflowY: lock ? 'hidden' : 'auto', paddingRight: lock === 'comp' ? comp : 0 }}
          >
            {range(rows).map((i) => (
              <div key={i}>뒤 목록 {i + 1}</div>
            ))}
          </div>
          <div className="odd-widgets-dr__btns">
            <button onClick={() => openDrawer('plain')}>드로어(그냥 잠금)</button>
            <button onClick={() => openDrawer('comp')}>드로어(보정 잠금)</button>
          </div>
          <div className={`odd-widgets-dr ${lock ? 'open' : ''}`}>
            <button onClick={() => setLock(null)}>닫기</button>
            <div className="odd-widgets-dr__list">
              {range(14).map((i) => (
                <div key={i}>드로어 항목 {i + 1}</div>
              ))}
            </div>
          </div>
        </div>
        <div className={`odd-widgets-pn odd-widgets-pn--c ${tab === 2 ? 'on' : ''}`}>
          <div className="odd-widgets-free">
            {range(lines).map((i) => (
              <p key={i}>빈 탭의 {i + 1}번째 문단 — 내용이 길어지면 안쪽에서만 스크롤된다.</p>
            ))}
          </div>
        </div>
      </div>
    </Cell>
  )
}

/* ---------------- 6. 채팅 ---------------- */
function Chat() {
  const [msgs, setMsgs] = useState(6)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setMsgs((n) => (n >= 25 ? 2 : n + 1)), 3000)
    return () => clearInterval(t)
  }, [auto])
  return (
    <Cell
      title="채팅"
      hint="column-reverse 스크롤 영역"
      ctl={
        <>
          <Btn onClick={() => setMsgs(msgs + 1)}>보내기</Btn>
          <Btn onClick={() => setMsgs(msgs + 10)}>+10</Btn>
          <Btn onClick={() => setMsgs(0)}>비우기</Btn>
          <Btn on={auto} onClick={() => setAuto(!auto)}>자동</Btn>
        </>
      }
    >
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', background: '#f3f6fb', border: '1px solid #99a' }}>
        {range(msgs)
          .reverse()
          .map((i) => (
            <div
              key={i}
              style={{
                alignSelf: i % 3 === 0 ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                margin: '4px 8px',
                padding: '4px 10px',
                borderRadius: 10,
                background: i % 3 === 0 ? '#ffe27a' : '#fff',
                border: '1px solid #bbb',
                flex: 'none',
              }}
            >
              {i + 1}번째 메시지{i % 4 === 0 ? ' — 조금 더 긴 말풍선은 두 줄로 넘어갈 수도 있다' : ''}
            </div>
          ))}
      </div>
    </Cell>
  )
}

export default function Page() {
  return (
    <div className="odd-widgets-root">
      <VirtualList />
      <Feed />
      <Autocomplete />
      <DatePicker />
      <Tabs />
      <Chat />
    </div>
  )
}
