import { useEffect, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'app-settings',
  title: '설정 화면 (문서 스크롤)',
  notes: [
    '이 페이지는 안쪽 패널이 아니라 문서(html) 자체가 스크롤된다: 높이를 고정하지 않고 min-height 만 줌. 맨 위 배너는 width:100vw 로 화면 폭에 맞춘 것이라, 문서 스크롤바가 생기면 가로로 넘쳐 가로 스크롤바가 생길 수 있음(대처 없음). 조작: 오른쪽 섹션 펼치기/접기 로 문서 길이를 바꿈.',
    '왼쪽 메뉴: position:sticky; top 을 막대 높이만큼, max-height 로 화면 높이에 맞추고 자기 overflow-y:auto. 대처 없음. 조작: 「메뉴 더 보기」로 항목 12개 추가/제거.',
    '오른쪽 본문: flex 자식, padding 24px 를 본문 요소에 직접 줌, 섹션은 아코디언(펼치기/접기). 대처 없음. 조작: 섹션 헤더 클릭, 「모두 펼치기/접기」, 「감사 로그 불러오기」(1.5초 뒤 24행), 「키 추가」.',
    '「역할 표」 카드: max-height 240 overflow:auto 카드 안의 각 행에 있는 드롭다운 팝업이 absolute 라 마지막 행에서 열면 카드 안쪽 스크롤 영역이 늘어남(팝업이 카드에 잘리거나 스크롤을 만듦). 대처 없음. 조작: 행 추가/삭제, 행의 「역할 선택」 열기.',
    '하단 저장 바: position:fixed; left:220px; right:0 — 뷰포트 기준이라 문서 스크롤바 밖에서 맞춰짐. 상단 토스트: position:fixed; right:12px. 조작: 「저장」 누르면 토스트 3초.',
    '「변경 확인」 모달: fixed 오버레이. 열릴 때 문서 스크롤을 잠그면서(html overflow:hidden) 스크롤바 폭을 계산해 body padding-right 로 보정(잘 된 대처이나 고정 저장 바·배너는 보정 안 됨). 모달 본문은 max-height 50vh overflow-y:auto. 조작: 행 추가/삭제.',
    '오른쪽 「변경 이력」 서랍: fixed, 폭 340, overflow-y:auto, 잠금·보정 없음(문서 스크롤은 그대로 움직임). 조작: 항목 추가/삭제.',
  ],
}

const SECTIONS = ['계정', '보안', '알림', '결제', '연동', '역할', '감사 로그']
const ROLES = ['관리자', '편집자', '뷰어', '게스트', '외부 협력사', '감사 담당']

