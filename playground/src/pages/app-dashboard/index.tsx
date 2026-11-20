import { useEffect, useState, type ReactNode } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'app-dashboard',
  title: '관리자 대시보드',
  notes: [
    '왼쪽 사이드바: flex 자식(width 220 고정), 자기 자신이 overflow-y:auto, 좌우 여백은 스크롤 요소 자체의 padding. 스크롤바 대처 없음. 조작: 메뉴 그룹 펼치기/접기, 「그룹 모두 펼치기」.',
    '가운데 본문(.scroll): flex 열의 남는 높이를 채우는 overflow-y:auto, 여백은 스크롤 요소 자체의 padding(0 24px). 스크롤바 대처 없음. 조작: 위젯별 접기/펼치기, 「모두 접기」, 「리포트 불러오기」(1.2초 뒤 문단 14개), 화면이 뜨고 2초 뒤 「추천 위젯」 자동으로 불어남.',
    '본문 안쪽 「주문 표」: 스크롤 안의 스크롤(max-height 280, 가로·세로 둘 다 auto), 헤더 sticky. scrollbar-gutter:stable 로 세로 자리 선점(잘 된 대처이나 가로 스크롤바는 그대로). 조작: 행 5개 추가/삭제, 「로딩」 1.5초 뒤 10행.',
    '본문 안쪽 「활동 로그」: max-height 220 overflow-y:auto, padding-right:12px 를 하드코딩해 스크롤바 자리를 가정(어설픈 대처 — 스크롤바가 없을 때는 오른쪽 여백만 넓어짐). 조작: 로그 추가/비우기.',
    '상단 「알림」 드롭다운: position:absolute 팝업, max-height 180 overflow-y:auto, 대처 없음. 조작: 알림 추가/삭제. 툴바는 스크롤 밖이라 팝업만 스크롤.',
    '오른쪽 서랍(drawer): position:fixed, overflow-y:scroll(항상 표시)로 자리 고정 + 내부 래퍼에 padding. 헤더는 sticky. 조작: 「활동 서랍」 열기/닫기, 항목 추가/삭제.',
  ],
}

type Order = { id: number; name: string; status: string; amount: number; memo: string }

const STATUS = ['결제 완료', '배송 준비', '배송 중', '환불 요청']
let seq = 100
function makeOrders(n: number): Order[] {
  return Array.from({ length: n }, () => {
    seq += 1
    return {
      id: seq,
      name: `고객 ${seq}`,
      status: STATUS[seq % STATUS.length],
      amount: 12000 + (seq % 17) * 3100,
      memo: `요청 사항 ${seq}번 — 부재 시 경비실에 맡겨 주세요, 포장은 가능한 한 간단하게 부탁드립니다`,
    }
  })
}

const NAV_GROUPS = ['개요', '매출', '주문', '고객', '재고', '정산'].map((g) => ({
  name: g,
  items: Array.from({ length: 5 }, (_, i) => `${g} 메뉴 ${i + 1}`),
}))

