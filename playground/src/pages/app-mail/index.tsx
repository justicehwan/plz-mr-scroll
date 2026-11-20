import { useState } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'app-mail',
  title: '메일함 (3단)',
  notes: [
    '전체 틀: CSS grid 3열(220px 340px minmax(0,1fr)), 높이는 calc(100vh - var(--lab-bar)). 각 열이 따로 스크롤.',
    '1열 폴더: 열 자신이 overflow-y:auto, 여백은 안쪽 래퍼(.inner)의 padding. 스크롤바 대처 없음. 조작: 「라벨 3개 추가」, 「하위 폴더 펼치기」(접기/펼치기).',
    '2열 메일 목록: 헤더는 스크롤 밖, 아래 스크롤 요소에 scrollbar-gutter:stable both-edges(양쪽 자리 선점). 안에 sticky 날짜 머리글과 메일 행. 조작: 「새 메일 3통」, 「더 불러오기」(1초 뒤 12통), 행의 × 삭제, 「비우기」.',
    '3열 본문: 스크롤 요소에 padding-left:28px, padding-right:17px 로 「스크롤바 17px 이 생긴다」고 가정해 하드코딩(어설픈 대처). 안에 sticky 제목줄, 가로 스크롤 첨부 띠, 가로 스크롤 코드 블록. 조작: 스레드 메일 펼치기/접기, 「이미지 불러오기」(1.5초 뒤 높이 260 으로 늘어남), 답장 입력칸 「줄 늘리기」(textarea 자체 스크롤).',
    '「새 메일 쓰기」 모달: position:fixed 오버레이(막대 아래부터), 모달 본문이 max-height 안에서 overflow-y:auto, 본문에 padding-right:8px 만 줌. 조작: 「첨부 줄 추가」/「삭제」, 본문 textarea 에 글을 많이 입력.',
  ],
}

type Mail = { id: number; from: string; subject: string; day: string }

let seq = 0
function makeMails(n: number, day: string): Mail[] {
  return Array.from({ length: n }, () => {
    seq += 1
    return { id: seq, from: `보낸이 ${seq}`, subject: `[공지] 가상 안내 메일 제목 ${seq}번 — 조금 긴 제목이 말줄임 되는지 확인`, day }
  })
}

const THREAD = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  who: i % 2 ? '나' : '김가상',
  body: `스레드 ${i + 1}번째 메시지입니다. `.repeat(i === 0 ? 14 : 3),
}))

