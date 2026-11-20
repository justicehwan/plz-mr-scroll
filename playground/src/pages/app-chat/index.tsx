import { useEffect, useRef, useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'app-chat',
  title: '채팅·메신저 (절대 위치)',
  notes: [
    '전체 틀: position:relative 컨테이너(높이 calc(100vh - var(--lab-bar))) 안에서 모든 패널을 position:absolute 로 top/left/right/bottom 숫자 지정. 스레드 패널이 열리면 메시지 영역의 right 를 인라인 스타일로 320 으로 바꿈.',
    '왼쪽 채널 목록: absolute, overflow-y:auto + scrollbar-gutter:stable(자리 선점) 이고 안쪽 항목은 좌우 padding 으로 여백. 조작: 「채널 추가」, 섹션(즐겨찾기/채널/DM) 접기·펼치기, 채널 전환(채널마다 메시지 수가 다름).',
    '가운데 메시지 영역: absolute, display:flex + flex-direction:column-reverse 로 아래에서부터 쌓이는 스크롤(DOM 에는 최신 메시지가 먼저). padding 20px 를 스크롤 요소에 직접 주고 스크롤바 대처 없음. 조작: 「메시지 5개」, 「보내기」(입력칸 Enter), 「이미지 첨부」(1초 뒤 높이 200 으로 늘어남), 「마지막 삭제」, 「비우기」, 3초 뒤 상대방 답장 자동 도착.',
    '오른쪽 스레드 패널: absolute, 안쪽 본문이 overflow-y:scroll(항상 표시). 조작: 메시지의 「답글 보기」로 열기, 답글 추가/삭제, 「닫기」(닫으면 메시지 영역이 넓어짐).',
    '하단 입력창: absolute 고정 높이 72px 안의 textarea(rows=2, resize:none) 자체가 스크롤. 줄이 3줄 이상이면 textarea 에 스크롤바가 생김. 조작: 직접 입력.',
    '상단 「멤버」 팝오버와 「이모지」 팝오버: absolute 팝업. 멤버는 max-height 160 overflow-y:auto 에 대처 없음, 이모지는 height 150 overflow-y:scroll. 조작: 멤버 추가, 이모지 팝오버 열기.',
  ],
}

type Msg = { id: number; mine: boolean; text: string; img?: 'loading' | 'done'; replies: string[] }

let seq = 0
function mk(n: number, mine = false): Msg[] {
  return Array.from({ length: n }, () => {
    seq += 1
    return { id: seq, mine: mine || seq % 3 === 0, text: `가상 메시지 ${seq} — ${'내용이 이어집니다 '.repeat((seq % 4) + 1)}`, replies: [] }
  })
}

const CHANNELS: Record<string, number> = { 전체공지: 3, 개발팀: 40, 점심약속: 8, 가상DM: 0 }
const EMOJIS = Array.from({ length: 80 }, (_, i) => String.fromCodePoint(0x1f600 + i))

