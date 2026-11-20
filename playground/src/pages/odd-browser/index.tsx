import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { PageMeta } from '../../registry'
import './style.css'

export const meta: PageMeta = {
  id: 'odd-browser',
  title: '브라우저 기본 기능 총동원 — 입력창·select·details·표·RTL·transform·iframe·인쇄 폭',
  notes: [
    '문서 전체(html): 카드가 grid repeat(auto-fill, minmax(340px,1fr)) 로 흐름(문서 스크롤바가 생겨 폭이 줄면 열 수가 바뀔 수 있음). 맨 위 머리글은 position:fixed; left:0; right:0 이고 카드 제목은 position:sticky. 머리글의 「문서 아래 여백 0/600/1500」으로 문서 스크롤바를 만들고 없앰. 문서 쪽 대처 없음.',
    '「100vw 띠」(문서 맨 아래): width:100vw 라 문서 스크롤바가 생기면 그 폭만큼 가로로 넘쳐 문서에 가로 스크롤바가 생기는 옛 버그. 머리글의 「100vw 띠」 버튼으로 켬/끔.',
    '「여러 줄 입력 ① textarea」: rows=4 고정 크기, resize: vertical, 브라우저 기본 스크롤바(대처 없음). 「3줄 / 12줄 / 40줄 / 비움」은 ②③과 같은 글을 공유.',
    '「여러 줄 입력 ② 자동 늘어남」: 입력할 때마다 height 를 scrollHeight 로 맞추다 140px 에서 멈추고 그때부터 overflow-y:auto(그 전엔 hidden). 스크롤바가 생기면 줄바꿈 위치가 바뀌어 높이가 다시 변하는 되먹임.',
    '「여러 줄 입력 ③ contenteditable」: div max-height:100px + overflow:auto, 안쪽 p 에 좌우 padding. 스크롤바 대처 없음.',
    '「select multiple」: 여러 개 고르는 목록(size=6)과 size=3 목록. 스크롤바는 브라우저 기본 위젯 안쪽, option 개수 「4 / 12 / 40」으로 생김/사라짐. 폭 100%, 대처 없음.',
    '「세부 정보 펼치기」: details 3개. ① 안의 pre 는 max-height:120px + overflow:auto(「줄 +8/-8」), ② 는 안쪽 스크롤 없이 펼치면 문서가 길어짐, ③ 은 폭 넓은 표를 overflow-x:auto 로 감쌈. 「모두 펼침/접음」은 DOM 의 open 을 직접 바꿈.',
    '「가로·세로 표」: 높이 220px overflow:auto 에 가로·세로 스크롤바가 같이 생김. 머리글 행 sticky top:0, 첫 열 sticky left:0, 모서리 칸은 z-index 3. 「행 +10/-10」, 「열 6/20」. 대처 없음(오른쪽·아래 끝 칸이 스크롤바에 닿음).',
    '「오른쪽에서 왼쪽 ① dir=rtl」: 아랍어·히브리어 문장, 스크롤바가 왼쪽에 생김. padding 은 물리 방향(padding-right 12px, 왼쪽 0)으로 써 스크롤바 쪽이 맞는지 알 수 없음. 「줄 +6/-6」.',
    '「오른쪽에서 왼쪽 ② 스크롤바를 왼쪽으로」: 바깥 direction:rtl + 안쪽 direction:ltr 로 한국어 내용을 왼쪽 스크롤바와 함께 둠(옛 요령). 줄 수는 ①과 공유.',
    '「확대·변형 ① scale」: 바깥 div 안의 스크롤 영역에 transform: scale(.8) (폭 125%, transform-origin 왼쪽 위). 안에 position:fixed 배지가 있으나 변형 안이라 스크롤과 함께 움직임. 「줄 +6/-6」은 ②③과 공유.',
    '「확대·변형 ② zoom」: 스크롤 영역에 CSS zoom:.8 — 레이아웃 폭·스크롤바 폭이 같이 줄어드는지 확인.',
    '「확대·변형 ③ rotate」: 스크롤 영역에 transform: rotate(-1.5deg) (대처 없음, getBoundingClientRect 가 기울어진 상자를 돌려줌).',
    '「iframe ① 문서 스크롤」: srcDoc 문서 자체가 iframe 안에서 스크롤(안쪽 html 스크롤바). 「줄 +5/-5」는 srcDoc 를 바꿔 다시 불러옴. 안쪽 대처 없음.',
    '「iframe ② 높이 자동 맞춤」: scrolling="no" iframe, 안쪽 스크립트가 3초마다 문단을 하나씩 더하고(8개 넘으면 1개로) postMessage 로 높이를 알려 바깥 iframe 높이를 늘림. 그래서 문서 높이가 저절로 변해 문서 스크롤바가 생겼다 사라짐.',
    '「인쇄용 폭 고정」: 높이 220px overflow:auto 안에 794px(A4) 고정 폭 종이 div, 카드가 좁아 가로·세로 스크롤바 둘 다 생김. @media print 에서는 폭 auto. 「줄 +10/-10」, 「폭 794 ↔ 520px」.',
  ],
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function Card(p: { title: string; ctl?: ReactNode; children: ReactNode }) {
  return (
    <section className="odd-browser-card">
      <h3>{p.title}</h3>
      {p.ctl && <div className="odd-browser-ctl">{p.ctl}</div>}
      {p.children}
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

/** +/-/비움 묶음 */
function Pm(p: { n: number; set: (n: number) => void; by: number; max?: number }) {
  return (
    <>
      <Btn onClick={() => p.set(Math.min(p.max ?? 80, p.n + p.by))}>+{p.by}</Btn>
      <Btn onClick={() => p.set(Math.max(0, p.n - p.by))}>-{p.by}</Btn>
      <Btn onClick={() => p.set(0)}>비움</Btn>
      <span className="odd-browser-num">{p.n}</span>
    </>
  )
}

const lineText = (n: number) => range(n).map((i) => `줄 ${i + 1}: 입력해 둔 예시 문장입니다`).join('\n')

/** textarea 높이를 내용에 맞추되 최대 140px */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const h = Math.min(el.scrollHeight, 140)
    el.style.height = `${h}px`
    el.style.overflowY = el.scrollHeight > 140 ? 'auto' : 'hidden'
  }, [ref, value])
}

