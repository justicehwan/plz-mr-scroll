import { useEffect, useState } from 'react'
import { MrScroll } from 'plz-mr-scroll/react'
import { pages } from './registry'
import './shell.css'

type State = { page: string; lib: boolean; sb: number; notes: boolean; gap?: number; debug?: boolean; exclude?: string; suppress?: boolean }

function read(): State {
  const q = new URLSearchParams(location.hash.slice(1))
  return {
    page: q.get('page') ?? pages[0]?.meta.id ?? '',
    lib: q.get('lib') !== '0',
    sb: Number(q.get('sb') ?? 11),
    notes: q.get('notes') === '1',
    // 바깥에 띄울 때 떨어뜨릴 수 있는 거리의 한도 — 주소에 gap=숫자 를 붙였을 때만 넘긴다(없으면 라이브러리 기본값).
    gap: q.has('gap') ? Number(q.get('gap')) : undefined,
    // 진단 표시(debug=1)와 제외 선택자(exclude=선택자)도 주소로 받는다.
    debug: q.get('debug') === '1' || undefined,
    exclude: q.get('exclude') ?? undefined,
    // suppress=0 이면 브라우저의 ResizeObserver 알림을 가로채지 않는다.
    suppress: q.get('suppress') === '0' ? false : undefined,
  }
}

/**
 * 시험장 틀 — 화면 맨 위 고정 막대 하나(높이 `--lab-bar`)만 차지하고, 나머지는 페이지가 통째로 쓴다.
 * 페이지가 켜지면 `html` 에 `page-<id>` class 가 붙는다(페이지별 html·body 스타일용).
 */
export function Shell() {
  const [state, setState] = useState(read)
  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch }
    location.hash = `page=${next.page}&lib=${next.lib ? 1 : 0}&sb=${next.sb}&notes=${next.notes ? 1 : 0}${next.gap === undefined ? '' : `&gap=${next.gap}`}${next.debug ? '&debug=1' : ''}${next.exclude ? `&exclude=${encodeURIComponent(next.exclude)}` : ''}${next.suppress === false ? '&suppress=0' : ''}`
    setState(next)
  }
  useEffect(() => {
    const onHash = () => setState(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const current = pages.find((p) => p.meta.id === state.page) ?? pages[0]
  useEffect(() => {
    const root = document.documentElement
    const name = current ? `page-${current.meta.id}` : ''
    if (name) root.classList.add(name)
    // 0 = 브라우저 기본 스크롤바. 그 밖에는 그 폭으로 자리를 차지하는 스크롤바를 강제한다(겹쳐 뜨는 환경에서도 보려고).
    root.classList.toggle('lab-force', state.sb > 0)
    root.style.setProperty('--lab-sb', `${state.sb}px`)
    return () => {
      if (name) root.classList.remove(name)
    }
  }, [current, state.sb])

  if (!current) return <p style={{ padding: 60 }}>src/pages 에 페이지가 없다.</p>
  const Page = current.default

  return (
    <>
      {state.lib && <MrScroll maxOutsideGap={state.gap} debug={state.debug} exclude={state.exclude} suppressResizeObserverError={state.suppress} />}
      <div className="lab-bar" data-scrollbar="off">
        <select value={current.meta.id} onChange={(e) => update({ page: e.target.value })}>
          {pages.map((p) => (
            <option key={p.meta.id} value={p.meta.id}>
              {p.meta.id} — {p.meta.title}
            </option>
          ))}
        </select>
        {/* 체크 = 적용 중. (버튼 글자로 상태를 보여 주니 "누르면 켜진다"로 읽혀 헷갈렸다.) */}
        <label className={state.lib ? 'lab-check on' : 'lab-check'}>
          <input type="checkbox" checked={state.lib} onChange={(e) => update({ lib: e.target.checked })} />
          라이브러리 적용 — 지금 {state.lib ? '켜짐' : '꺼짐'}
        </label>
        <label>
          스크롤바
          <select value={state.sb} onChange={(e) => update({ sb: Number(e.target.value) })}>
            <option value={0}>브라우저 기본</option>
            <option value={11}>강제 11px</option>
            <option value={15}>강제 15px</option>
            <option value={17}>강제 17px</option>
          </select>
        </label>
        <label className="lab-check">
          <input type="checkbox" checked={state.notes} onChange={(e) => update({ notes: e.target.checked })} />
          구조 설명 보기
        </label>
        <label className={state.debug ? 'lab-check on' : 'lab-check'}>
          <input type="checkbox" checked={!!state.debug} onChange={(e) => update({ debug: e.target.checked || undefined })} />
          진단 표시 — 지금 {state.debug ? '켜짐' : '꺼짐'}
        </label>
      </div>
      {state.notes && (
        <ol className="lab-notes" data-scrollbar="off">
          {current.meta.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      )}
      {/* 라이브러리를 켜고 끌 때 페이지를 새로 그려, 앞선 상태가 남지 않게 한다. */}
      <Page key={`${current.meta.id}-${state.lib}`} />
    </>
  )
}
