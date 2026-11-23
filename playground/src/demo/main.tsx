import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MrScroll } from 'plz-mr-scroll/react'
import './demo.css'

/**
 * 전후 비교 데모 — 장면마다 같은 화면을 둘 놓고, 왼쪽은 라이브러리가 건드리지 않게(`data-scrollbar="off"`) 둔다.
 * 스크롤바가 생기면 왼쪽은 내용이 밀리고 오른쪽은 그대로다. 밀린 거리는 그 자리에서 재서 보여 준다(`data-probe` 를 붙인 요소).
 * 리드미의 움짤(`docs/demo*.gif`)은 이 화면을 `scripts/record-demo.mjs` 가 찍은 것이다 —
 * 주소의 `?scene=<이름>&shot` 으로 장면을 고르고 조작 버튼을 숨기며, `window.__demo.set(n)` 으로 단계를 바꾼다.
 */

type Scene = {
  id: string
  tab: string
  /** 창 틀 주소창에 적는 글. */
  url: string
  /** 「Before」 옆에 적는 한 줄. */
  before: string
  start: number
  max: number
  more: string
  less: string
  hint: string
  /** 전후 비교 없이 화면 하나만 그린다(진단 표시 장면). */
  single?: boolean
  render: (after: boolean, step: number) => ReactNode
}

const off = (after: boolean) => (after ? undefined : 'off')
const hue = (i: number) => [262, 199, 152, 28, 340, 221, 174, 12, 290, 96][i % 10]
const avatar = (i: number) => ({ background: `linear-gradient(135deg, hsl(${hue(i)} 80% 66%), hsl(${hue(i) + 30} 75% 52%))` })

const PEOPLE = [
  ['Ada Lovelace', 'ada@acme.dev', 'Owner'],
  ['Alan Turing', 'alan@acme.dev', 'Admin'],
  ['Grace Hopper', 'grace@acme.dev', 'Member'],
  ['Linus Torvalds', 'linus@acme.dev', 'Member'],
  ['Margaret Hamilton', 'margaret@acme.dev', 'Member'],
  ['Dennis Ritchie', 'dennis@acme.dev', 'Member'],
  ['Barbara Liskov', 'barbara@acme.dev', 'Guest'],
  ['Ken Thompson', 'ken@acme.dev', 'Guest'],
] as const

function Members(p: { after: boolean; count: number }) {
  return (
    <>
      <div className="demo-head">
        <strong>Team members</strong>
        <em>{p.count}</em>
      </div>
      <div className="demo-body">
        {/* 스크롤 영역 자신에 좌우 여백이 있다 — 그 여백을 스크롤바 폭만큼 줄여 받는다. */}
        <div className="demo-list sb" data-scrollbar={off(p.after)}>
          {PEOPLE.slice(0, p.count).map(([name, mail, role], i) => (
            <div className="demo-row" key={name}>
              <i style={avatar(i)}>{name[0]}</i>
              <div>
                <b>{name}</b>
                <small>{mail}</small>
              </div>
              <button type="button" data-probe={i === 0 ? '' : undefined}>{role}</button>
            </div>
          ))}
        </div>
        <div className="demo-guide" />
      </div>
    </>
  )
}

const CHANNELS = ['general', 'design', 'frontend', 'backend', 'releases', 'random', 'support', 'incidents', 'hiring', 'watercooler'] as const

function Channels(p: { after: boolean; count: number }) {
  return (
    // 여백은 바깥 틀에 있고, 목록은 그 틀을 꽉 채운다 — 스크롤바만 틀의 여백에 띄운다.
    <div className="demo-side">
      <div className="demo-side-title">Channels</div>
      <div className="demo-channels sb" data-scrollbar={off(p.after)}>
        {CHANNELS.slice(0, p.count).map((name, i) => (
          <div className={i === 1 ? 'demo-channel on' : 'demo-channel'} key={name}>
            <span># {name}</span>
            {i % 3 !== 2 && <em data-probe={i === 0 ? '' : undefined}>{((i * 7) % 9) + 1}</em>}
          </div>
        ))}
      </div>
      <div className="demo-guide side" />
    </div>
  )
}

const CHAT = [
  [false, 'Did the layout just jump when the list got longer, or is it only me?'],
  [true, 'Not only you. The scrollbar showed up and took its width out of the content.'],
  [false, 'So every line re-wraps the moment one more message arrives.'],
  [true, 'Yep. That is the scrollbar pushing.'],
  [false, 'Can we stop it without reserving an empty gutter?'],
  [true, 'Let him stand in the padding instead.'],
  [false, 'Nice. Nothing moved this time.'],
] as const