export default function Page() {
  const [channels, setChannels] = useState(Object.keys(CHANNELS))
  const [sections, setSections] = useState({ fav: true, ch: true, dm: true })
  const [cur, setCur] = useState('개발팀')
  const [byCh, setByCh] = useState<Record<string, Msg[]>>(() =>
    Object.fromEntries(Object.entries(CHANNELS).map(([k, n]) => [k, mk(n)])),
  )
  const [thread, setThread] = useState<number | null>(null)
  const [members, setMembers] = useState(Array.from({ length: 12 }, (_, i) => `멤버 ${i + 1}`))
  const [popup, setPopup] = useState<'none' | 'members' | 'emoji'>('none')
  const [draft, setDraft] = useState('')
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const msgs = byCh[cur] ?? []
  const set = (fn: (m: Msg[]) => Msg[]) => setByCh((b) => ({ ...b, [cur]: fn(b[cur] ?? []) }))

  const send = () => {
    const text = draft.trim()
    if (!text) return
    seq += 1
    set((m) => [...m, { id: seq, mine: true, text, replies: [] }])
    setDraft('')
    const ch = cur
    timers.current.push(
      window.setTimeout(() => {
        seq += 1
        setByCh((b) => ({ ...b, [ch]: [...(b[ch] ?? []), { id: seq, mine: false, text: '상대방의 자동 답장입니다.', replies: [] }] }))
      }, 3000),
    )
  }
  const addImage = () => {
    seq += 1
    const id = seq
    set((m) => [...m, { id, mine: true, text: '사진을 보냈습니다', img: 'loading', replies: [] }])
    timers.current.push(window.setTimeout(() => set((m) => m.map((x) => (x.id === id ? { ...x, img: 'done' } : x))), 1000))
  }
  const threadMsg = msgs.find((m) => m.id === thread)

  return (
    <div className="app-chat-root">
      <aside className="app-chat-channels">
        <button className="app-chat-side-btn" onClick={() => setChannels((c) => [...c, `새채널${c.length + 1}`])}>채널 추가</button>
        {(['fav', 'ch', 'dm'] as const).map((k) => (
          <div key={k}>
            <div className="app-chat-sec" onClick={() => setSections((s) => ({ ...s, [k]: !s[k] }))}>
              {sections[k] ? '▾' : '▸'} {k === 'fav' ? '즐겨찾기' : k === 'ch' ? '채널' : '다이렉트'}
            </div>
            {sections[k] && (k === 'ch' ? channels : channels.slice(0, 4)).map((c) => (
              <div key={`${k}-${c}`} className={`app-chat-ch${c === cur ? ' is-cur' : ''}`} onClick={() => { setCur(c); setThread(null) }}>
                # {c}
              </div>
            ))}
          </div>
        ))}
      </aside>

      <header className="app-chat-head" style={{ right: threadMsg ? 320 : 0 }}>
        <b># {cur}</b>
        <span className="app-chat-flex" />
        <button onClick={() => setPopup((p) => (p === 'members' ? 'none' : 'members'))}>멤버 ({members.length})</button>
        <button onClick={() => setPopup((p) => (p === 'emoji' ? 'none' : 'emoji'))}>이모지</button>
        {popup === 'members' && (
          <div className="app-chat-pop app-chat-members">
            {members.map((m) => <div key={m} className="app-chat-member">{m}</div>)}
            <button onClick={() => setMembers((l) => [...l, `멤버 ${l.length + 1}`, `멤버 ${l.length + 2}`])}>멤버 2명 추가</button>
          </div>
        )}
        {popup === 'emoji' && (
          <div className="app-chat-pop app-chat-emoji">
            {EMOJIS.map((e) => <button key={e} onClick={() => setDraft((d) => d + e)}>{e}</button>)}
          </div>
        )}
      </header>

      <div className="app-chat-messages" style={{ right: threadMsg ? 320 : 0 }}>
        {[...msgs].reverse().map((m) => (
          <div key={m.id} className={`app-chat-bubble${m.mine ? ' is-mine' : ''}`}>
            <div>{m.text}</div>
            {m.img && <div className="app-chat-img" style={{ height: m.img === 'done' ? 200 : 20 }}>{m.img === 'done' ? '사진(가상)' : '…'}</div>}
            <small className="app-chat-link" onClick={() => setThread(m.id)}>답글 보기 ({m.replies.length})</small>
          </div>
        ))}
        {msgs.length === 0 && <div className="app-chat-none">대화가 없습니다</div>}
      </div>

      <footer className="app-chat-composer" style={{ right: threadMsg ? 320 : 0 }}>
        <div className="app-chat-tools">
          <button onClick={() => set((m) => [...m, ...mk(5)])}>메시지 5개</button>
          <button onClick={addImage}>이미지 첨부</button>
          <button onClick={() => set((m) => m.slice(0, -1))}>마지막 삭제</button>
          <button onClick={() => set(() => [])}>비우기</button>
        </div>
        <textarea
          className="app-chat-input"
          rows={2}
          value={draft}
          placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="app-chat-send" onClick={send}>보내기</button>
      </footer>

      {threadMsg && (
        <aside className="app-chat-thread">
          <div className="app-chat-thread-head">
            <b>스레드</b>
            <button onClick={() => setThread(null)}>닫기</button>
          </div>
          <div className="app-chat-thread-body">
            <div className="app-chat-thread-origin">{threadMsg.text}</div>
            <button onClick={() => set((m) => m.map((x) => (x.id === threadMsg.id ? { ...x, replies: [...x.replies, `답글 ${x.replies.length + 1}`, `답글 ${x.replies.length + 2}`] } : x)))}>
              답글 2개 추가
            </button>
            <button onClick={() => set((m) => m.map((x) => (x.id === threadMsg.id ? { ...x, replies: x.replies.slice(0, -2) } : x)))}>
              2개 삭제
            </button>
            {threadMsg.replies.map((r) => <div key={r} className="app-chat-reply">{r}</div>)}
          </div>
        </aside>
      )}
    </div>
  )
}