export default function Page() {
  const [open, setOpen] = useState<Record<string, boolean>>({ 계정: true, 역할: true })
  const [extraNav, setExtraNav] = useState(false)
  const [keys, setKeys] = useState(['키 1', '키 2'])
  const [rows, setRows] = useState(['김가상', '이시험', '박예시'])
  const [roleOpen, setRoleOpen] = useState<number | null>(null)
  const [audit, setAudit] = useState<'idle' | 'loading' | 'done'>('idle')
  const [toast, setToast] = useState(false)
  const [modal, setModal] = useState(false)
  const [modalRows, setModalRows] = useState(Array.from({ length: 4 }, (_, i) => `변경 항목 ${i + 1}`))
  const [drawer, setDrawer] = useState(false)
  const [history, setHistory] = useState(Array.from({ length: 16 }, (_, i) => `변경 이력 ${i + 1}`))

  // 모달이 열려 있는 동안 문서 스크롤을 잠그고, 사라지는 스크롤바 폭만큼 body 에 padding-right 로 보정
  useEffect(() => {
    if (!modal) return
    const sbw = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = 'hidden'
    document.body.style.paddingRight = `${sbw}px`
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [modal])

  const save = () => {
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }
  const loadAudit = () => {
    setAudit('loading')
    setTimeout(() => setAudit('done'), 1500)
  }
  const toggle = (s: string) => setOpen((o) => ({ ...o, [s]: !o[s] }))

  return (
    <div>
      <div className="app-settings-banner">전체 폭 배너 — width:100vw</div>
      <div className="app-settings-root">
        <nav className="app-settings-nav">
          {SECTIONS.map((s) => <div key={s} className="app-settings-nav-item">{s}</div>)}
          {extraNav && Array.from({ length: 12 }, (_, i) => <div key={i} className="app-settings-nav-item">추가 메뉴 {i + 1}</div>)}
          <button onClick={() => setExtraNav((v) => !v)}>{extraNav ? '메뉴 줄이기' : '메뉴 더 보기'}</button>
        </nav>

        <main className="app-settings-main">
          <div className="app-settings-actions">
            <button onClick={() => setOpen(Object.fromEntries(SECTIONS.map((s) => [s, true])))}>모두 펼치기</button>
            <button onClick={() => setOpen({})}>모두 접기</button>
            <button onClick={() => setModal(true)}>변경 확인 모달</button>
            <button onClick={() => setDrawer((d) => !d)}>변경 이력 서랍</button>
          </div>

          {SECTIONS.map((s) => (
            <section key={s} className="app-settings-sec">
              <h3 onClick={() => toggle(s)}>{open[s] ? '▾' : '▸'} {s}</h3>
              {open[s] && (
                <div className="app-settings-sec-body">
                  {s === '역할' ? (
                    <>
                      <button onClick={() => setRows((r) => [...r, `사용자 ${r.length + 1}`])}>행 추가</button>
                      <button onClick={() => setRows((r) => r.slice(0, -1))}>행 삭제</button>
                      <div className="app-settings-roletable">
                        {rows.map((r, i) => (
                          <div key={r} className="app-settings-rolerow">
                            <span>{r}</span>
                            <div className="app-settings-select">
                              <button onClick={() => setRoleOpen(roleOpen === i ? null : i)}>역할 선택 ▾</button>
                              {roleOpen === i && (
                                <ul className="app-settings-options">
                                  {ROLES.map((ro) => <li key={ro} onClick={() => setRoleOpen(null)}>{ro}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : s === '연동' ? (
                    <>
                      <button onClick={() => setKeys((k) => [...k, `키 ${k.length + 1}`])}>키 추가</button>
                      <button onClick={() => setKeys((k) => k.slice(0, -1))}>키 삭제</button>
                      {keys.map((k) => <div key={k} className="app-settings-field">{k}: ••••••••••••</div>)}
                    </>
                  ) : s === '감사 로그' ? (
                    <>
                      <button onClick={loadAudit} disabled={audit !== 'idle'}>
                        {audit === 'idle' ? '감사 로그 불러오기' : audit === 'loading' ? '불러오는 중…' : '불러옴'}
                      </button>
                      <button onClick={() => setAudit('idle')}>지우기</button>
                      {audit === 'done' && Array.from({ length: 24 }, (_, i) => <div key={i} className="app-settings-field">감사 기록 {i + 1} — 가상 사용자가 설정을 변경함</div>)}
                    </>
                  ) : (
                    Array.from({ length: 5 }, (_, i) => (
                      <label key={i} className="app-settings-field">
                        {s} 항목 {i + 1} <input defaultValue="값" />
                      </label>
                    ))
                  )}
                </div>
              )}
            </section>
          ))}
        </main>
      </div>

      <div className="app-settings-savebar">
        <span>변경 사항이 있습니다</span>
        <button onClick={save}>저장</button>
      </div>
      {toast && <div className="app-settings-toast">저장되었습니다</div>}

      {modal && (
        <div className="app-settings-overlay">
          <div className="app-settings-modal">
            <div className="app-settings-modal-head">
              변경 내용을 확인하세요 <button onClick={() => setModal(false)}>닫기</button>
            </div>
            <div className="app-settings-modal-body">
              <button onClick={() => setModalRows((r) => [...r, `변경 항목 ${r.length + 1}`, `변경 항목 ${r.length + 2}`, `변경 항목 ${r.length + 3}`])}>3행 추가</button>
              <button onClick={() => setModalRows((r) => r.slice(0, -3))}>3행 삭제</button>
              {modalRows.map((r) => <div key={r} className="app-settings-field">{r}</div>)}
            </div>
          </div>
        </div>
      )}

      <aside className={`app-settings-drawer${drawer ? ' is-open' : ''}`}>
        <div className="app-settings-drawer-head">
          <button onClick={() => setHistory((h) => [...h, `변경 이력 ${h.length + 1}`])}>항목 추가</button>
          <button onClick={() => setHistory((h) => h.slice(0, -4))}>4개 삭제</button>
          <button onClick={() => setDrawer(false)}>닫기</button>
        </div>
        {history.map((h) => <div key={h} className="app-settings-field">{h}</div>)}
      </aside>
    </div>
  )
}