function Chat(p: { after: boolean; count: number }) {
  return (
    <div className="demo-body">
      <div className="demo-chat sb" data-scrollbar={off(p.after)}>
        {CHAT.slice(0, p.count).map(([mine, text], i) => (
          <p className={mine ? 'me' : undefined} key={text} data-probe={i === 0 ? '' : undefined}>
            {text}
          </p>
        ))}
      </div>
    </div>
  )
}

function Site(p: { after: boolean; long: boolean }) {
  return (
    <div className="demo-body">
      {/* 창 전체가 스크롤되는 페이지를 흉내 낸다 — 내용은 가운데 놓인다. */}
      <div className="demo-guide center" />
      <div className="demo-viewport sb" data-scrollbar={off(p.after)}>
        <div className="demo-site">
          <nav>
            <b data-probe="">◆ acme</b>
            <span className={p.long ? undefined : 'on'}>Home</span>
            <span className={p.long ? 'on' : undefined}>Blog</span>
            <span>Pricing</span>
          </nav>
          <h2>{p.long ? 'Why did the page just jump?' : 'Build faster with acme'}</h2>
          {(p.long
            ? [
                'You click a link in the nav. The next page is longer than the window, so the browser adds a scrollbar.',
                'That scrollbar takes its width from the page. Everything that was centered slides a few pixels to the left.',
                'The logo moves. The menu moves. Your eye catches it every single time.',
                'Go back to the short page and it all slides right again.',
              ]
            : ['A short landing page. It fits in the window, so there is no scrollbar yet.']
          ).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

function Code(p: { after: boolean; long: boolean }) {
  return (
    <div className="demo-doc">
      <strong>Quick start</strong>
      {/* 높이를 정하지 않은 코드 블록 — 가로 스크롤바가 생기면 그 높이만큼 아래 내용이 밀린다. */}
      <pre className="sb" data-scrollbar={off(p.after)}>
        {`// app/layout.tsx\n`}
        {p.long ? `<MrScroll stayClose={12} exclude=".third-party-widget, .legacy-table" debug />` : `<MrScroll />`}
      </pre>
      <div className="demo-doc-foot" data-probe="">
        <button type="button">Copy</button>
        <span>Put it once at the top of your app.</span>
      </div>
      <p>That is the whole setup. No classes, no attributes on your scroll areas.</p>
    </div>
  )
}

function Dashboard(p: { many: boolean }) {
  return (
    <div className="demo-dash">
      <Channels after count={p.many ? 10 : 4} />
      <div className="demo-dash-main">
        <Members after count={p.many ? 8 : 3} />
      </div>
    </div>
  )
}

const SCENES: Scene[] = [
  {
    id: 'members', tab: 'List with buttons', url: 'acme.dev/settings/team', before: 'the scrollbar pushes your layout',
    start: 3, max: PEOPLE.length, more: '+ Add a member', less: '− Remove one', hint: 'Add members until the list overflows.',
    render: (after, step) => <Members after={after} count={step} />,
  },
  {
    id: 'sidebar', tab: 'Sidebar', url: 'acme.dev/chat', before: 'rows shrink, badges slide',
    start: 4, max: CHANNELS.length, more: '+ Add a channel', less: '− Remove one', hint: 'The list fills its panel edge to edge — the scrollbar stands in the panel padding.',
    render: (after, step) => <Channels after={after} count={step} />,
  },
  {
    id: 'chat', tab: 'Chat', url: 'acme.dev/chat/general', before: 'every line re-wraps',
    start: 2, max: CHAT.length, more: '+ New message', less: '− Remove one', hint: 'Watch the first message when the scrollbar appears.',
    render: (after, step) => <Chat after={after} count={step} />,
  },
  {
    id: 'page', tab: 'Page jump', url: 'acme.dev', before: 'the whole page slides sideways',
    start: 0, max: 1, more: 'Open the long page →', less: '← Back to the short page', hint: 'Centered pages jump when you move between a short page and a long one.',
    render: (after, step) => <Site after={after} long={step > 0} />,
  },
  {
    id: 'code', tab: 'Code block', url: 'acme.dev/docs/quick-start', before: 'content below is pushed down',
    start: 0, max: 1, more: 'Make the line long →', less: '← Make it short', hint: 'Horizontal scrollbars push things too — downwards.',
    render: (after, step) => <Code after={after} long={step > 0} />,
  },
  {
    id: 'debug', tab: 'See what it did', url: 'acme.dev/chat', before: '', single: true,
    start: 0, max: 1, more: 'Fill the lists →', less: '← Empty them', hint: 'With the debug option on, each scroll area shows how it was handled.',
    render: (_after, step) => <Dashboard many={step > 0} />,
  },
]

function Panel(p: { scene: Scene; after: boolean; step: number }) {
  const root = useRef<HTMLElement>(null)
  const home = useRef<DOMRect | null>(null)
  const [moved, setMoved] = useState('')
  // 표시한 요소(`data-probe`)가 처음 자리에서 얼마나 움직였는지 잰다 — 눈에 보이는 밀림을 숫자로도 보여 준다.
  useLayoutEffect(() => {
    let frame = 0
    const read = () => {
      const rect = root.current?.querySelector('[data-probe]')?.getBoundingClientRect()
      if (rect) {
        home.current ??= rect
        const dx = Math.round(home.current.right - rect.right)
        const dy = Math.round(rect.top - home.current.top)
        const dh = Math.round(rect.height - home.current.height)
        setMoved(dh !== 0 ? 'text re-wrapped' : dx > 0 ? `← content pushed ${dx}px` : dy > 0 ? `↓ pushed down ${dy}px` : '')
      }
      frame = requestAnimationFrame(read)
    }
    frame = requestAnimationFrame(read)
    return () => cancelAnimationFrame(frame)
  }, [])
  const { scene, after } = p

  return (
    <section className="demo-panel" ref={root}>
      {!scene.single && (
        <div className={after ? 'demo-tag good' : 'demo-tag bad'}>
          <b>{after ? 'After' : 'Before'}</b>
          {after ? 'with plz-mr-scroll' : scene.before}
        </div>
      )}
      <div className="demo-window">
        <div className="demo-chrome">
          <i /><i /><i />
          <span>{scene.url}</span>
        </div>
        {scene.render(after, p.step)}
      </div>
      {!scene.single && <div className={moved ? 'demo-result bad' : 'demo-result good'}>{moved || '✓ nothing moved'}</div>}
    </section>
  )
}

function Demo() {
  const query = new URLSearchParams(location.search)
  // 주소에 ?shot 이 붙으면 조작 버튼을 숨긴다 — 움짤을 찍을 때 쓴다.
  const shot = query.has('shot')
  const [id, setId] = useState(query.get('scene') ?? SCENES[0].id)
  const scene = SCENES.find((s) => s.id === id) ?? SCENES[0]
  const [step, setStep] = useState(scene.start)
  const pick = (next: Scene) => {
    setId(next.id)
    setStep(next.start)
  }
  useEffect(() => {
    ;(window as unknown as { __demo: unknown }).__demo = { set: setStep, max: scene.max, start: scene.start, scenes: SCENES.map((s) => s.id) }
  }, [scene])
  // 이 브라우저에서 스크롤바가 차지하는 폭 — 0 이면 겹쳐 뜨는 스크롤바라 밀림도, 보여 줄 차이도 없다.
  const probe = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState(1)
  useEffect(() => {
    if (probe.current) setBar(probe.current.offsetWidth - probe.current.clientWidth)
  }, [])

  return (
    <main className="demo-root">
      {/* 주소에 ?debug 를 붙이면 어느 장면에서든 진단 표시를 켠다. */}
      <MrScroll debug={scene.single || query.has('debug')} />
      <div ref={probe} className="demo-probe sb" data-scrollbar="off" />
      {!shot && (
        <nav className="demo-tabs">
          {SCENES.map((s) => (
            <button type="button" key={s.id} className={s.id === scene.id ? 'on' : undefined} onClick={() => pick(s)}>
              {s.tab}
            </button>
          ))}
        </nav>
      )}
      {/* 장면이 바뀌면 처음 자리를 다시 재게 통째로 새로 그린다. */}
      <div className={scene.single ? 'demo-panels single' : 'demo-panels'} key={scene.id}>
        {!scene.single && <Panel scene={scene} after={false} step={step} />}
        <Panel scene={scene} after step={step} />
      </div>
      {!shot && (
        <div className="demo-bar">
          <button type="button" disabled={step >= scene.max} onClick={() => setStep(step + 1)}>{scene.more}</button>
          <button type="button" disabled={step <= scene.start} onClick={() => setStep(step - 1)}>{scene.less}</button>
          <span>{scene.hint}</span>
        </div>
      )}
      {!shot && bar === 0 && (
        <p className="demo-note">
          Your browser draws overlay scrollbars here (they take no space), so nothing gets pushed and both sides look the same. Open this page in
          Chrome or Safari, or set your system to always show scroll bars, to see the difference.
        </p>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