export default function Page() {
  const [open, setOpen] = useState<Record<string, boolean>>({ 개요: true, 매출: true })
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [orders, setOrders] = useState<Order[]>(() => makeOrders(6))
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [logs, setLogs] = useState<string[]>(() => Array.from({ length: 4 }, (_, i) => `로그 ${i + 1}: 배치 작업 완료`))
  const [report, setReport] = useState<'idle' | 'loading' | 'done'>('idle')
  const [late, setLate] = useState(false)
  const [notices, setNotices] = useState<string[]>(['새 주문 3건', '재고 부족 경고'])
  const [menu, setMenu] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [drawerItems, setDrawerItems] = useState<string[]>(() => Array.from({ length: 14 }, (_, i) => `활동 ${i + 1}`))

  // 화면이 뜬 뒤 2초 뒤에 늦게 불어나는 위젯
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 2000)
    return () => clearTimeout(t)
  }, [])

  const toggleFold = (k: string) => setFolded((f) => ({ ...f, [k]: !f[k] }))
  const loadOrders = () => {
    setLoadingOrders(true)
    setTimeout(() => {
      setOrders((o) => [...o, ...makeOrders(10)])
      setLoadingOrders(false)
    }, 1500)
  }
  const loadReport = () => {
    setReport('loading')
    setTimeout(() => setReport('done'), 1200)
  }

  return (
    <div className="app-dashboard-root">
      <aside className="app-dashboard-side">
        <button className="app-dashboard-btn" onClick={() => setOpen(Object.fromEntries(NAV_GROUPS.map((g) => [g.name, true])))}>
          그룹 모두 펼치기
        </button>
        {NAV_GROUPS.map((g) => (
          <div key={g.name} className="app-dashboard-group">
            <button className="app-dashboard-group-head" onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}>
              {open[g.name] ? '▾' : '▸'} {g.name}
            </button>
            {open[g.name] && g.items.map((it) => <div key={it} className="app-dashboard-nav-item">{it}</div>)}
          </div>
        ))}
      </aside>

      <section className="app-dashboard-main">
        <header className="app-dashboard-toolbar">
          <strong>운영 현황</strong>
          <span className="app-dashboard-spacer" />
          <button className="app-dashboard-btn" onClick={() => setFolded(Object.fromEntries(['kpi', 'orders', 'logs', 'late'].map((k) => [k, true])))}>
            모두 접기
          </button>
          <button className="app-dashboard-btn" onClick={() => setFolded({})}>모두 펼치기</button>
          <div className="app-dashboard-dd">
            <button className="app-dashboard-btn" onClick={() => setMenu((m) => !m)}>알림 ({notices.length})</button>
            {menu && (
              <div className="app-dashboard-dd-menu">
                {notices.map((n, i) => (
                  <div key={i} className="app-dashboard-dd-item">
                    {n}
                    <button onClick={() => setNotices((l) => l.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button className="app-dashboard-dd-add" onClick={() => setNotices((l) => [...l, `알림 ${l.length + 1}`, `알림 ${l.length + 2}`])}>
                  알림 2개 추가
                </button>
              </div>
            )}
          </div>
          <button className="app-dashboard-btn" onClick={() => setDrawer((d) => !d)}>활동 서랍</button>
        </header>

        <div className="app-dashboard-scroll">
          <Widget title="핵심 지표" k="kpi" folded={folded} toggle={toggleFold}>
            <div className="app-dashboard-kpis">
              {['오늘 매출', '신규 가입', '환불률', '대기 문의'].map((t, i) => (
                <div key={t} className="app-dashboard-kpi">
                  <small>{t}</small>
                  <b>{(i + 1) * 1234}</b>
                </div>
              ))}
            </div>
          </Widget>

          <Widget title="주문 표" k="orders" folded={folded} toggle={toggleFold}>
            <div className="app-dashboard-actions">
              <button className="app-dashboard-btn" onClick={() => setOrders((o) => [...o, ...makeOrders(5)])}>행 5개 추가</button>
              <button className="app-dashboard-btn" onClick={() => setOrders((o) => o.slice(0, Math.max(0, o.length - 5)))}>행 5개 삭제</button>
              <button className="app-dashboard-btn" disabled={loadingOrders} onClick={loadOrders}>
                {loadingOrders ? '로딩 중…' : '로딩 (1.5초 뒤 10행)'}
              </button>
              <span>{orders.length}행</span>
            </div>
            <div className="app-dashboard-table-box">
              <table className="app-dashboard-table">
                <thead>
                  <tr>
                    <th>번호</th><th>고객</th><th>상태</th><th>금액</th><th>결제 수단</th><th>배송지</th><th>쿠폰</th><th>담당자</th><th>요청 사항</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td><td>{o.name}</td><td>{o.status}</td><td>{o.amount.toLocaleString()}원</td>
                      <td>카드</td><td>가상의 시 가상구 1-{o.id % 30}</td><td>없음</td><td>담당 {o.id % 5}</td><td>{o.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Widget>

          <Widget title="활동 로그" k="logs" folded={folded} toggle={toggleFold}>
            <div className="app-dashboard-actions">
              <button className="app-dashboard-btn" onClick={() => setLogs((l) => [...l, ...Array.from({ length: 4 }, (_, i) => `로그 ${l.length + i + 1}: 배치 작업 완료`)])}>
                로그 4줄 추가
              </button>
              <button className="app-dashboard-btn" onClick={() => setLogs([])}>비우기</button>
            </div>
            <div className="app-dashboard-log">
              {logs.length === 0 && <div className="app-dashboard-empty">기록 없음</div>}
              {logs.map((l) => <div key={l} className="app-dashboard-log-row">{l}</div>)}
            </div>
          </Widget>

          <div className="app-dashboard-actions">
            <button className="app-dashboard-btn" disabled={report !== 'idle'} onClick={loadReport}>
              {report === 'idle' ? '리포트 불러오기' : report === 'loading' ? '불러오는 중…' : '불러옴'}
            </button>
            <button className="app-dashboard-btn" onClick={() => setReport('idle')}>리포트 지우기</button>
          </div>
          {report === 'done' && Array.from({ length: 14 }, (_, i) => (
            <p key={i} className="app-dashboard-para">월간 리포트 문단 {i + 1} — 가상의 수치와 설명이 이어지는 자리입니다. 값이 늘어나면 본문 스크롤바가 생깁니다.</p>
          ))}

          {late && (
            <Widget title="추천 위젯 (2초 뒤 도착)" k="late" folded={folded} toggle={toggleFold}>
              <div className="app-dashboard-kpis">
                {Array.from({ length: 8 }, (_, i) => <div key={i} className="app-dashboard-kpi"><small>추천 {i + 1}</small><b>{i * 77}</b></div>)}
              </div>
            </Widget>
          )}
        </div>
      </section>

      <aside className={`app-dashboard-drawer${drawer ? ' is-open' : ''}`}>
        <div className="app-dashboard-drawer-head">
          <b>활동 서랍</b>
          <button onClick={() => setDrawer(false)}>닫기</button>
        </div>
        <div className="app-dashboard-drawer-body">
          <button className="app-dashboard-btn" onClick={() => setDrawerItems((l) => [...l, `활동 ${l.length + 1}`])}>항목 추가</button>
          <button className="app-dashboard-btn" onClick={() => setDrawerItems((l) => l.slice(0, -4))}>4개 삭제</button>
          {drawerItems.map((d) => <div key={d} className="app-dashboard-drawer-item">{d}</div>)}
        </div>
      </aside>
    </div>
  )
}

function Widget(props: { title: string; k: string; folded: Record<string, boolean>; toggle: (k: string) => void; children: ReactNode }) {
  const isFolded = props.folded[props.k]
  return (
    <div className="app-dashboard-widget">
      <div className="app-dashboard-widget-head" onClick={() => props.toggle(props.k)}>
        {isFolded ? '▸' : '▾'} {props.title}
      </div>
      {!isFolded && <div className="app-dashboard-widget-body">{props.children}</div>}
    </div>
  )
}