export default function Page() {
  const [labels, setLabels] = useState(['업무', '개인', '영수증'])
  const [sub, setSub] = useState(false)
  const [mails, setMails] = useState<Mail[]>(() => [...makeMails(6, '오늘'), ...makeMails(8, '어제')])
  const [loading, setLoading] = useState(false)
  const [openIds, setOpenIds] = useState<number[]>([0])
  const [img, setImg] = useState<'none' | 'loading' | 'done'>('none')
  const [replyRows, setReplyRows] = useState(2)
  const [compose, setCompose] = useState(false)
  const [attach, setAttach] = useState(['보고서.pdf'])

  const more = () => {
    setLoading(true)
    setTimeout(() => {
      setMails((m) => [...m, ...makeMails(12, '지난주')])
      setLoading(false)
    }, 1000)
  }
  const loadImg = () => {
    setImg('loading')
    setTimeout(() => setImg('done'), 1500)
  }
  const days = [...new Set(mails.map((m) => m.day))]

  return (
    <div className="app-mail-root">
      {/* 1열 */}
      <nav className="app-mail-col1">
        <div className="app-mail-col1-inner">
          <button className="app-mail-compose" onClick={() => setCompose(true)}>새 메일 쓰기</button>
          {['받은편지함', '보낸편지함', '임시보관', '스팸', '휴지통'].map((f) => <div key={f} className="app-mail-folder">{f}</div>)}
          <div className="app-mail-folder" onClick={() => setSub((s) => !s)}>{sub ? '▾' : '▸'} 하위 폴더 펼치기</div>
          {sub && Array.from({ length: 10 }, (_, i) => <div key={i} className="app-mail-folder app-mail-sub">하위 {i + 1}</div>)}
          {labels.map((l, i) => <div key={i} className="app-mail-folder">🏷 {l}</div>)}
          <button onClick={() => setLabels((l) => [...l, `라벨 ${l.length + 1}`, `라벨 ${l.length + 2}`, `라벨 ${l.length + 3}`])}>라벨 3개 추가</button>
        </div>
      </nav>

      {/* 2열 */}
      <section className="app-mail-col2">
        <div className="app-mail-col2-head">
          <button onClick={() => setMails((m) => [...makeMails(3, '오늘'), ...m])}>새 메일 3통</button>
          <button onClick={more} disabled={loading}>{loading ? '불러오는 중…' : '더 불러오기'}</button>
          <button onClick={() => setMails([])}>비우기</button>
          <span>{mails.length}통</span>
        </div>
        <div className="app-mail-col2-scroll">
          {mails.length === 0 && <div className="app-mail-empty">메일이 없습니다</div>}
          {days.map((d) => (
            <div key={d}>
              <div className="app-mail-day">{d}</div>
              {mails.filter((m) => m.day === d).map((m) => (
                <div key={m.id} className="app-mail-row">
                  <div className="app-mail-row-main">
                    <b>{m.from}</b>
                    <span>{m.subject}</span>
                  </div>
                  <button onClick={() => setMails((l) => l.filter((x) => x.id !== m.id))}>×</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 3열 */}
      <article className="app-mail-col3">
        <div className="app-mail-col3-scroll">
          <h2 className="app-mail-subject">Re: 가상 프로젝트 일정 논의 (스레드 5건)</h2>
          <div className="app-mail-chips">
            {Array.from({ length: 12 }, (_, i) => <span key={i} className="app-mail-chip">첨부파일_{i + 1}.xlsx</span>)}
          </div>
          {THREAD.map((t) => {
            const isOpen = openIds.includes(t.id)
            return (
              <div key={t.id} className="app-mail-msg">
                <div className="app-mail-msg-head" onClick={() => setOpenIds((o) => (isOpen ? o.filter((x) => x !== t.id) : [...o, t.id]))}>
                  {isOpen ? '▾' : '▸'} {t.who}
                </div>
                {isOpen && <div className="app-mail-msg-body">{t.body}</div>}
              </div>
            )
          })}
          <pre className="app-mail-code">{'const veryLongLine = "이 줄은 일부러 아주 길게 써서 코드 블록에 가로 스크롤이 생기게 한다 — ".repeat(5)'}</pre>
          <div className="app-mail-actions">
            <button onClick={loadImg} disabled={img !== 'none'}>이미지 불러오기</button>
            <button onClick={() => setImg('none')}>이미지 지우기</button>
          </div>
          {img !== 'none' && <div className="app-mail-img" style={{ height: img === 'done' ? 260 : 24 }}>{img === 'done' ? '이미지(가상)' : '로딩…'}</div>}
          <textarea className="app-mail-reply" rows={replyRows} defaultValue={'답장 내용을 입력하세요.\n'.repeat(5)} />
          <div className="app-mail-actions">
            <button onClick={() => setReplyRows((r) => r + 3)}>줄 늘리기</button>
            <button onClick={() => setReplyRows(2)}>줄 줄이기</button>
          </div>
        </div>
      </article>

      {compose && (
        <div className="app-mail-overlay">
          <div className="app-mail-modal">
            <div className="app-mail-modal-head">
              새 메일 쓰기 <button onClick={() => setCompose(false)}>닫기</button>
            </div>
            <div className="app-mail-modal-body">
              <input placeholder="받는 사람" />
              <input placeholder="제목" />
              {attach.map((a, i) => (
                <div key={i} className="app-mail-attach">
                  {a}
                  <button onClick={() => setAttach((l) => l.filter((_, j) => j !== i))}>삭제</button>
                </div>
              ))}
              <button onClick={() => setAttach((l) => [...l, `첨부_${l.length + 1}.png`])}>첨부 줄 추가</button>
              <textarea rows={6} placeholder="본문 — 길게 입력해 보세요" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