const AR = ['هذا نص تجريبي لاختبار اتجاه الكتابة من اليمين إلى اليسار', 'זהו טקסט לדוגמה לבדיקת כיוון הכתיבה מימין לשמאל']

const ifDoc = (n: number) =>
  `<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:13px system-ui;background:#eef}p{margin:4px 0;padding:3px 8px;background:#fff;border:1px solid #99c}</style>` +
  range(n).map((i) => `<p>iframe 안의 ${i + 1}번째 문단</p>`).join('')

const autoDoc =
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:13px system-ui;background:#efe}p{margin:0;padding:8px 10px;border-bottom:1px solid #9c9}</style>` +
  `<div id="b"><p>자동으로 늘어나는 문단 1</p></div>` +
  `<script>var n=1;function s(){parent.postMessage({odd:'odd-browser-h',h:document.documentElement.scrollHeight},'*')}` +
  `setInterval(function(){n=n>=8?1:n+1;var b=document.getElementById('b');b.innerHTML='';for(var i=1;i<=n;i++){var p=document.createElement('p');p.textContent='자동으로 늘어나는 문단 '+i;b.appendChild(p)}s()},3000);s()</script>`

export default function Page() {
  const [text, setText] = useState(lineText(3))
  const [opts, setOpts] = useState(12)
  const [pre, setPre] = useState(10)
  const [rows, setRows] = useState(14)
  const [cols, setCols] = useState(20)
  const [rtl, setRtl] = useState(8)
  const [xf, setXf] = useState(10)
  const [ifn, setIfn] = useState(10)
  const [ifH, setIfH] = useState(60)
  const [paper, setPaper] = useState(12)
  const [narrow, setNarrow] = useState(false)
  const [pad, setPad] = useState(0)
  const [strip, setStrip] = useState(true)
  const taB = useRef<HTMLTextAreaElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const autoFrame = useRef<HTMLIFrameElement>(null)
  useAutoGrow(taB, text)

  // 자동 높이 iframe: 안쪽이 보내는 높이를 받아 반영
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === autoFrame.current?.contentWindow && e.data?.odd === 'odd-browser-h') setIfH(e.data.h)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const setAllDetails = (open: boolean) => detailsRef.current?.querySelectorAll('details').forEach((d) => (d.open = open))

  return (
    <div className="odd-browser-root">
      <div className="odd-browser-head">
        <b>브라우저 기능 시험장</b>
        <span>문서 아래 여백</span>
        {[0, 600, 1500].map((v) => (
          <Btn key={v} on={pad === v} onClick={() => setPad(v)}>{v}</Btn>
        ))}
        <Btn on={strip} onClick={() => setStrip(!strip)}>100vw 띠</Btn>
      </div>

      <div className="odd-browser-grid">
        <Card
          title="여러 줄 입력 ① textarea"
          ctl={
            <>
              <Btn onClick={() => setText(lineText(3))}>3줄</Btn>
              <Btn onClick={() => setText(lineText(12))}>12줄</Btn>
              <Btn onClick={() => setText(lineText(40))}>40줄</Btn>
              <Btn onClick={() => setText('')}>비움</Btn>
            </>
          }
        >
          <textarea className="odd-browser-ta" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </Card>

        <Card title="여러 줄 입력 ② 자동 늘어남 / ③ contenteditable">
          <textarea ref={taB} className="odd-browser-ta odd-browser-ta--grow" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="odd-browser-ce" contentEditable suppressContentEditableWarning key={text.length}>
            {text.split('\n').map((l, i) => (
              <p key={i}>{l || ' '}</p>
            ))}
          </div>
        </Card>

        <Card
          title="select multiple"
          ctl={
            <>
              {[4, 12, 40].map((n) => (
                <Btn key={n} on={opts === n} onClick={() => setOpts(n)}>option {n}</Btn>
              ))}
            </>
          }
        >
          <select multiple size={6} className="odd-browser-sel" defaultValue={['o2']}>
            {range(opts).map((i) => (
              <option key={i} value={`o${i}`}>선택지 {i + 1}</option>
            ))}
          </select>
          <select multiple size={3} className="odd-browser-sel">
            {range(opts).map((i) => (
              <option key={i}>짧은 목록 {i + 1}</option>
            ))}
          </select>
        </Card>

        <Card
          title="세부 정보 펼치기"
          ctl={
            <>
              <Btn onClick={() => setAllDetails(true)}>모두 펼침</Btn>
              <Btn onClick={() => setAllDetails(false)}>모두 접음</Btn>
              <Pm n={pre} set={setPre} by={8} />
            </>
          }
        >
          <div ref={detailsRef} className="odd-browser-det">
            <details>
              <summary>① 안쪽 스크롤 로그</summary>
              <pre>{range(pre).map((i) => `로그 ${i + 1}: 처리 완료\n`).join('')}</pre>
            </details>
            <details>
              <summary>② 길게 펼쳐지는 본문</summary>
              {range(6).map((i) => (
                <p key={i}>이 문단은 안쪽 스크롤 없이 펼쳐져 문서를 길게 만든다. ({i + 1}/6)</p>
              ))}
            </details>
            <details open>
              <summary>③ 가로로 넓은 표</summary>
              <div className="odd-browser-det__x">
                <table>
                  <tbody>
                    <tr>{range(14).map((i) => <td key={i}>넓은 칸 {i + 1}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </Card>

        <Card
          title="가로·세로 표"
          ctl={
            <>
              <Pm n={rows} set={setRows} by={10} />
              <Btn on={cols === 6} onClick={() => setCols(6)}>열 6</Btn>
              <Btn on={cols === 20} onClick={() => setCols(20)}>열 20</Btn>
            </>
          }
        >
          <div className="odd-browser-tbl">
            <table>
              <thead>
                <tr>
                  <th>번호</th>
                  {range(cols).map((c) => <th key={c}>항목 {c + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {range(rows).map((r) => (
                  <tr key={r}>
                    <th>{r + 1}</th>
                    {range(cols).map((c) => <td key={c}>{(r * 31 + c * 17) % 1000}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="오른쪽에서 왼쪽 ① dir=rtl / ② 스크롤바 왼쪽 요령" ctl={<Pm n={rtl} set={setRtl} by={6} />}>
          <div className="odd-browser-rtl" dir="rtl">
            {range(rtl).map((i) => (
              <p key={i}>{AR[i % 2]} {i + 1}</p>
            ))}
          </div>
          <div className="odd-browser-rtl2">
            <div className="odd-browser-rtl2__in">
              {range(rtl).map((i) => (
                <p key={i}>스크롤바가 왼쪽에 있는 한국어 {i + 1}번째 줄</p>
              ))}
            </div>
          </div>
        </Card>

        <Card title="확대·변형 ① scale ② zoom ③ rotate" ctl={<Pm n={xf} set={setXf} by={6} />}>
          <div className="odd-browser-xf1">
            <div className="odd-browser-xf odd-browser-xf--scale">
              <span className="odd-browser-badge">고정 배지</span>
              {range(xf).map((i) => <p key={i}>scale(.8) 안의 {i + 1}번째 줄</p>)}
            </div>
          </div>
          <div className="odd-browser-xf odd-browser-xf--zoom">
            {range(xf).map((i) => <p key={i}>zoom .8 안의 {i + 1}번째 줄</p>)}
          </div>
          <div className="odd-browser-xf odd-browser-xf--rot">
            {range(xf).map((i) => <p key={i}>rotate 안의 {i + 1}번째 줄</p>)}
          </div>
        </Card>

        <Card title="iframe ① 문서 스크롤 ② 높이 자동 맞춤" ctl={<Pm n={ifn} set={setIfn} by={5} />}>
          <iframe title="문서 스크롤" className="odd-browser-if" srcDoc={ifDoc(ifn)} />
          <iframe ref={autoFrame} title="자동 높이" className="odd-browser-if odd-browser-if--auto" scrolling="no" style={{ height: ifH }} srcDoc={autoDoc} />
        </Card>

        <Card
          title="인쇄용 폭 고정"
          ctl={
            <>
              <Pm n={paper} set={setPaper} by={10} />
              <Btn on={narrow} onClick={() => setNarrow(!narrow)}>폭 {narrow ? '520' : '794'}px</Btn>
            </>
          }
        >
          <div className="odd-browser-paper-wrap">
            <div className="odd-browser-paper" style={{ width: narrow ? 520 : 794 }}>
              <h4>견적서</h4>
              {range(paper).map((i) => <p key={i}>{i + 1}. 인쇄 폭에 맞춰 고정된 문단 — A4 폭 794px</p>)}
            </div>
          </div>
        </Card>
      </div>

      {strip && <div className="odd-browser-strip">width: 100vw 띠</div>}
      <div style={{ height: pad }} className="odd-browser-pad" />
    </div>
  )
}
